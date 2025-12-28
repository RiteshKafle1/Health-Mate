"""Medication Info Service - AI-powered medication information lookup."""
from typing import Optional, Dict
from ..healthmate_assist.gemini_client import get_gemini_client


# Common medications knowledge base for fallback
COMMON_MEDICATIONS = {
    "amoxicillin": {
        "purpose": "Antibiotic for bacterial infections",
        "instructions": "Take with or without food"
    },
    "paracetamol": {
        "purpose": "Pain relief and fever reducer",
        "instructions": "Take every 4-6 hours as needed"
    },
    "acetaminophen": {
        "purpose": "Pain relief and fever reducer",
        "instructions": "Take every 4-6 hours as needed"
    },
    "ibuprofen": {
        "purpose": "Anti-inflammatory pain reliever",
        "instructions": "Take with food to avoid stomach upset"
    },
    "aspirin": {
        "purpose": "Pain relief, anti-inflammatory",
        "instructions": "Take with food or milk"
    },
    "metformin": {
        "purpose": "Controls blood sugar in diabetes",
        "instructions": "Take with meals"
    },
    "lisinopril": {
        "purpose": "Lowers blood pressure",
        "instructions": "Take at the same time daily"
    },
    "omeprazole": {
        "purpose": "Reduces stomach acid",
        "instructions": "Take before meals"
    },
    "atorvastatin": {
        "purpose": "Lowers cholesterol levels",
        "instructions": "Take once daily at bedtime"
    },
    "metoprolol": {
        "purpose": "Heart and blood pressure medication",
        "instructions": "Take with or after food"
    },
    "amlodipine": {
        "purpose": "Blood pressure medication",
        "instructions": "Take once daily"
    },
    "gabapentin": {
        "purpose": "Treats nerve pain and seizures",
        "instructions": "Take with or without food"
    },
    "levothyroxine": {
        "purpose": "Thyroid hormone replacement",
        "instructions": "Take on empty stomach, morning"
    },
    "losartan": {
        "purpose": "Blood pressure medication",
        "instructions": "Take once or twice daily"
    },
    "prednisone": {
        "purpose": "Anti-inflammatory steroid",
        "instructions": "Take with food; don't stop abruptly"
    },
    "azithromycin": {
        "purpose": "Antibiotic for infections",
        "instructions": "Take on empty stomach or with food"
    },
    "ciprofloxacin": {
        "purpose": "Antibiotic for bacterial infections",
        "instructions": "Avoid dairy, take with water"
    }
}


def get_from_knowledge_base(medication_name: str) -> Optional[Dict[str, str]]:
    """
    Look up medication info from the local knowledge base.
    Returns None if not found.
    """
    name_lower = medication_name.lower().strip()
    
    # Direct match
    if name_lower in COMMON_MEDICATIONS:
        return COMMON_MEDICATIONS[name_lower]
    
    # Partial match (e.g., "amoxicillin 500mg" should match "amoxicillin")
    for med_name, info in COMMON_MEDICATIONS.items():
        if med_name in name_lower or name_lower in med_name:
            return info
    
    return None


async def get_medication_info(medication_name: str) -> Dict[str, str]:
    """
    Get purpose and instructions for a medication.
    
    Strategy:
    1. First try local knowledge base (fast)
    2. If not found, use Gemini AI to generate info
    
    Returns: {"purpose": "...", "instructions": "...", "source": "..."}
    """
    # Try knowledge base first
    kb_result = get_from_knowledge_base(medication_name)
    if kb_result:
        return {
            "purpose": kb_result["purpose"],
            "instructions": kb_result["instructions"],
            "source": "knowledge_base",
            "success": True
        }
    
    # Use Gemini AI
    try:
        gemini = get_gemini_client()
        
        prompt = f"""For the medication "{medication_name}", provide EXACTLY two pieces of information:

1. PURPOSE: What is this medication used for? (Maximum 10 words)
2. INSTRUCTIONS: How should it be taken? (Maximum 10 words)

Format your response EXACTLY like this:
PURPOSE: [brief purpose]
INSTRUCTIONS: [brief instructions]

Be concise and factual. If unsure, provide general guidance."""

        response = gemini.generate_response(
            prompt=prompt,
            system_instruction="You are a helpful pharmacist assistant. Provide accurate, concise medication information. Always keep responses under 10 words per field."
        )
        
        # Parse the response
        purpose = "General medication"
        instructions = "Follow doctor's instructions"
        
        lines = response.strip().split("\n")
        for line in lines:
            line = line.strip()
            if line.upper().startswith("PURPOSE:"):
                purpose = line.split(":", 1)[1].strip()[:50]  # Limit length
            elif line.upper().startswith("INSTRUCTIONS:"):
                instructions = line.split(":", 1)[1].strip()[:50]
        
        return {
            "purpose": purpose,
            "instructions": instructions,
            "source": "ai_generated",
            "success": True
        }
        
    except Exception as e:
        # Fallback response if AI fails
        return {
            "purpose": "Prescribed medication",
            "instructions": "Follow doctor's instructions",
            "source": "fallback",
            "success": True,
            "error": str(e)
        }
