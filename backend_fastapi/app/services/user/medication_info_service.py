"""Medication Info Service - Multi-source medication information lookup."""
from typing import Optional, Dict
import httpx
import os
from ...healthmate_assist.gemini_client import get_gemini_client


# Common medications knowledge base for fast lookup
COMMON_MEDICATIONS = {
    "amoxicillin": {
        "purpose": "Antibiotic for bacterial infections",
        "instructions": "Take with or without food; complete full course"
    },
    "paracetamol": {
        "purpose": "Pain relief and fever reducer",
        "instructions": "Take every 4-6 hours as needed; max 4g/day"
    },
    "acetaminophen": {
        "purpose": "Pain relief and fever reducer",
        "instructions": "Take every 4-6 hours as needed; max 4g/day"
    },
    "ibuprofen": {
        "purpose": "Anti-inflammatory pain reliever (NSAID)",
        "instructions": "Take with food to avoid stomach upset"
    },
    "aspirin": {
        "purpose": "Pain relief, anti-inflammatory, blood thinner",
        "instructions": "Take with food or milk; avoid if allergic"
    },
    "metformin": {
        "purpose": "Controls blood sugar in type 2 diabetes",
        "instructions": "Take with meals to reduce stomach upset"
    },
    "lisinopril": {
        "purpose": "Lowers blood pressure (ACE inhibitor)",
        "instructions": "Take at the same time daily; avoid potassium supplements"
    },
    "omeprazole": {
        "purpose": "Reduces stomach acid (PPI)",
        "instructions": "Take 30 minutes before first meal of day"
    },
    "atorvastatin": {
        "purpose": "Lowers cholesterol (statin)",
        "instructions": "Take once daily, preferably at bedtime"
    },
    "metoprolol": {
        "purpose": "Heart rate and blood pressure control (beta-blocker)",
        "instructions": "Take with food; do not stop suddenly"
    },
    "amlodipine": {
        "purpose": "Blood pressure medication (calcium blocker)",
        "instructions": "Take once daily with or without food"
    },
    "gabapentin": {
        "purpose": "Treats nerve pain and seizures",
        "instructions": "Take with or without food; do not stop abruptly"
    },
    "levothyroxine": {
        "purpose": "Thyroid hormone replacement",
        "instructions": "Take on empty stomach, 30-60 min before food"
    },
    "losartan": {
        "purpose": "Blood pressure medication (ARB)",
        "instructions": "Take once or twice daily; avoid potassium"
    },
    "prednisone": {
        "purpose": "Anti-inflammatory steroid",
        "instructions": "Take with food; never stop abruptly"
    },
    "azithromycin": {
        "purpose": "Antibiotic for respiratory/skin infections",
        "instructions": "Take on empty stomach or with food; complete course"
    },
    "ciprofloxacin": {
        "purpose": "Antibiotic for bacterial infections",
        "instructions": "Avoid dairy products; drink plenty of water"
    },
    "sertraline": {
        "purpose": "Antidepressant (SSRI) for depression/anxiety",
        "instructions": "Take once daily; may take weeks to work"
    },
    "pantoprazole": {
        "purpose": "Reduces stomach acid (PPI)",
        "instructions": "Take before breakfast; swallow whole"
    },
    "montelukast": {
        "purpose": "Prevents asthma and allergy symptoms",
        "instructions": "Take once daily in evening"
    }
}


def get_from_knowledge_base(medication_name: str) -> Optional[Dict[str, str]]:
    """Look up medication info from the local knowledge base."""
    name_lower = medication_name.lower().strip()
    
    # Direct match
    if name_lower in COMMON_MEDICATIONS:
        return COMMON_MEDICATIONS[name_lower]
    
    # Partial match (e.g., "amoxicillin 500mg" should match "amoxicillin")
    for med_name, info in COMMON_MEDICATIONS.items():
        if med_name in name_lower or name_lower in med_name:
            return info
    
    return None


async def fetch_from_openfda(medication_name: str) -> Optional[Dict[str, str]]:
    """
    Fetch medication info from OpenFDA API.
    Free API, no key required.
    
    Returns: {"purpose": "...", "instructions": "..."} or None
    """
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            # Search by brand name first, then generic name
            url = f"https://api.fda.gov/drug/label.json?search=openfda.brand_name:{medication_name}+openfda.generic_name:{medication_name}&limit=1"
            
            response = await client.get(url)
            
            if response.status_code == 200:
                data = response.json()
                if data.get("results"):
                    result = data["results"][0]
                    
                    # Extract purpose (indications_and_usage)
                    purpose = None
                    if "indications_and_usage" in result:
                        raw = result["indications_and_usage"][0]
                        # Extract first sentence, limit to ~15 words
                        purpose = raw.split(".")[0][:100].strip()
                    elif "purpose" in result:
                        purpose = result["purpose"][0][:100].strip()
                    
                    # Extract instructions (dosage_and_administration)
                    instructions = None
                    if "dosage_and_administration" in result:
                        raw = result["dosage_and_administration"][0]
                        # Extract first sentence
                        instructions = raw.split(".")[0][:100].strip()
                    elif "warnings" in result:
                        # Fallback to warnings for important info
                        instructions = result["warnings"][0].split(".")[0][:100].strip()
                    
                    if purpose or instructions:
                        return {
                            "purpose": purpose or "See prescription label",
                            "instructions": instructions or "Follow doctor's instructions"
                        }
    except Exception as e:
        print(f"OpenFDA fetch error: {e}")
    
    return None


async def fetch_from_tavily(medication_name: str, field: str = "both") -> Optional[Dict[str, str]]:
    """
    Search for medication info using Tavily web search.
    Searches medical sites: Mayo Clinic, WebMD, Drugs.com, etc.
    
    Args:
        medication_name: Name of the medication
        field: "purpose", "instructions", or "both"
    
    Returns: {"purpose": "...", "instructions": "..."} or None
    """
    tavily_key = os.getenv("TAVILY_API_KEY")
    if not tavily_key:
        return None
    
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            # Craft specific search query
            if field == "purpose":
                query = f"What is {medication_name} used for medical purpose indications"
            elif field == "instructions":
                query = f"How to take {medication_name} dosage instructions administration"
            else:
                query = f"{medication_name} medication uses dosage instructions"
            
            response = await client.post(
                "https://api.tavily.com/search",
                json={
                    "api_key": tavily_key,
                    "query": query,
                    "search_depth": "basic",
                    "include_answer": True,
                    "include_domains": [
                        "mayoclinic.org",
                        "webmd.com",
                        "drugs.com",
                        "medlineplus.gov",
                        "rxlist.com"
                    ],
                    "max_results": 3
                }
            )
            
            if response.status_code == 200:
                data = response.json()
                
                # Use Tavily's answer if available
                if data.get("answer"):
                    answer = data["answer"]
                    
                    # Parse based on field
                    if field == "purpose":
                        return {"purpose": answer[:150], "instructions": None}
                    elif field == "instructions":
                        return {"purpose": None, "instructions": answer[:150]}
                    else:
                        # Try to split into purpose and instructions
                        return {
                            "purpose": answer[:100],
                            "instructions": "Follow prescribed dosage"
                        }
                        
                # Fallback to first result content
                if data.get("results"):
                    content = data["results"][0].get("content", "")[:200]
                    if content:
                        return {
                            "purpose": content if field != "instructions" else None,
                            "instructions": content if field != "purpose" else None
                        }
    
    except Exception as e:
        print(f"Tavily fetch error: {e}")
    
    return None


async def generate_with_ai(medication_name: str, field: str = "both") -> Dict[str, str]:
    """
    Generate medication info using Gemini AI.
    Used as last resort when other sources fail.
    """
    try:
        gemini = get_gemini_client()
        
        if field == "purpose":
            prompt = f"""For the medication "{medication_name}", provide its PRIMARY PURPOSE.
What medical condition is this medication used to treat?
Keep response under 15 words. Be factual and concise.
Format: Just the purpose, no labels."""
        elif field == "instructions":
            prompt = f"""For the medication "{medication_name}", provide BASIC INSTRUCTIONS.
How should this medication be taken? Include timing, food interactions.
Keep response under 15 words. Be factual and concise.
Format: Just the instructions, no labels."""
        else:
            prompt = f"""For the medication "{medication_name}", provide:
1. PURPOSE: What is this medication used for? (under 15 words)
2. INSTRUCTIONS: How should it be taken? (under 15 words)

Format EXACTLY like:
PURPOSE: [purpose here]
INSTRUCTIONS: [instructions here]

Be factual and medically accurate."""

        response = gemini.generate_response(
            prompt=prompt,
            system_instruction="You are a clinical pharmacist. Provide accurate, evidence-based medication information. Be concise."
        )
        
        if field == "purpose":
            return {"purpose": response.strip()[:100], "instructions": None}
        elif field == "instructions":
            return {"purpose": None, "instructions": response.strip()[:100]}
        else:
            # Parse both fields
            purpose = "Prescribed medication"
            instructions = "Follow doctor's instructions"
            
            lines = response.strip().split("\n")
            for line in lines:
                line = line.strip()
                if line.upper().startswith("PURPOSE:"):
                    purpose = line.split(":", 1)[1].strip()[:100]
                elif line.upper().startswith("INSTRUCTIONS:"):
                    instructions = line.split(":", 1)[1].strip()[:100]
            
            return {"purpose": purpose, "instructions": instructions}
            
    except Exception as e:
        return {
            "purpose": "Prescribed medication" if field != "instructions" else None,
            "instructions": "Follow doctor's instructions" if field != "purpose" else None,
            "error": str(e)
        }


async def get_medication_info(
    medication_name: str,
    field: str = "both"  # "purpose" | "instructions" | "both"
) -> Dict[str, str]:
    """
    Get purpose and/or instructions for a medication.
    
    Multi-source lookup strategy (priority order):
    1. Local knowledge base (instant)
    2. OpenFDA API (authoritative, FDA-approved)
    3. Tavily web search (medical sites)
    4. Gemini AI (last resort)
    
    Args:
        medication_name: Name of the medication
        field: Which field to fetch - "purpose", "instructions", or "both"
    
    Returns: {
        "purpose": "...",
        "instructions": "...",
        "source": "knowledge_base" | "openfda" | "tavily" | "ai_generated",
        "success": True
    }
    """
    result = {
        "purpose": None,
        "instructions": None,
        "source": None,
        "success": True
    }
    
    # 1. Try local knowledge base first (fastest)
    kb_result = get_from_knowledge_base(medication_name)
    if kb_result:
        if field == "both":
            result["purpose"] = kb_result["purpose"]
            result["instructions"] = kb_result["instructions"]
        elif field == "purpose":
            result["purpose"] = kb_result["purpose"]
        else:
            result["instructions"] = kb_result["instructions"]
        result["source"] = "knowledge_base"
        return result
    
    # 2. Try OpenFDA API
    fda_result = await fetch_from_openfda(medication_name)
    if fda_result:
        if field == "both":
            result["purpose"] = fda_result.get("purpose")
            result["instructions"] = fda_result.get("instructions")
        elif field == "purpose" and fda_result.get("purpose"):
            result["purpose"] = fda_result["purpose"]
        elif field == "instructions" and fda_result.get("instructions"):
            result["instructions"] = fda_result["instructions"]
        
        if result["purpose"] or result["instructions"]:
            result["source"] = "openfda"
            return result
    
    # 3. Try Tavily web search
    tavily_result = await fetch_from_tavily(medication_name, field)
    if tavily_result:
        if field == "both":
            result["purpose"] = tavily_result.get("purpose")
            result["instructions"] = tavily_result.get("instructions")
        elif field == "purpose" and tavily_result.get("purpose"):
            result["purpose"] = tavily_result["purpose"]
        elif field == "instructions" and tavily_result.get("instructions"):
            result["instructions"] = tavily_result["instructions"]
        
        if result["purpose"] or result["instructions"]:
            result["source"] = "tavily"
            return result
    
    # 4. Fallback to AI generation
    ai_result = await generate_with_ai(medication_name, field)
    if field == "both":
        result["purpose"] = ai_result.get("purpose", "Prescribed medication")
        result["instructions"] = ai_result.get("instructions", "Follow doctor's instructions")
    elif field == "purpose":
        result["purpose"] = ai_result.get("purpose", "Prescribed medication")
    else:
        result["instructions"] = ai_result.get("instructions", "Follow doctor's instructions")
    
    result["source"] = "ai_generated"
    return result
