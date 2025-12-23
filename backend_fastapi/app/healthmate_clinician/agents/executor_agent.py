"""Executor agent for generating final medical responses with follow-up question strategy."""
from ..core.state import AgentState
from ..tools.llm_client import get_llm

MEDICAL_PROMPT_TEMPLATE = """You are HealthMate Clinician, a medical Q&A assistant using the Follow-up Question Strategy.

BEHAVIOR RULES:

1. CLARIFICATION (if needed):
   - If the question is ambiguous, ask up to TWO targeted follow-up questions
   - Each question should clarify the user's intent
   - Do not ask more than two questions at once

2. ANSWERING:
   - After clarification (or if question is clear), provide a concise, evidence-based answer
   - Use the ANSWER format below
   - Include safety caveats and when to seek urgent care
   - Encourage consulting healthcare professionals for diagnosis/treatment

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

RED FLAGS
[Urgent warning signs and actions - call emergency if present]

POSSIBLE CONSIDERATIONS
[Likely possibilities to discuss with your doctor - NOT a diagnosis]

---

CONVERSATION HISTORY:
{history}

PATIENT'S CURRENT QUESTION: {question}

REFERENCE INFORMATION:
{content}

YOUR RESPONSE (follow the rules above):"""


def ExecutorAgent(state: AgentState) -> AgentState:
    """Generate the final medical response with follow-up question capability."""
    llm = get_llm()
    
    if not llm:
        state["generation"] = "Medical AI service temporarily unavailable. Please consult a healthcare professional."
        state["source"] = "System Message"
        return state
    
    question = state["question"]
    source_info = state.get("source", "Unknown")
    
    # Build conversation context
    history_context = ""
    for item in state.get("conversation_history", [])[-4:]:
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
        
        print(f"Executor: Generated response from {source_info}")
        return state

    # If LLM was successful (final fallback path)
    if state.get("llm_success", False) and state.get("generation"):
        answer = state["generation"]
        state["conversation_history"].append({'role': 'user', 'content': question})
        state["conversation_history"].append({'role': 'assistant', 'content': answer, 'source': source_info})
        print(f"Executor: Using LLM response")
        return state

    # Ultimate fallback
    fallback_response = """Hello. I'm here to help with medical questions.

To better understand your concern, could you tell me:
1. What specific symptoms are you experiencing?
2. When did these symptoms start?

This will help me provide more relevant information. Remember, I provide general health information and not medical diagnoses - please consult a healthcare provider for personalized advice."""
    
    state["generation"] = fallback_response
    state["source"] = "System Message"
    
    state["conversation_history"].append({'role': 'user', 'content': question})
    state["conversation_history"].append({'role': 'assistant', 'content': fallback_response, 'source': 'System Message'})
    
    print("Executor: Using fallback response")
    return state
