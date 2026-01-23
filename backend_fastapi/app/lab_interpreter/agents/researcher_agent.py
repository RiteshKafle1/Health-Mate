"""
Biomarker Researcher Agent
==========================
Multi-source research pipeline for biomarker information.

Strategy (Priority Order):
1. Wikipedia API (Free, high accuracy)
2. Tavily Web Search (Low cost, medical focus)
3. DuckDuckGo (Free backup)
4. Direct LLM (Always available)
"""
import os
import json
import logging
import httpx
from typing import Dict, List, Optional

import google.generativeai as genai
from app.core.config import settings
from app.core.redis import get_redis

logger = logging.getLogger(__name__)

# Redis cache settings
BIOMARKER_CACHE_PREFIX = "biomarker_enrichment:"
BIOMARKER_CACHE_TTL = 7 * 24 * 60 * 60  # 7 days


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def extract_first_sentences(text: str, num_sentences: int = 3) -> str:
    """
    Extract the first N sentences from text.
    Handles common abbreviations to avoid false sentence breaks.
    """
    import re
    
    # Clean up the text
    text = text.strip()
    
    # Split by sentence-ending punctuation followed by space and capital letter
    # This pattern tries to avoid splitting on abbreviations like "Dr." or "e.g."
    sentences = re.split(r'(?<=[.!?])\s+(?=[A-Z])', text)
    
    # Get first N sentences
    result = ' '.join(sentences[:num_sentences])
    
    # Ensure it ends with proper punctuation
    if result and result[-1] not in '.!?':
        result += '.'
    
    return result


# ============================================================================
# CACHING LAYER
# ============================================================================

async def get_redis_cache(biomarker_name: str) -> Optional[Dict]:
    """Check Redis cache for biomarker info."""
    try:
        redis = get_redis()
        if not redis:
            return None
        
        key = f"{BIOMARKER_CACHE_PREFIX}{biomarker_name.lower()}"
        cached = await redis.get(key)
        if cached:
            logger.info(f"[Enrichment] Redis HIT: {biomarker_name}")
            return json.loads(cached)
    except Exception as e:
        logger.warning(f"Redis get error: {e}")
    return None


async def set_redis_cache(biomarker_name: str, data: Dict):
    """Save biomarker info to Redis with TTL."""
    try:
        redis = get_redis()
        if not redis:
            return
        
        key = f"{BIOMARKER_CACHE_PREFIX}{biomarker_name.lower()}"
        await redis.setex(key, BIOMARKER_CACHE_TTL, json.dumps(data))
        logger.info(f"[Enrichment] Cached: {biomarker_name} (TTL: 7 days)")
    except Exception as e:
        logger.warning(f"Redis set error: {e}")


# ============================================================================
# STRATEGY 1: WIKIPEDIA API (Free, Reliable)
# ============================================================================

async def research_with_wikipedia(biomarker_name: str) -> Optional[Dict[str, str]]:
    """
    Fetch biomarker info from Wikipedia API.
    Uses LLM to refine raw content into structured format.
    """
    try:
        search_url = "https://en.wikipedia.org/w/api.php"
        search_params = {
            "action": "opensearch",
            "search": biomarker_name,
            "limit": 1,
            "namespace": 0,
            "format": "json"
        }
        
        headers = {"User-Agent": "HealthMate/1.0 (healthmate@example.com)"}
        
        async with httpx.AsyncClient(headers=headers, follow_redirects=True, timeout=10.0) as client:
            # Step 1: Search for the term
            search_resp = await client.get(search_url, params=search_params)
            search_data = search_resp.json()
            
            if not search_data or len(search_data) < 4 or not search_data[1]:
                logger.info(f"Wikipedia: No results for {biomarker_name}")
                return None
            
            page_title = search_data[1][0]
            page_url = search_data[3][0]
            
            # Step 2: Get page extract
            summary_params = {
                "action": "query",
                "format": "json",
                "prop": "extracts",
                "titles": page_title,
                "exintro": 1,
                "explaintext": 1,
                "redirects": 1
            }
            
            summary_resp = await client.get(search_url, params=summary_params)
            summary_data = summary_resp.json()
            
            pages = summary_data.get("query", {}).get("pages", {})
            page_content = list(pages.values())[0].get("extract", "")
            
            if not page_content or len(page_content) < 50:
                return None
            
            # Step 3: Refine with LLM (always try)
            refined = await refine_content_with_llm(biomarker_name, page_content[:2000])
            if refined:
                refined["source_url"] = page_url
                logger.info(f"[Enrichment] Wikipedia SUCCESS: {biomarker_name}")
                return refined
            
            # Fallback: Extract first 3 sentences + generate basic significance
            first_sentences = extract_first_sentences(page_content, 3)
            return {
                "summary": first_sentences,
                "clinical_significance": f"Abnormal {biomarker_name} levels may indicate health issues. Consult your healthcare provider for proper interpretation of your results.",
                "source_url": page_url
            }
            
    except Exception as e:
        logger.error(f"Wikipedia error for {biomarker_name}: {e}")
        return None


# ============================================================================
# STRATEGY 2: TAVILY WEB SEARCH (Medical Focus)
# ============================================================================

async def research_with_tavily(biomarker_name: str) -> Optional[Dict[str, str]]:
    """
    Search for biomarker info using Tavily API.
    Focuses on medical domains for reliable information.
    """
    tavily_key = os.getenv("TAVILY_API_KEY")
    if not tavily_key:
        logger.debug("Tavily: API key not configured, skipping")
        return None
    
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            query = f"{biomarker_name} biomarker medical definition clinical significance"
            
            response = await client.post(
                "https://api.tavily.com/search",
                json={
                    "api_key": tavily_key,
                    "query": query,
                    "search_depth": "basic",
                    "include_answer": True,
                    "include_domains": [
                        "wikipedia.org",
                        "mayoclinic.org",
                        "medlineplus.gov",
                        "ncbi.nlm.nih.gov",
                        "clevelandclinic.org"
                    ],
                    "max_results": 3
                }
            )
            
            if response.status_code != 200:
                return None
            
            data = response.json()
            
            # Extract content
            raw_content = None
            source_url = None
            
            if data.get("answer"):
                raw_content = data["answer"]
            elif data.get("results"):
                raw_content = data["results"][0].get("content", "")
                source_url = data["results"][0].get("url")
            
            if raw_content:
                refined = await refine_content_with_llm(biomarker_name, raw_content)
                if refined:
                    refined["source_url"] = source_url
                    logger.info(f"[Enrichment] Tavily SUCCESS: {biomarker_name}")
                    return refined
                    
    except Exception as e:
        logger.error(f"Tavily error for {biomarker_name}: {e}")
    
    return None


# ============================================================================
# STRATEGY 3: DUCKDUCKGO (Free Backup)
# ============================================================================

async def research_with_duckduckgo(biomarker_name: str) -> Optional[Dict[str, str]]:
    """
    Free web search fallback using DuckDuckGo instant answers.
    """
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            # DuckDuckGo Instant Answer API
            response = await client.get(
                "https://api.duckduckgo.com/",
                params={
                    "q": f"{biomarker_name} biomarker",
                    "format": "json",
                    "no_redirect": 1,
                    "skip_disambig": 1
                }
            )
            
            if response.status_code != 200:
                return None
            
            data = response.json()
            
            # Extract abstract or related topics
            abstract = data.get("Abstract", "")
            abstract_url = data.get("AbstractURL", "")
            
            if abstract and len(abstract) > 50:
                refined = await refine_content_with_llm(biomarker_name, abstract)
                if refined:
                    refined["source_url"] = abstract_url
                    logger.info(f"[Enrichment] DuckDuckGo SUCCESS: {biomarker_name}")
                    return refined
                    
    except Exception as e:
        logger.error(f"DuckDuckGo error for {biomarker_name}: {e}")
    
    return None


# ============================================================================
# STRATEGY 4: DIRECT LLM (Always Available)
# ============================================================================

async def research_with_llm(biomarker_name: str) -> Optional[Dict[str, str]]:
    """
    Direct LLM call using Gemini's medical knowledge.
    Always available as final fallback.
    """
    try:
        # Configure Gemini with settings (not os.getenv)
        api_key = settings.GEMINI_API_KEY
        if not api_key:
            logger.error("GEMINI_API_KEY not configured!")
            return None
        
        genai.configure(api_key=api_key)
        
        prompt = f"""You are a medical professional explaining lab results to a patient.

For the biomarker "{biomarker_name}", provide:

1. SUMMARY: A 2-3 sentence explanation of what this biomarker is and what it measures.
2. SIGNIFICANCE: A 2-3 sentence explanation of why it's important clinically (what high/low values might indicate).

Be accurate, clear, and patient-friendly. Use simple language.

Format your response exactly like:
SUMMARY: [your summary here]
SIGNIFICANCE: [your significance here]
"""
        
        model = genai.GenerativeModel("gemini-2.0-flash-exp")
        response = model.generate_content(prompt)
        
        if not response or not response.text:
            return None
        
        text = response.text
        summary = ""
        significance = ""
        
        if "SUMMARY:" in text and "SIGNIFICANCE:" in text:
            parts = text.split("SIGNIFICANCE:")
            summary = parts[0].replace("SUMMARY:", "").strip()
            significance = parts[1].strip()
        else:
            summary = text.strip()
            significance = "Consult your healthcare provider for interpretation."
        
        logger.info(f"[Enrichment] LLM SUCCESS: {biomarker_name}")
        return {
            "summary": summary,
            "clinical_significance": significance,
            "source_url": None  # No external source
        }
        
    except Exception as e:
        logger.error(f"LLM error for {biomarker_name}: {e}")
        return None


# ============================================================================
# LLM REFINEMENT HELPER
# ============================================================================

async def refine_content_with_llm(biomarker_name: str, raw_content: str) -> Optional[Dict[str, str]]:
    """
    Use LLM to extract structured summary and significance from raw content.
    Strictly limits output to 3 sentences each.
    """
    try:
        api_key = settings.GEMINI_API_KEY
        if not api_key:
            return None
        
        genai.configure(api_key=api_key)
        
        prompt = f"""You are a medical expert explaining lab biomarkers to patients.

Based on this Wikipedia content about "{biomarker_name}":
"{raw_content[:1200]}"

Provide EXACTLY:

1. SUMMARY: What is {biomarker_name}? (EXACTLY 2-3 sentences, max 60 words)
2. SIGNIFICANCE: Why does it matter clinically? What do abnormal levels indicate? (EXACTLY 2-3 sentences, max 60 words)

Rules:
- Use simple, patient-friendly language
- Be specific and accurate
- No bullet points, just sentences

Format your response EXACTLY like this:
SUMMARY: [your 2-3 sentence summary here]
SIGNIFICANCE: [your 2-3 sentence significance here]
"""
        
        model = genai.GenerativeModel("gemini-2.0-flash-exp")
        response = model.generate_content(prompt)
        
        if not response or not response.text:
            return None
        
        text = response.text
        
        if "SUMMARY:" in text and "SIGNIFICANCE:" in text:
            parts = text.split("SIGNIFICANCE:")
            summary = parts[0].replace("SUMMARY:", "").strip()
            significance = parts[1].strip()
            
            # Ensure they're not empty
            if summary and significance:
                return {
                    "summary": summary,
                    "clinical_significance": significance
                }
            
    except Exception as e:
        logger.warning(f"LLM refinement error: {e}")
    
    return None


# ============================================================================
# MAIN RESEARCH FUNCTION
# ============================================================================

async def research_biomarker(biomarker_name: str) -> Optional[Dict[str, str]]:
    """
    Main entry point: Research biomarker using multi-source fallback chain.
    
    Cache Flow:
    1. Redis (fast, 7-day TTL)
    2. MongoDB (checked in enrichment_router)
    
    Research Flow:
    1. Wikipedia (free, reliable)
    2. Tavily (low cost, medical focus)
    3. DuckDuckGo (free backup)
    4. Direct LLM (always works)
    """
    # Check Redis cache first
    cached = await get_redis_cache(biomarker_name)
    if cached:
        return cached
    
    result = None
    
    # Strategy 1: Wikipedia
    result = await research_with_wikipedia(biomarker_name)
    if result:
        await set_redis_cache(biomarker_name, result)
        return result
    
    # Strategy 2: Tavily (if configured)
    result = await research_with_tavily(biomarker_name)
    if result:
        await set_redis_cache(biomarker_name, result)
        return result
    
    # Strategy 3: DuckDuckGo
    result = await research_with_duckduckgo(biomarker_name)
    if result:
        await set_redis_cache(biomarker_name, result)
        return result
    
    # Strategy 4: Direct LLM
    result = await research_with_llm(biomarker_name)
    if result:
        await set_redis_cache(biomarker_name, result)
        return result
    
    logger.warning(f"[Enrichment] All strategies failed for: {biomarker_name}")
    return None


# Legacy batch function for backward compatibility
async def research_biomarkers_batch(biomarker_names: List[str]) -> Dict[str, Optional[Dict[str, str]]]:
    """Research multiple biomarkers sequentially."""
    results = {}
    for name in biomarker_names:
        results[name] = await research_biomarker(name)
    return results
