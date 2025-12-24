"""Symptom Assessment Agent - Generates disease predictions from collected symptoms."""
from ..core.state import AgentState
from ..tools.llm_client import get_llm

# Specialized prompt for symptom-to-disease assessment
SYMPTOM_ASSESSMENT_PROMPT = """You are HealthMate Clinician's Symptom Assessment Module.

Your task is to analyze the patient's symptoms and provide a STRUCTURED DIFFERENTIAL DIAGNOSIS.

IMPORTANT RULES:
1. You MUST provide possible conditions based on the symptoms - do not ask for more information
2. Rank conditions by likelihood (Most Likely → Less Likely)
3. Always include red flags and when to seek emergency care
4. Be specific about each condition's typical presentation
5. Include recommended next steps for each possibility

PATIENT SYMPTOM PROFILE:
{symptom_summary}

---

PROVIDE YOUR ASSESSMENT IN THIS EXACT FORMAT:

🔍 SYMPTOM ANALYSIS
Based on your symptoms of [summarize key symptoms], here is my assessment:

📊 POSSIBLE CONDITIONS (ranked by likelihood):

1. [MOST LIKELY] [Condition Name]
   • Why it fits: [2-3 reasons based on their symptoms]
   • Typical duration: [how long it usually lasts]
   • Self-care: [what they can do at home]

2. [LIKELY] [Condition Name]
   • Why it fits: [2-3 reasons]
   • Typical duration: [duration]
   • Self-care: [home remedies]

3. [POSSIBLE] [Condition Name]
   • Why it fits: [reasons]
   • When to suspect: [distinguishing features]

🚨 RED FLAGS - Seek Immediate Care If:
• [Specific warning sign 1]
• [Specific warning sign 2]
• [Specific warning sign 3]

💊 RECOMMENDED NEXT STEPS:
1. [Immediate action they should take]
2. [When to see a doctor]
3. [What tests might be needed]

⏰ WHEN TO SEE A DOCTOR:
• [Specific timeline based on their severity]

---

Remember: This is general health information to discuss with a healthcare provider, not a medical diagnosis."""


def SymptomAssessmentAgent(state: AgentState) -> AgentState:
    """
    Generate a detailed symptom assessment with disease predictions.
    
    This is called after symptom collection is complete to provide
    a structured differential diagnosis.
    """
    llm = get_llm()
    
    if not llm:
        state["generation"] = "Symptom assessment service temporarily unavailable. Please consult a healthcare professional."
        state["source"] = "System Error"
        return state
    
    # Get the symptom summary from the question
    symptom_summary = state.get("question", "")
    
    # Generate the assessment using the specialized prompt
    prompt = SYMPTOM_ASSESSMENT_PROMPT.format(symptom_summary=symptom_summary)
    
    try:
        response = llm.invoke(prompt)
        answer = response.content.strip() if hasattr(response, 'content') else str(response).strip()
        
        state["generation"] = answer
        state["source"] = "Symptom Assessment"
        
        # Add to conversation history
        state["conversation_history"].append({'role': 'user', 'content': symptom_summary})
        state["conversation_history"].append({'role': 'assistant', 'content': answer, 'source': 'Symptom Assessment'})
        
        print("SymptomAssessment: Generated differential diagnosis")
        
    except Exception as e:
        print(f"SymptomAssessment error: {e}")
        state["generation"] = "Unable to complete symptom assessment. Please try again or consult a healthcare provider."
        state["source"] = "System Error"
    
    return state
