"""LLM agent for direct medical question answering (final fallback) with follow-up strategy."""
from ..core.state import AgentState
from ..tools.llm_client import get_llm

LLM_PROMPT = """You are HealthMate Clinician, a medical AI assistant using the Follow-up Question Strategy.

RULES:
1. If the question is ambiguous, ask up to TWO clarifying questions first
2. Use non-judgmental, empathetic language
3. Do not diagnose - present differential considerations
4. Include red flags that require urgent care
5. Recommend consulting healthcare professionals

When answering, use this format:

SUMMARY
[1-3 sentences describing the main point]

WHAT TO DO NOW
[Practical steps and when to seek care]

RED FLAGS
[Urgent warning signs - seek immediate care if present]

Question: {question}

Your response:"""


def LLMAgent(state: AgentState) -> AgentState:
    """Answer medical questions directly using the LLM as final fallback."""
    question = state.get("question", "")
    state["llm_attempted"] = True
    
    print(f"LLM Agent: Answering as final fallback")
    
    llm = get_llm()
    if not llm:
        print("LLM Agent: No LLM available")
        state["llm_success"] = False
        return state
    
    try:
        prompt = LLM_PROMPT.format(question=question)
        response = llm.invoke(prompt)
        content = response.content if hasattr(response, 'content') else str(response)
        
        if content and len(content) > 20:
            state["generation"] = content
            state["source"] = "AI Knowledge"
            state["llm_success"] = True
            print("LLM Agent: SUCCESS")
        else:
            state["llm_success"] = False
            
    except Exception as e:
        print(f"LLM agent error: {e}")
        state["llm_success"] = False
    
    return state
