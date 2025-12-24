"""Agent state definitions for the LangGraph workflow."""
from typing import TypedDict, List, Optional
from langchain.schema import Document


class AgentState(TypedDict):
    """State object passed between agents in the workflow."""
    question: str
    documents: List[Document]
    generation: str
    source: str
    search_query: Optional[str]
    conversation_history: List[dict]
    llm_attempted: bool
    llm_success: bool
    rag_attempted: bool
    rag_success: bool
    wiki_attempted: bool
    wiki_success: bool
    tavily_attempted: bool
    tavily_success: bool
    current_tool: Optional[str]
    retry_count: int
    # Symptom Checker Mode fields
    symptom_checker_mode: bool
    symptom_checker_step: int
    collected_symptoms: List[dict]
    symptom_options: List[str]
    is_follow_up_question: bool
    total_symptom_steps: int


def initialize_conversation_state() -> dict:
    """Initialize a fresh conversation state."""
    return {
        "question": "",
        "documents": [],
        "generation": "",
        "source": "",
        "search_query": None,
        "conversation_history": [],
        "llm_attempted": False,
        "llm_success": False,
        "rag_attempted": False,
        "rag_success": False,
        "wiki_attempted": False,
        "wiki_success": False,
        "tavily_attempted": False,
        "tavily_success": False,
        "current_tool": None,
        "retry_count": 0,
        # Symptom Checker Mode fields
        "symptom_checker_mode": False,
        "symptom_checker_step": 0,
        "collected_symptoms": [],
        "symptom_options": [],
        "is_follow_up_question": False,
        "total_symptom_steps": 5
    }


def reset_query_state(state: AgentState) -> AgentState:
    """Reset state for new query while preserving conversation history and symptom data."""
    # Preserve symptom checker state during reset
    symptom_mode = state.get("symptom_checker_mode", False)
    symptom_step = state.get("symptom_checker_step", 0)
    collected = state.get("collected_symptoms", [])
    
    state.update({
        "question": "",
        "documents": [],
        "generation": "",
        "source": "",
        "search_query": None,
        "llm_attempted": False,
        "llm_success": False,
        "rag_attempted": False,
        "rag_success": False,
        "wiki_attempted": False,
        "wiki_success": False,
        "tavily_attempted": False,
        "tavily_success": False,
        "current_tool": None,
        "retry_count": 0,
        # Preserve symptom checker state
        "symptom_checker_mode": symptom_mode,
        "symptom_checker_step": symptom_step,
        "collected_symptoms": collected,
        "symptom_options": [],
        "is_follow_up_question": False,
        "total_symptom_steps": 5
    })
    return state


def reset_symptom_checker_state(state: AgentState) -> AgentState:
    """Reset symptom checker state to start fresh."""
    state.update({
        "symptom_checker_mode": False,
        "symptom_checker_step": 0,
        "collected_symptoms": [],
        "symptom_options": [],
        "is_follow_up_question": False,
        "total_symptom_steps": 5
    })
    return state
