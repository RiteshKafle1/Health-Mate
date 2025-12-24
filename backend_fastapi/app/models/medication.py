"""Medication model and Pydantic schemas."""
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class MedicationBase(BaseModel):
    """Base medication fields."""
    name: str
    frequency: int  # times per day
    duration: str  # e.g., "7 days", "2 weeks"
    description: Optional[str] = None
    timing: str  # e.g., "before breakfast", "after dinner"
    
    # Phase 1: Stock Tracking
    total_stock: Optional[int] = None  # Total pills/doses purchased
    current_stock: Optional[int] = None  # Remaining pills/doses
    dose_per_intake: int = 1  # Pills per dose (default: 1)
    
    # Phase 2: Progress Tracking
    start_date: Optional[str] = None  # YYYY-MM-DD when medication started
    end_date: Optional[str] = None  # YYYY-MM-DD when medication ends (auto-calculated)
    is_active: bool = True  # Whether medication is currently active


class MedicationCreate(MedicationBase):
    """Schema for creating a new medication."""
    pass


class MedicationUpdate(BaseModel):
    """Schema for updating an existing medication."""
    name: Optional[str] = None
    frequency: Optional[int] = None
    duration: Optional[str] = None
    description: Optional[str] = None
    timing: Optional[str] = None
    
    # Stock fields
    total_stock: Optional[int] = None
    current_stock: Optional[int] = None
    dose_per_intake: Optional[int] = None
    
    # Progress fields
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    is_active: Optional[bool] = None


class StockUpdate(BaseModel):
    """Schema for updating medication stock."""
    current_stock: int
    
    
class StockRefill(BaseModel):
    """Schema for refilling medication stock."""
    refill_amount: int
    total_stock: Optional[int] = None  # Optionally update total


class MedicationInDB(MedicationBase):
    """Medication as stored in database."""
    id: str = Field(alias="_id")
    user_id: str
    created_at: datetime
    updated_at: datetime
    
    class Config:
        populate_by_name = True


class MedicationResponse(BaseModel):
    """Response schema for medication."""
    id: str = Field(alias="_id")
    name: str
    frequency: int
    duration: str
    description: Optional[str] = None
    timing: str
    user_id: str
    created_at: str
    updated_at: str
    
    # Stock fields
    total_stock: Optional[int] = None
    current_stock: Optional[int] = None
    dose_per_intake: int = 1
    
    # Progress fields
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    is_active: bool = True
    
    # Calculated fields (added by service)
    days_remaining: Optional[int] = None  # Stock days remaining
    stock_percentage: Optional[float] = None  # Current stock as percentage
    duration_progress: Optional[float] = None  # Progress through duration (0-100)
    days_elapsed: Optional[int] = None  # Days since start
    total_days: Optional[int] = None  # Total duration in days
    stock_status: Optional[str] = None  # "healthy", "medium", "low", "out"
    
    class Config:
        populate_by_name = True


class MedicationListResponse(BaseModel):
    """Response for list of medications."""
    success: bool
    medications: list
    summary: Optional[dict] = None  # Overall stats


class MedicationSingleResponse(BaseModel):
    """Response for single medication operation."""
    success: bool
    message: str
    medication: Optional[dict] = None
