"""Memory agent for conversation history management."""
from ..core.state import AgentState


def MemoryAgent(state: AgentState) -> AgentState:
    """Manage conversation memory - currently passes through."""
    # Memory is already maintained in conversation_history
    # This agent can be extended for memory summarization, etc.
    return state
