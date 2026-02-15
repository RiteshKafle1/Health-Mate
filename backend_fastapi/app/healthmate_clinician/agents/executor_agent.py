"""Executor agent for generating final medical responses with follow-up question strategy."""
from ..core.state import AgentState
from ..tools.llm_client import get_llm

# Max number of conversation exchanges before forcing a direct answer
MAX_FOLLOW_UP_EXCHANGES = 5

MEDICAL_PROMPT_TEMPLATE = """You are HealthMate Clinician, a medical Q&A assistant.

CRITICAL RULES FOR FOLLOW-UP QUESTIONS:
- You have had {exchange_count} conversation exchanges so far (max allowed: {max_exchanges}).
- {follow_up_instruction}
- Your PRIMARY job is to ANSWER the question, not to keep asking more questions.
- ALWAYS prefer giving a direct answer over asking follow-up questions.
- Only ask a follow-up if the question is truly impossible to answer without more info.

BEHAVIOR RULES:

1. ANSWERING (DEFAULT - do this in most cases):
   - Provide a concise, evidence-based answer using the ANSWER format below
   - Include safety caveats and when to seek urgent care
   - Encourage consulting healthcare professionals for diagnosis/treatment
   - Even with limited information, provide the best possible answer

2. CLARIFICATION (only if absolutely necessary AND under the exchange limit):
   - Only if the question is truly impossible to answer, ask up to TWO targeted follow-up questions
   - Each question should clarify the user's intent
   - Do not ask more than two questions at once

3. SAFETY AND TONE:
   - Use non-judgmental, empathetic language
   - Do not diagnose - present differential considerations where relevant
   - Include red flags that require urgent care

4. FORMATTING:
   - Present content clearly without special characters like asterisks
   - Use clean structure with consistent layout
   - Reference the source: {source}

---

ANSWER FORMAT (use when providing final answer):

SUMMARY
[1-3 sentences describing the main point]

WHAT TO DO NOW
[Practical steps: when to seek care, home care tips, what to monitor]

URGENT WARNINGS
[Urgent warning signs and actions - call emergency if present]

POSSIBLE CONSIDERATIONS
[Likely possibilities to discuss with your doctor - NOT a diagnosis]

---

CONVERSATION HISTORY:
{history}

PATIENT'S CURRENT QUESTION: {question}

REFERENCE INFORMATION:
{content}

YOUR RESPONSE (ANSWER the question directly - do NOT ask follow-up questions unless absolutely necessary):"""


def _count_exchanges(conversation_history: list) -> int:
    """Count the number of user message exchanges in conversation history."""
    return sum(1 for item in conversation_history if item.get('role') == 'user')


def _get_follow_up_instruction(exchange_count: int, max_exchanges: int) -> str:
    """Get the appropriate instruction based on exchange count."""
    if exchange_count >= max_exchanges:
        return "You have REACHED the maximum number of exchanges. You MUST provide a FINAL DIRECT ANSWER now. Do NOT ask any more follow-up questions under any circumstances."
    elif exchange_count >= max_exchanges - 1:
        return "You are at the LAST allowed exchange. Provide a DIRECT ANSWER now. Do NOT ask follow-up questions."
    elif exchange_count >= 2:
        return f"You have already asked enough follow-up questions. Provide a DIRECT ANSWER now. You have {max_exchanges - exchange_count} exchanges remaining."
    else:
        return f"You may ask follow-up questions if the question is truly ambiguous, but prefer giving a direct answer. You have {max_exchanges - exchange_count} exchanges remaining."


def ExecutorAgent(state: AgentState) -> AgentState:
    """Generate the final medical response with limited follow-up question capability."""
    llm = get_llm()
    
    if not llm:
        state["generation"] = "Medical AI service temporarily unavailable. Please consult a healthcare professional."
        state["source"] = "System Message"
        return state
    
    question = state["question"]
    source_info = state.get("source", "Unknown")
    
    # Count conversation exchanges to enforce follow-up limit
    conversation_history = state.get("conversation_history", [])
    exchange_count = _count_exchanges(conversation_history)
    follow_up_instruction = _get_follow_up_instruction(exchange_count, MAX_FOLLOW_UP_EXCHANGES)
    
    # Build conversation context
    history_context = ""
    for item in conversation_history[-4:]:
        role = item.get('role', '')
        content = item.get('content', '')
        if role == 'user':
            history_context += f"Patient: {content}\n"
        elif role == 'assistant':
            short_content = content[:200] + "..." if len(content) > 200 else content
            history_context += f"HealthMate: {short_content}\n"

    # If we have documents from retrieval
    if state.get("documents") and len(state["documents"]) > 0:
        content = "\n\n".join([doc.page_content[:1000] for doc in state["documents"][:2]])
        
        prompt = MEDICAL_PROMPT_TEMPLATE.format(
            exchange_count=exchange_count,
            max_exchanges=MAX_FOLLOW_UP_EXCHANGES,
            follow_up_instruction=follow_up_instruction,
            source=source_info,
            history=history_context if history_context else "This is the start of the conversation.",
            question=question,
            content=content if content else "No specific reference available."
        )

        response = llm.invoke(prompt)
        answer = response.content.strip() if hasattr(response, 'content') else str(response).strip()
        
        state["generation"] = answer
        state["source"] = source_info
        
        state["conversation_history"].append({'role': 'user', 'content': question})
        state["conversation_history"].append({'role': 'assistant', 'content': answer, 'source': source_info})
        
        print(f"Executor: Generated response from {source_info} (exchange {exchange_count + 1}/{MAX_FOLLOW_UP_EXCHANGES})")
        return state

    # If LLM was successful (final fallback path)
    if state.get("llm_success", False) and state.get("generation"):
        answer = state["generation"]
        state["conversation_history"].append({'role': 'user', 'content': question})
        state["conversation_history"].append({'role': 'assistant', 'content': answer, 'source': source_info})
        print(f"Executor: Using LLM response (exchange {exchange_count + 1}/{MAX_FOLLOW_UP_EXCHANGES})")
        return state

    # Ultimate fallback - provide a helpful answer instead of asking more questions
    if exchange_count >= MAX_FOLLOW_UP_EXCHANGES:
        fallback_response = """Based on the information you've provided, here is my assessment:

SUMMARY
Your symptoms suggest a condition that should be evaluated by a healthcare professional for proper diagnosis and treatment.

WHAT TO DO NOW
1. Schedule an appointment with your primary care physician
2. Keep track of your symptoms, noting any changes or new developments
3. Stay hydrated and get adequate rest

URGENT WARNINGS - Seek Immediate Care If:
- Severe or sudden worsening of symptoms
- Difficulty breathing or chest pain
- High fever that doesn't respond to medication
- Loss of consciousness or confusion

POSSIBLE CONSIDERATIONS
Discuss your complete symptom history with your doctor for an accurate diagnosis. They may recommend tests or imaging to determine the cause.

Remember: I provide general health information only. Please consult a healthcare professional for personalized medical advice."""
    else:
        fallback_response = """Hello. I'm here to help with medical questions.

To better understand your concern, could you tell me:
1. What specific symptoms are you experiencing?
2. When did these symptoms start?

This will help me provide more relevant information. Remember, I provide general health information and not medical diagnoses - please consult a healthcare provider for personalized advice."""
    
    state["generation"] = fallback_response
    state["source"] = "System Message"
    
    state["conversation_history"].append({'role': 'user', 'content': question})
    state["conversation_history"].append({'role': 'assistant', 'content': fallback_response, 'source': 'System Message'})
    
    print(f"Executor: Using fallback response (exchange {exchange_count + 1}/{MAX_FOLLOW_UP_EXCHANGES})")
    return state
