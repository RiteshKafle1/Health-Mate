from pydantic import BaseModel, Field
from typing import Dict, Any, Optional
from enum import Enum


class AppointmentStatus(str, Enum):
    """Appointment status states."""
    pending = "pending"          # Waiting for doctor acceptance
    accepted = "accepted"        # Doctor accepted, awaiting completion
    rejected = "rejected"        # Doctor rejected
    completed = "completed"      # Appointment completed
    cancelled = "cancelled"      # Cancelled by either party


class AppointmentBase(BaseModel):
    userId: str
    docId: str
    slotDate: str
    slotTime: str
    userData: Dict[str, Any]
    docData: Dict[str, Any]
    date: int
    status: AppointmentStatus = AppointmentStatus.pending
    cancelled: bool = False      # Keep for backward compatibility
    isCompleted: bool = False    # Keep for backward compatibility


class AppointmentCreate(BaseModel):
    docId: str
    slotDate: str
    slotTime: str


class AppointmentInDB(AppointmentBase):
    id: str = Field(alias="_id")
    
    class Config:
        populate_by_name = True


class AppointmentResponse(BaseModel):
    id: str = Field(alias="_id")
    userId: str
    docId: str
    slotDate: str
    slotTime: str
    userData: Dict[str, Any]
    docData: Dict[str, Any]
    date: int
    status: AppointmentStatus = AppointmentStatus.pending
    cancelled: bool
    isCompleted: bool
    
    class Config:
        populate_by_name = True


class AppointmentCancel(BaseModel):
    appointmentId: str


class AppointmentAction(BaseModel):
    """For accept appointment action."""
    appointmentId: str


class AppointmentReject(BaseModel):
    """For reject appointment with optional reason."""
    appointmentId: str
    reason: Optional[str] = None
