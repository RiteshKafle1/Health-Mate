from langgraph.graph import StateGraph, END

from .state import LabReportState
from .nodes import verify_node, interpret_node, enrich_node, validate_node, finalize_node

def should_interpret(state: LabReportState):
    """Conditional edge: Proceed to interpret only if verification passed."""
    if state.get("error"):
        return END
    return "interpret_node"

def should_enrich(state: LabReportState):
    """Conditional edge: Proceed to enrich if interpretation succeeded."""
    if state.get("error"):
        return END
    return "enrich_node"

def should_validate(state: LabReportState):
    """Conditional edge: Proceed to validate after enrichment."""
    if state.get("error"):
        return END
    return "validate_node"

def should_finalize(state: LabReportState):
    """Conditional edge: Proceed to finalize only if validation loop done (currently linear)."""
    if state.get("error"):
        return END
    return "finalize_node"

# Define the graph
workflow = StateGraph(LabReportState)

# Add nodes
workflow.add_node("verify_node", verify_node)
workflow.add_node("interpret_node", interpret_node)
# workflow.add_node("enrich_node", enrich_node) # Removed for lazy loading
workflow.add_node("validate_node", validate_node)
workflow.add_node("finalize_node", finalize_node)

# Add edges
workflow.set_entry_point("verify_node")

workflow.add_conditional_edges(
    "verify_node",
    should_interpret,
    {
        "interpret_node": "interpret_node",
        END: END
    }
)

# Skip enrichment, go straight to validation
workflow.add_conditional_edges(
    "interpret_node",
    should_validate, # Changed from should_enrich to should_validate logic
    {
        "validate_node": "validate_node",
        END: END
    }
)

workflow.add_conditional_edges(
    "validate_node",
    should_finalize,
    {
        "finalize_node": "finalize_node",
        END: END
    }
)

workflow.add_edge("finalize_node", END)

# Compile the graph
app = workflow.compile()
