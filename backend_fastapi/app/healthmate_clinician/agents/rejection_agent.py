"""Rejection agent for non-medical queries."""
from ..core.state import AgentState

REJECTION_MESSAGE = """I'm HealthMate Clinician, and I'm specifically designed to help with medical and health-related questions only.

I noticed your question doesn't seem to be about health or medical topics. I'm here to assist with:
- Health symptoms and conditions
- Medical information and treatments
- Wellness and lifestyle health advice
- Understanding medical terms
- Mental health support

**Please feel free to ask me any health-related question, and I'll do my best to help!**

*Reminder: I provide general health information only. For medical advice, diagnosis, or treatment, please consult a qualified healthcare professional.*"""


def RejectionAgent(state: AgentState) -> AgentState:
    """Handle non-medical queries with a polite rejection."""
    state["generation"] = REJECTION_MESSAGE
    state["source"] = "System Message"
    
    # Still add to conversation history
    question = state.get("question", "")
    state["conversation_history"].append({
        'role': 'user',
        'content': question
    })
    state["conversation_history"].append({
        'role': 'assistant',
        'content': REJECTION_MESSAGE,
        'source': 'System Message'
    })
    
    print(f"Rejection Agent: Rejected non-medical query")
    return state
