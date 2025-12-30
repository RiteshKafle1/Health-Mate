"""Medication router - REST API endpoints for medication management."""
from fastapi import APIRouter, Depends, HTTPException, status
from typing import Optional
from datetime import datetime
from ..dependencies.auth import get_current_user
from ..services import medication_service
from ..services import medication_info_service
from ..models.medication import MedicationCreate, MedicationUpdate, StockUpdate, StockRefill, DoseMarkRequest

router = APIRouter(prefix="/api/user/medications", tags=["Medications"])


@router.post("")
async def create_medication(
    medication: MedicationCreate,
    user_id: str = Depends(get_current_user)
):
    """Create a new medication with optional stock tracking."""
    return await medication_service.create_medication(
        user_id=user_id,
        name=medication.name,
        frequency=medication.frequency,
        duration=medication.duration,
        timing=medication.timing,
        description=medication.description,
        total_stock=medication.total_stock,
        current_stock=medication.current_stock,
        dose_per_intake=medication.dose_per_intake,
        start_date=medication.start_date,
        is_active=medication.is_active,
        purpose=medication.purpose,
        instructions=medication.instructions,
        schedule_times=medication.schedule_times
    )


@router.get("")
async def get_medications(user_id: str = Depends(get_current_user)):
    """Get all medications for the authenticated user with calculated fields."""
    return await medication_service.get_user_medications(user_id)


@router.get("/low-stock")
async def get_low_stock_medications(user_id: str = Depends(get_current_user)):
    """Get medications with low or out of stock."""
    return await medication_service.get_low_stock_medications(user_id)


@router.get("/{medication_id}")
async def get_medication(
    medication_id: str,
    user_id: str = Depends(get_current_user)
):
    """Get a specific medication by ID with calculated fields."""
    result = await medication_service.get_medication(user_id, medication_id)
    if not result["success"]:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=result
        )
    return result


@router.put("/{medication_id}")
async def update_medication(
    medication_id: str,
    medication: MedicationUpdate,
    user_id: str = Depends(get_current_user)
):
    """Update an existing medication including stock and progress fields."""
    result = await medication_service.update_medication(
        user_id=user_id,
        medication_id=medication_id,
        name=medication.name,
        frequency=medication.frequency,
        duration=medication.duration,
        timing=medication.timing,
        description=medication.description,
        total_stock=medication.total_stock,
        current_stock=medication.current_stock,
        dose_per_intake=medication.dose_per_intake,
        start_date=medication.start_date,
        end_date=medication.end_date,
        is_active=medication.is_active,
        purpose=medication.purpose,
        instructions=medication.instructions,
        purpose_source=medication.purpose_source,
        instructions_source=medication.instructions_source,
        schedule_times=medication.schedule_times
    )
    if not result["success"]:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=result
        )
    return result


@router.put("/{medication_id}/stock")
async def update_stock(
    medication_id: str,
    stock_data: StockUpdate,
    user_id: str = Depends(get_current_user)
):
    """Update just the current stock level."""
    result = await medication_service.update_stock(
        user_id=user_id,
        medication_id=medication_id,
        current_stock=stock_data.current_stock
    )
    if not result["success"]:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=result
        )
    return result


@router.post("/{medication_id}/refill")
async def refill_stock(
    medication_id: str,
    refill_data: StockRefill,
    user_id: str = Depends(get_current_user)
):
    """Refill medication stock by adding to current amount."""
    result = await medication_service.refill_stock(
        user_id=user_id,
        medication_id=medication_id,
        refill_amount=refill_data.refill_amount,
        total_stock=refill_data.total_stock
    )
    if not result["success"]:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=result
        )
    return result


@router.delete("/{medication_id}")
async def delete_medication(
    medication_id: str,
    user_id: str = Depends(get_current_user)
):
    """Delete a medication."""
    result = await medication_service.delete_medication(user_id, medication_id)
    if not result["success"]:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=result
        )
    return result


@router.post("/{medication_id}/dose")
async def mark_dose(
    medication_id: str,
    dose_data: DoseMarkRequest,
    user_id: str = Depends(get_current_user)
):
    """Mark a specific dose as taken or untaken for today."""
    result = await medication_service.mark_dose_taken(
        user_id=user_id,
        medication_id=medication_id,
        time_slot=dose_data.time_slot,
        taken=dose_data.taken
    )
    if not result["success"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result
        )
    return result


@router.get("/info/{medication_name}")
async def get_medication_info(
    medication_name: str,
    field: str = "both",  # "purpose" | "instructions" | "both"
    user_id: str = Depends(get_current_user)
):
    """
    Get medication purpose and/or instructions from multiple sources.
    
    Sources (priority order):
    1. Local knowledge base
    2. OpenFDA API (FDA drug labels)
    3. Tavily web search (medical sites)
    4. Gemini AI (fallback)
    
    Query params:
        field: "purpose" | "instructions" | "both" (default: both)
    
    Returns: {purpose, instructions, source, success}
    """
    result = await medication_info_service.get_medication_info(medication_name, field)
    return result


# ============================================
# ADHERENCE TRACKING ENDPOINTS
# ============================================

@router.get("/adherence/stats")
async def get_adherence_stats(
    period: str = "week",  # week, month, all
    medication_id: Optional[str] = None,
    user_id: str = Depends(get_current_user)
):
    """
    Get adherence statistics for the current user.
    
    Returns:
    - Overall adherence percentage
    - Breakdown by status (taken, missed, late)
    - Per-medication breakdown
    - Per-date breakdown
    """
    from ..services import dose_history_service
    return await dose_history_service.get_adherence_stats(
        user_id=user_id,
        period=period,
        medication_id=medication_id
    )


@router.get("/adherence/missed")
async def get_missed_doses(
    limit: int = 20,
    medication_id: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    user_id: str = Depends(get_current_user)
):
    """
    Get list of missed doses for the current user.
    
    Returns most recent missed doses, optionally filtered by medication or date range.
    """
    from ..services import dose_history_service
    return await dose_history_service.get_missed_doses(
        user_id=user_id,
        limit=limit,
        medication_id=medication_id,
        start_date=start_date,
        end_date=end_date
    )


@router.get("/adherence/streak")
async def get_streak(user_id: str = Depends(get_current_user)):
    """
    Get current adherence streak.
    
    Returns:
    - Current streak (consecutive days with 100% adherence)
    - Best streak ever
    - Last broken date
    """
    from ..services import dose_history_service
    return await dose_history_service.calculate_streak(user_id)


@router.get("/adherence/history")
async def get_dose_history(
    medication_id: Optional[str] = None,
    limit: int = 50,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    user_id: str = Depends(get_current_user)
):
    """
    Get detailed dose history for the current user.
    
    Returns chronological list of all dose events with status, timing, and notes.
    """
    from ..services import dose_history_service
    return await dose_history_service.get_dose_history(
        user_id=user_id,
        medication_id=medication_id,
        limit=limit,
        start_date=start_date,
        end_date=end_date
    )


@router.get("/adherence/time-analysis")
async def get_time_analysis(
    period: str = "week",
    user_id: str = Depends(get_current_user)
):
    """
    Analyze dose adherence by time of day.
    
    Returns:
    - Breakdown by time period (Morning, Afternoon, Evening, Night)
    - Miss percentage per period
    - Worst time period identified
    """
    from ..services import dose_history_service
    return await dose_history_service.get_time_of_day_analysis(user_id, period)


@router.get("/adherence/comparison")
async def get_comparison(user_id: str = Depends(get_current_user)):
    """
    Compare current week's adherence with previous week.
    
    Returns:
    - This week's stats
    - Last week's stats
    - Delta (improvement/decline percentage)
    - Trend direction and insight message
    """
    from ..services import dose_history_service
    return await dose_history_service.get_comparison_stats(user_id)


# ============================================
# PHASE 3: AI INSIGHTS & REPORTING
# ============================================

@router.get("/adherence/ai-insights")
async def get_ai_insights(
    user_id: str = Depends(get_current_user),
    refresh: bool = False
):
    """
    Get AI-generated personalized medication adherence insights.
    
    Uses caching to minimize API calls:
    - Returns cached insights if < 24 hours old
    - Set refresh=True to force regeneration (max 1/day)
    
    Returns:
    - insights: List of 3 personalized tips
    - generated_at: When insights were generated
    - from_cache: True if returned from cache
    """
    from ..services import ai_insights_service
    return await ai_insights_service.generate_ai_insights(user_id, force_refresh=refresh)


@router.get("/adherence/ai-insights/can-refresh")
async def can_refresh_insights(user_id: str = Depends(get_current_user)):
    """
    Check if user can refresh their AI insights.
    
    Users can only refresh once per 24 hours to prevent API abuse.
    
    Returns:
    - can_refresh: bool
    - next_refresh_at: datetime when refresh will be available
    - hours_until_refresh: hours remaining
    """
    from ..services import ai_insights_service
    return await ai_insights_service.can_refresh_insights(user_id)
