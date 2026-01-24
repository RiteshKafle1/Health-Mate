"""Symptom Checker Agent for structured symptom collection with guided questions."""
from typing import Dict, Any, List
from ..core.state import AgentState

# Symptom collection flow - each step has a question and selectable options
SYMPTOM_FLOW = [
    {
        "step": 1,
        "id": "body_area",
        "question": "What body area is primarily affected?",
        "options": [
            "Head/Neck",
            "Chest/Heart",
            "Abdomen/Stomach",
            "Back/Spine",
            "Arms/Hands",
            "Legs/Feet",
            "Skin",
            "General/Full Body"
        ],
        "icon": "🎯"
    },
    {
        "step": 2,
        "id": "severity",
        "question": "How would you describe the intensity of your symptoms?",
        "options": [
            "Mild - Noticeable but not limiting",
            "Moderate - Affects daily activities",
            "Severe - Very difficult to manage",
            "Extreme - Requires immediate attention"
        ],
        "icon": "📊"
    },
    {
        "step": 3,
        "id": "duration",
        "question": "How long have you been experiencing these symptoms?",
        "options": [
            "Just started (within hours)",
            "1-3 days",
            "4-7 days",
            "1-2 weeks",
            "More than 2 weeks",
            "Comes and goes (recurring)"
        ],
        "icon": "⏱️"
    },
    {
        "step": 4,
        "id": "associated_symptoms",
        "question": "Are you experiencing any of these associated symptoms? (Select the most relevant)",
        "options": [
            "Fever/Chills",
            "Fatigue/Weakness",
            "Nausea/Vomiting",
            "Pain/Discomfort",
            "Breathing difficulty",
            "Dizziness/Lightheadedness",
            "Sleep problems",
            "None of these"
        ],
        "icon": "🔍"
    },
    {
        "step": 5,
        "id": "additional_context",
        "question": "Any additional context that might help? (Select one or type your own)",
        "options": [
            "Symptoms worsen at night",
            "Symptoms improve with rest",
            "Taking medication currently",
            "Had similar symptoms before",
            "Recent injury or trauma",
            "No additional context"
        ],
        "icon": "📝"
    }
]


def get_symptom_step(step: int) -> Dict[str, Any]:
    """Get the symptom flow step configuration."""
    if 1 <= step <= len(SYMPTOM_FLOW):
        return SYMPTOM_FLOW[step - 1]
    return None


def format_symptom_question(step_config: Dict[str, Any]) -> str:
    """Format the question for display."""
    icon = step_config.get("icon", "❓")
    question = step_config.get("question", "")
    return f"{icon} {question}"


def generate_symptom_summary(collected_symptoms: List[Dict[str, Any]]) -> str:
    """Generate a formatted summary of collected symptoms."""
    if not collected_symptoms:
        return "No symptoms collected yet."
    
    summary_parts = []
    for symptom in collected_symptoms:
        step_id = symptom.get("id", "unknown")
        response = symptom.get("response", "Not specified")
        
        # Format based on step ID
        labels = {
            "body_area": "🎯 Body Area",
            "severity": "📊 Severity",
            "duration": "⏱️ Duration",
            "associated_symptoms": "🔍 Associated Symptoms",
            "additional_context": "📝 Additional Context"
        }
        label = labels.get(step_id, step_id.replace("_", " ").title())
        summary_parts.append(f"• {label}: {response}")
    
    return "\n".join(summary_parts)


def SymptomCheckerAgent(state: AgentState) -> AgentState:
    """
    Handle symptom checker mode - guide user through structured symptom collection.
    
    Returns follow-up questions with selectable options until all steps are complete,
    then generates a symptom summary for the executor to process.
    """
    current_step = state.get("symptom_checker_step", 0)
    collected = state.get("collected_symptoms", [])
    user_response = state.get("question", "").strip()
    
    # If we have a user response and we're mid-flow, save it
    if user_response and current_step > 0:
        # Get current step config
        step_config = get_symptom_step(current_step)
        if step_config:
            collected.append({
                "step": current_step,
                "id": step_config.get("id"),
                "question": step_config.get("question"),
                "response": user_response
            })
            state["collected_symptoms"] = collected
    
    # Move to next step
    next_step = current_step + 1
    total_steps = len(SYMPTOM_FLOW)
    
    # If we've completed all steps, generate summary for symptom assessment
    if next_step > total_steps:
        symptom_summary = generate_symptom_summary(collected)
        
        # Create a detailed symptom profile for assessment
        symptom_profile = f"""COLLECTED SYMPTOM INFORMATION:
{symptom_summary}

Please analyze these symptoms and provide possible conditions."""
        
        # Set state for symptom assessment agent (NOT generic retriever)
        state["symptom_checker_step"] = 0
        state["symptom_options"] = []
        state["is_follow_up_question"] = False
        state["question"] = symptom_profile
        state["current_tool"] = "symptom_assessment"  # Route to specialized assessment
        state["collected_symptoms"] = []  # Clear for next assessment
        
        print(f"SymptomChecker: Completed all steps, routing to symptom assessment")
        return state
    
    # Get next question
    step_config = get_symptom_step(next_step)
    
    if step_config:
        state["symptom_checker_step"] = next_step
        state["symptom_options"] = step_config.get("options", [])
        state["is_follow_up_question"] = True
        state["total_symptom_steps"] = total_steps
        
        # Generate the follow-up question response
        question_text = format_symptom_question(step_config)
        
        state["generation"] = question_text
        state["source"] = "Symptom Checker"
        
        print(f"SymptomChecker: Step {next_step}/{total_steps} - {step_config.get('id')}")
    
    return state


def start_symptom_checker(state: AgentState) -> AgentState:
    """Initialize the symptom checker flow."""
    state["symptom_checker_mode"] = True
    state["symptom_checker_step"] = 0
    state["collected_symptoms"] = []
    state["symptom_options"] = []
    state["is_follow_up_question"] = False
    state["total_symptom_steps"] = len(SYMPTOM_FLOW)
    
    # Process first step
    return SymptomCheckerAgent(state)


def is_symptom_checker_complete(state: AgentState) -> bool:
    """Check if symptom collection is complete."""
    return state.get("symptom_checker_step", 0) > len(SYMPTOM_FLOW)
