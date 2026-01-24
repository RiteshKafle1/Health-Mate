"""Planner agent for routing queries - optimized for speed using keyword matching."""
from ..core.state import AgentState
import re

# Non-medical keywords and patterns (fast keyword-based filtering)
NON_MEDICAL_PATTERNS = [
    # Sports
    r'\b(football|soccer|basketball|cricket|tennis|golf|olympics|world cup|nfl|nba|fifa)\b',
    # Entertainment
    r'\b(movie|film|actor|actress|celebrity|netflix|spotify|music|song|album|concert)\b',
    # Politics
    r'\b(election|president|minister|parliament|congress|vote|political|government)\b',
    # Tech (non-health)
    r'\b(iphone|android|laptop|computer|software|programming|code|javascript|python)\b',
    # Weather/Geography
    r'\b(weather|temperature|rain|snow|forecast|climate|country|city|travel)\b',
    # Finance
    r'\b(stock|bitcoin|crypto|investment|trading|market|price)\b',
    # Gaming
    r'\b(game|gaming|xbox|playstation|nintendo|fortnite|minecraft)\b',
    # Food (non-health context)
    r'\b(recipe|cooking|restaurant|chef|cuisine)\b',
]

# Compile patterns for speed
NON_MEDICAL_REGEX = re.compile('|'.join(NON_MEDICAL_PATTERNS), re.IGNORECASE)

# Medical keywords (quick positive match)
MEDICAL_KEYWORDS = {
    'symptom', 'symptoms', 'pain', 'ache', 'fever', 'cold', 'flu', 'cough',
    'headache', 'nausea', 'vomiting', 'diarrhea', 'fatigue', 'tired',
    'doctor', 'hospital', 'medicine', 'medication', 'drug', 'pill', 'tablet',
    'disease', 'condition', 'diagnosis', 'treatment', 'therapy', 'cure',
    'health', 'healthy', 'wellness', 'medical', 'clinical', 'patient',
    'blood', 'heart', 'lung', 'liver', 'kidney', 'brain', 'stomach',
    'diabetes', 'cancer', 'asthma', 'allergy', 'infection', 'virus', 'bacteria',
    'vaccine', 'vaccination', 'immunization', 'covid', 'coronavirus',
    'anxiety', 'depression', 'stress', 'mental', 'sleep', 'insomnia',
    'pregnant', 'pregnancy', 'baby', 'child', 'vitamin', 'supplement',
    'exercise', 'diet', 'weight', 'obesity', 'nutrition', 'calorie',
    'skin', 'rash', 'itch', 'swelling', 'inflammation', 'injury', 'wound',
    'surgery', 'operation', 'procedure', 'test', 'scan', 'xray', 'mri',
}


def PlannerAgent(state: AgentState) -> AgentState:
    """
    Fast keyword-based routing (no LLM call needed).
    
    This eliminates 1-2 seconds of latency per query.
    """
    question = state.get("question", "").lower()
    
    # Quick check: if contains clear medical keywords, route to retriever
    words = set(re.findall(r'\w+', question))
    if words & MEDICAL_KEYWORDS:
        state["current_tool"] = "retriever"
        return state
    
    # Check for non-medical patterns
    if NON_MEDICAL_REGEX.search(question):
        state["current_tool"] = "reject_non_medical"
        return state
    
    # Default: assume medical (better to be safe)
    state["current_tool"] = "retriever"
    return state
