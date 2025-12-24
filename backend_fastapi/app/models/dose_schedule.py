"""Dose scheduling models and Pydantic schemas."""
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum


class DoseStatus(str, Enum):
    """Status of a scheduled dose."""
    PENDING = "pending"      # Future dose, not yet available
    AVAILABLE = "available"  # Within taking window
    TAKEN = "taken"          # Taken on time (within ±30min)
    LATE = "late"            # Taken but late (30min-2hr)
    MISSED = "missed"        # Not taken within window (>2hr)


# Schedule constants
TIMING_PRESETS = {
    "Before breakfast": "07:00",
    "After breakfast": "08:30",
    "Before lunch": "11:30",
    "After lunch": "13:00",
    "Before dinner": "18:30",
    "After dinner": "19:30",
    "Before bed": "22:00",
    "With meals": ["08:00", "13:00", "19:00"],
    "Empty stomach": "06:30",
    "As needed": None,
}

# Default schedules by frequency
DEFAULT_SCHEDULES = {
    1: ["08:00"],
    2: ["08:00", "20:00"],
    3: ["08:00", "14:00", "22:00"],
    4: ["08:00", "12:00", "18:00", "22:00"],
    5: ["06:00", "10:00", "14:00", "18:00", "22:00"],
    6: ["06:00", "10:00", "14:00", "18:00", "22:00", "02:00"],
}

# Status window thresholds (in minutes)
EARLY_WINDOW = 30       # Can take 30min before scheduled
ON_TIME_WINDOW = 30     # On-time if within 30min after
LATE_WINDOW = 120       # Late if 30min-2hr after
MISSED_THRESHOLD = 120  # Missed if >2hr after


class DoseScheduleBase(BaseModel):
    """Base fields for dose schedule."""
    medication_id: str
    scheduled_times: List[str]  # ["08:00", "14:00", "20:00"]
    is_custom: bool = False


class DoseScheduleCreate(DoseScheduleBase):
    """Schema for creating a dose schedule."""
    pass


class DoseScheduleUpdate(BaseModel):
    """Schema for updating a dose schedule."""
    scheduled_times: Optional[List[str]] = None
    is_custom: Optional[bool] = None


class DoseScheduleInDB(DoseScheduleBase):
    """Dose schedule as stored in database."""
    id: str = Field(alias="_id")
    user_id: str
    created_at: datetime
    updated_at: datetime
    
    class Config:
        populate_by_name = True


class DoseScheduleResponse(BaseModel):
    """Response schema for dose schedule."""
    id: str = Field(alias="_id")
    medication_id: str
    medication_name: Optional[str] = None
    user_id: str
    scheduled_times: List[str]
    is_custom: bool
    created_at: str
    updated_at: str
    
    class Config:
        populate_by_name = True


class DoseLogBase(BaseModel):
    """Base fields for dose log."""
    medication_id: str
    date: str  # YYYY-MM-DD
    scheduled_time: str  # "08:00"
    status: DoseStatus = DoseStatus.PENDING
    taken_at: Optional[str] = None  # Actual time taken "08:15"


class DoseLogCreate(BaseModel):
    """Schema for creating a dose log (marking taken)."""
    medication_id: str
    scheduled_time: str
    taken_at: Optional[str] = None  # If not provided, use current time


class DoseLogInDB(DoseLogBase):
    """Dose log as stored in database."""
    id: str = Field(alias="_id")
    user_id: str
    created_at: datetime
    
    class Config:
        populate_by_name = True


class DoseLogResponse(BaseModel):
    """Response for a single dose log."""
    id: str = Field(alias="_id")
    medication_id: str
    medication_name: Optional[str] = None
    user_id: str
    date: str
    scheduled_time: str
    status: str
    taken_at: Optional[str] = None
    time_diff_minutes: Optional[int] = None  # Difference from scheduled
    
    class Config:
        populate_by_name = True


class TodayDoseItem(BaseModel):
    """A single dose item for today's view."""
    medication_id: str
    medication_name: str
    scheduled_time: str
    status: str
    taken_at: Optional[str] = None
    time_until: Optional[int] = None  # Minutes until scheduled (if future)
    time_since: Optional[int] = None  # Minutes since scheduled (if past)
    can_take: bool = False  # Whether user can mark as taken now
    dose_log_id: Optional[str] = None


class TodayDosesResponse(BaseModel):
    """Response for today's doses."""
    success: bool
    date: str
    doses: List[TodayDoseItem]
    summary: dict  # total, taken, pending, missed


class DoseHistoryResponse(BaseModel):
    """Response for dose history."""
    success: bool
    start_date: str
    end_date: str
    logs: List[DoseLogResponse]
    adherence_rate: float  # Percentage of doses taken on time/late
