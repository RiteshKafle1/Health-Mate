"""Dose router - API endpoints for dose scheduling and tracking."""
from fastapi import APIRouter, Depends, HTTPException, status
from typing import Optional
from datetime import datetime, timedelta
from ..dependencies.auth import get_current_user
from ..services import dose_service
from ..models.dose_schedule import DoseLogCreate, DoseScheduleUpdate

router = APIRouter(prefix="/api/user/doses", tags=["Doses"])


@router.get("/today")
async def get_today_doses(user_id: str = Depends(get_current_user)):
    """Get all doses scheduled for today with their status."""
    return await dose_service.get_today_doses(user_id)


@router.post("/{medication_id}/take")
async def mark_dose_taken(
    medication_id: str,
    scheduled_time: str,
    taken_at: Optional[str] = None,
    user_id: str = Depends(get_current_user)
):
    """
    Mark a dose as taken.
    
    Args:
        medication_id: ID of the medication
        scheduled_time: The scheduled time slot being marked (e.g., "08:00")
        taken_at: Optional actual time taken (defaults to current time)
    """
    result = await dose_service.mark_dose_taken(
        user_id=user_id,
        medication_id=medication_id,
        scheduled_time=scheduled_time,
        taken_at=taken_at
    )
    return result


@router.get("/{medication_id}/schedule")
async def get_schedule(
    medication_id: str,
    user_id: str = Depends(get_current_user)
):
    """Get the dose schedule for a specific medication."""
    result = await dose_service.get_schedule(user_id, medication_id)
    if not result["success"]:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=result
        )
    return result


@router.put("/{medication_id}/schedule")
async def update_schedule(
    medication_id: str,
    schedule: DoseScheduleUpdate,
    user_id: str = Depends(get_current_user)
):
    """Update the custom schedule for a medication."""
    if not schedule.scheduled_times:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"message": "scheduled_times is required"}
        )
    
    result = await dose_service.update_schedule(
        user_id=user_id,
        medication_id=medication_id,
        scheduled_times=schedule.scheduled_times
    )
    return result


@router.get("/history")
async def get_dose_history(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    medication_id: Optional[str] = None,
    user_id: str = Depends(get_current_user)
):
    """
    Get dose history for a date range.
    
    Args:
        start_date: Start date in YYYY-MM-DD format (defaults to 7 days ago)
        end_date: End date in YYYY-MM-DD format (defaults to today)
        medication_id: Optional filter by specific medication
    """
    today = datetime.now().strftime("%Y-%m-%d")
    week_ago = (datetime.now() - timedelta(days=7)).strftime("%Y-%m-%d")
    
    return await dose_service.get_dose_history(
        user_id=user_id,
        start_date=start_date or week_ago,
        end_date=end_date or today,
        medication_id=medication_id
    )
