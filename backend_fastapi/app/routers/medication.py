"""Medication router - REST API endpoints for medication management."""
from fastapi import APIRouter, Depends, HTTPException, status
from typing import Optional
from ..dependencies.auth import get_current_user
from ..services import medication_service
from ..models.medication import MedicationCreate, MedicationUpdate, StockUpdate, StockRefill

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
        is_active=medication.is_active
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
        is_active=medication.is_active
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
