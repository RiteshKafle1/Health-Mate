"""
AI Insights Service - Generate personalized medication adherence insights using Gemini.

This service analyzes adherence patterns and generates actionable, 
personalized recommendations to help users improve their medication habits.

CACHING: Insights are cached in Redis for 24 hours to minimize API calls.
"""
from typing import Optional, List
from datetime import datetime, timedelta
import json
from ..healthmate_assist.gemini_client import get_gemini_client
from ..core.redis import get_redis
from .dose_history_service import get_adherence_stats, get_time_of_day_analysis, calculate_streak, get_comparison_stats


# Cache TTL in seconds (24 hours)
CACHE_TTL_SECONDS = 24 * 60 * 60  # 86400 seconds

# Redis key prefix for AI insights cache
CACHE_KEY_PREFIX = "ai_insights:"

# System prompt for generating insights
AI_INSIGHTS_PROMPT = """You are a friendly, encouraging health assistant helping patients improve their medication adherence.

Based on the user's medication adherence data below, provide 3 SHORT, ACTIONABLE insights. 

RULES:
1. Be encouraging, not judgmental
2. Each insight should be 1-2 sentences MAX
3. Focus on specific, actionable tips
4. Reference their actual data (numbers, times, medications)
5. Use simple language, avoid medical jargon
6. Add an emoji at the start of each insight

Format your response as a JSON array of strings like:
["💡 Insight 1 here", "⏰ Insight 2 here", "🎯 Insight 3 here"]

ONLY return the JSON array, nothing else."""


async def get_cached_insights(user_id: str) -> Optional[dict]:
    """
    Retrieve cached insights from Redis if they exist and are not expired.
    
    Redis handles TTL automatically - if key exists, it's still valid.
    
    Returns:
    - Cached insights dict if found
    - None if not found (expired or never cached)
    """
    redis = get_redis()
    
    if not redis:
        return None
    
    cache_key = f"{CACHE_KEY_PREFIX}{user_id}"
    
    try:
        cached_data = await redis.get(cache_key)
        
        if cached_data:
            data = json.loads(cached_data)
            
            # Calculate cache age
            generated_at = data.get("generated_at", "")
            if generated_at:
                try:
                    gen_time = datetime.fromisoformat(generated_at.replace('Z', '+00:00'))
                    age = datetime.utcnow() - gen_time.replace(tzinfo=None)
                    cache_age_hours = round(age.total_seconds() / 3600, 1)
                except:
                    cache_age_hours = 0
            else:
                cache_age_hours = 0
            
            return {
                "success": True,
                "insights": data.get("insights", []),
                "generated_at": generated_at,
                "data_period": data.get("data_period", "week"),
                "from_cache": True,
                "cache_age_hours": cache_age_hours
            }
    except Exception as e:
        print(f"[AI Insights] Redis get error: {e}")
    
    return None


async def save_insights_to_cache(user_id: str, insights: List[str], data_period: str = "week") -> None:
    """
    Save generated insights to Redis with automatic TTL expiry.
    
    Uses SETEX for atomic set-with-expiry operation.
    Old insights are automatically replaced (Redis overwrites on same key).
    """
    redis = get_redis()
    
    if not redis:
        print("[AI Insights] Redis not available, skipping cache save")
        return
    
    cache_key = f"{CACHE_KEY_PREFIX}{user_id}"
    
    cache_data = {
        "insights": insights,
        "generated_at": datetime.utcnow().isoformat(),
        "data_period": data_period
    }
    
    try:
        await redis.setex(
            cache_key,
            CACHE_TTL_SECONDS,
            json.dumps(cache_data)
        )
        print(f"[AI Insights] Cached insights for user {user_id[:8]}... (TTL: 24h)")
    except Exception as e:
        print(f"[AI Insights] Redis save error: {e}")


async def generate_ai_insights(user_id: str, force_refresh: bool = False) -> dict:
    """
    Generate AI-powered personalized insights based on user's adherence data.
    
    Uses Redis caching to minimize API calls:
    - Returns cached insights if they exist (< 24 hours old)
    - Only calls Gemini API if cache miss or force_refresh=True
    
    Args:
        user_id: The user's ID
        force_refresh: If True, bypasses cache and regenerates insights
    
    Returns:
    - insights: List of 3 actionable tips
    - generated_at: When insights were generated
    - from_cache: True if returned from cache
    """
    
    # Check cache first (unless force refresh)
    if not force_refresh:
        cached = await get_cached_insights(user_id)
        if cached:
            print(f"[AI Insights] Cache HIT (age: {cached.get('cache_age_hours')}h)")
            return cached
    
    # Cache miss or force refresh - call Gemini API
    try:
        print(f"[AI Insights] Cache MISS - calling Gemini API...")
        
        # Gather all relevant data
        adherence = await get_adherence_stats(user_id, "week")
        time_analysis = await get_time_of_day_analysis(user_id, "week")
        streak = await calculate_streak(user_id)
        comparison = await get_comparison_stats(user_id)
        
        # Build data summary for AI
        data_summary = _build_data_summary(adherence, time_analysis, streak, comparison)
        
        # Generate insights using Gemini
        gemini = get_gemini_client()
        
        prompt = f"""
USER'S MEDICATION ADHERENCE DATA:
{data_summary}

Generate 3 personalized insights for this user.
"""
        
        response = gemini.generate_response(
            prompt=prompt,
            system_instruction=AI_INSIGHTS_PROMPT
        )
        
        # Parse the response
        insights = _parse_insights_response(response)
        
        # Save to Redis cache (auto-expires after 24h, replaces old insights)
        await save_insights_to_cache(user_id, insights, "week")
        
        generated_at = datetime.utcnow().isoformat()
        
        return {
            "success": True,
            "insights": insights,
            "generated_at": generated_at,
            "data_period": "week",
            "from_cache": False
        }
        
    except Exception as e:
        print(f"[AI Insights] ERROR: {str(e)}")
        # Return fallback insights if AI fails
        return {
            "success": True,
            "insights": _get_fallback_insights(),
            "generated_at": datetime.utcnow().isoformat(),
            "data_period": "week",
            "fallback": True,
            "error": str(e)
        }


async def can_refresh_insights(user_id: str) -> dict:
    """
    Check if user can refresh their insights.
    
    Users can only refresh once per 24 hours to prevent API abuse.
    
    Returns:
        {
            "can_refresh": bool,
            "next_refresh_at": datetime or None,
            "hours_until_refresh": float or None
        }
    """
    redis = get_redis()
    
    if not redis:
        # If Redis is down, allow refresh
        return {
            "can_refresh": True,
            "next_refresh_at": None,
            "hours_until_refresh": None
        }
    
    cache_key = f"{CACHE_KEY_PREFIX}{user_id}"
    
    try:
        # Check if cache exists (if it does, they've refreshed within 24h)
        cached_data = await redis.get(cache_key)
        
        if not cached_data:
            return {
                "can_refresh": True,
                "next_refresh_at": None,
                "hours_until_refresh": None
            }
        
        data = json.loads(cached_data)
        generated_at = data.get("generated_at", "")
        
        if generated_at:
            try:
                gen_time = datetime.fromisoformat(generated_at.replace('Z', '+00:00'))
                age = datetime.utcnow() - gen_time.replace(tzinfo=None)
                
                if age < timedelta(seconds=CACHE_TTL_SECONDS):
                    next_refresh = gen_time + timedelta(seconds=CACHE_TTL_SECONDS)
                    hours_left = (timedelta(seconds=CACHE_TTL_SECONDS) - age).total_seconds() / 3600
                    return {
                        "can_refresh": False,
                        "next_refresh_at": next_refresh.isoformat(),
                        "hours_until_refresh": round(hours_left, 1)
                    }
            except:
                pass
        
        return {
            "can_refresh": True,
            "next_refresh_at": None,
            "hours_until_refresh": None
        }
        
    except Exception as e:
        print(f"[AI Insights] Redis check error: {e}")
        return {
            "can_refresh": True,
            "next_refresh_at": None,
            "hours_until_refresh": None
        }


def _build_data_summary(
    adherence: dict, 
    time_analysis: dict, 
    streak: dict, 
    comparison: dict
) -> str:
    """Build a human-readable summary of the user's data for AI."""
    summary_parts = []
    
    # Overall adherence
    if adherence.get("success"):
        stats = adherence.get("summary", {})
        summary_parts.append(f"Overall Adherence: {stats.get('adherence_percentage', 0)}%")
        summary_parts.append(f"Total Doses: {stats.get('total_doses', 0)} (Taken: {stats.get('taken', 0)}, Missed: {stats.get('missed', 0)})")
    
    # Streak
    if streak.get("success"):
        summary_parts.append(f"Current Streak: {streak.get('current_streak', 0)} days")
        summary_parts.append(f"Best Streak Ever: {streak.get('best_streak', 0)} days")
    
    # Week comparison
    if comparison.get("success"):
        delta = comparison.get("delta", 0)
        trend = comparison.get("trend", "stable")
        summary_parts.append(f"Week Trend: {trend} ({'+' if delta > 0 else ''}{delta}% from last week)")
    
    # Problem times
    if time_analysis.get("success"):
        worst = time_analysis.get("worst_period")
        worst_rate = time_analysis.get("worst_miss_rate", 0)
        if worst and worst_rate > 0:
            summary_parts.append(f"Problem Time: {worst} ({worst_rate}% missed)")
    
    # By medication breakdown
    if adherence.get("success") and adherence.get("by_medication"):
        meds = []
        for name, data in adherence.get("by_medication", {}).items():
            meds.append(f"  - {name}: {data.get('adherence_percentage', 0)}%")
        if meds:
            summary_parts.append("By Medication:\n" + "\n".join(meds))
    
    return "\n".join(summary_parts)


def _parse_insights_response(response: str) -> List[str]:
    """Parse AI response to extract insights list."""
    
    # Try to find JSON array in response
    try:
        # First, try direct parse
        insights = json.loads(response.strip())
        if isinstance(insights, list) and len(insights) > 0:
            return insights[:3]  # Max 3 insights
    except json.JSONDecodeError:
        pass
    
    # Try to extract JSON from text
    try:
        start = response.find('[')
        end = response.rfind(']') + 1
        if start >= 0 and end > start:
            insights = json.loads(response[start:end])
            if isinstance(insights, list) and len(insights) > 0:
                return insights[:3]
    except json.JSONDecodeError:
        pass
    
    # Fallback: split by newlines and clean
    lines = [l.strip() for l in response.split('\n') if l.strip()]
    insights = []
    for line in lines:
        # Remove common prefixes
        line = line.lstrip('0123456789.-) ')
        if line and len(line) > 10:
            insights.append(line)
            if len(insights) >= 3:
                break
    
    if insights:
        return insights
    
    return _get_fallback_insights()


def _get_fallback_insights() -> List[str]:
    """Return generic insights if AI generation fails."""
    return [
        "💡 Try setting phone alarms for each medication time to build a consistent habit.",
        "⏰ Take your medications at the same time every day - consistency is key!",
        "🎯 Keep medications visible - out of sight often means out of mind."
    ]
