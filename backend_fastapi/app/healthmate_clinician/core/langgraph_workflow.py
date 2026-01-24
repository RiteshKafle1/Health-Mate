"""LangGraph workflow definition for HealthMate Clinician multi-agent system."""
from langgraph.graph import StateGraph, END
from .state import AgentState
from ..agents.memory_agent import MemoryAgent
from ..agents.planner_agent import PlannerAgent
from ..agents.llm_agent import LLMAgent
from ..agents.retriever_agent import RetrieverAgent
from ..agents.wikipedia_agent import WikipediaAgent
from ..agents.tavily_agent import TavilyAgent
from ..agents.executor_agent import ExecutorAgent
from ..agents.rejection_agent import RejectionAgent


def route_after_planner(state: AgentState) -> str:
    """Route after planner - either reject or go to retriever."""
    tool = state.get("current_tool", "retriever")
    if tool == "reject_non_medical":
        return "rejection"
    else:
        return "retriever"


def route_after_rag(state: AgentState) -> str:
    """Route after RAG retriever based on success."""
    if state.get("rag_success", False):
        print("Workflow: RAG succeeded -> Executor")
        return "executor"
    else:
        print("Workflow: RAG failed -> Wikipedia")
        return "wikipedia"


def route_after_wiki(state: AgentState) -> str:
    """Route after Wikipedia agent based on success."""
    if state.get("wiki_success", False):
        print("Workflow: Wikipedia succeeded -> Executor")
        return "executor"
    else:
        print("Workflow: Wikipedia failed -> Tavily")
        return "tavily"


def route_after_tavily(state: AgentState) -> str:
    """Route after Tavily agent based on success."""
    if state.get("tavily_success", False):
        print("Workflow: Tavily succeeded -> Executor")
        return "executor"
    else:
        print("Workflow: Tavily failed -> LLM (final fallback)")
        return "llm_agent"


def route_after_llm(state: AgentState) -> str:
    """Route after LLM agent - always go to executor."""
    print("Workflow: LLM completed -> Executor")
    return "executor"


def create_workflow():
    """
    Create and compile the LangGraph workflow.
    
    Flow:
    Memory -> Planner -> [Rejection] -> END
                      -> Retriever -> [if success] -> Executor -> END
                                   -> [if fail] -> Wikipedia -> [if success] -> Executor
                                                            -> [if fail] -> Tavily -> [if success] -> Executor
                                                                                   -> [if fail] -> LLM -> Executor -> END
    """
    workflow = StateGraph(AgentState)
    
    # Add nodes
    workflow.add_node("memory", MemoryAgent)
    workflow.add_node("planner", PlannerAgent)
    workflow.add_node("retriever", RetrieverAgent)
    workflow.add_node("wikipedia", WikipediaAgent)
    workflow.add_node("tavily", TavilyAgent)
    workflow.add_node("llm_agent", LLMAgent)
    workflow.add_node("executor", ExecutorAgent)
    workflow.add_node("rejection", RejectionAgent)
    
    # Set entry point
    workflow.set_entry_point("memory")
    
    # Add edges
    workflow.add_edge("memory", "planner")
    
    # After planner: route to retriever or rejection
    workflow.add_conditional_edges(
        "planner",
        route_after_planner,
        {
            "retriever": "retriever",
            "rejection": "rejection"
        }
    )
    
    # After RAG: go to executor if success, else try Wikipedia
    workflow.add_conditional_edges(
        "retriever",
        route_after_rag,
        {
            "executor": "executor",
            "wikipedia": "wikipedia"
        }
    )
    
    # After Wikipedia: go to executor if success, else try Tavily
    workflow.add_conditional_edges(
        "wikipedia",
        route_after_wiki,
        {
            "executor": "executor",
            "tavily": "tavily"
        }
    )
    
    # After Tavily: go to executor if success, else try LLM (final fallback)
    workflow.add_conditional_edges(
        "tavily",
        route_after_tavily,
        {
            "executor": "executor",
            "llm_agent": "llm_agent"
        }
    )
    
    # After LLM: always go to executor
    workflow.add_conditional_edges(
        "llm_agent",
        route_after_llm,
        {
            "executor": "executor"
        }
    )
    
    # Rejection goes directly to END
    workflow.add_edge("rejection", END)
    
    # Executor goes to END
    workflow.add_edge("executor", END)
    
    return workflow.compile()
