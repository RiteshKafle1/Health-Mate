from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum


class ReportType(str, Enum):
    LAB_REPORT = "lab_report"
    PRESCRIPTION = "prescription"
    XRAY = "xray"
    MRI = "mri"
    CT_SCAN = "ct_scan"
    BLOOD_TEST = "blood_test"
    OTHER = "other"


class AccessRequestStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    DENIED = "denied"
    EXPIRED = "expired"


class ReportBase(BaseModel):
    """Base report model for uploads"""
    user_id: str
    file_url: str
    file_type: str  # image/pdf/video MIME type
    original_name: str
    description: Optional[str] = ""
    report_type: ReportType = ReportType.OTHER
    file_size: int = 0


class ReportCreate(BaseModel):
    """Request model for creating a report"""
    description: Optional[str] = ""
    report_type: ReportType = ReportType.OTHER


class ReportInDB(ReportBase):
    """Report stored in database"""
    id: str = Field(alias="_id")
    uploaded_at: int  # timestamp in ms
    
    class Config:
        populate_by_name = True


class ReportResponse(BaseModel):
    """Response model for API"""
    id: str
    user_id: str
    file_url: str
    file_type: str
    original_name: str
    description: str
    report_type: str
    file_size: int
    uploaded_at: int


class ReportAccessRequestBase(BaseModel):
    """Model for doctor requesting access to patient reports"""
    doctor_id: str
    user_id: str
    appointment_id: str


class ReportAccessRequestCreate(BaseModel):
    """Request model for doctor to request access"""
    user_id: str
    appointment_id: str


class ReportAccessRequestInDB(ReportAccessRequestBase):
    """Access request stored in database"""
    id: str = Field(alias="_id")
    status: AccessRequestStatus = AccessRequestStatus.PENDING
    requested_at: int  # timestamp in ms
    resolved_at: Optional[int] = None  # timestamp when approved/denied
    
    class Config:
        populate_by_name = True


class ReportAccessRequestResponse(BaseModel):
    """Response model for access request"""
    id: str
    doctor_id: str
    doctor_name: Optional[str] = None
    user_id: str
    user_name: Optional[str] = None
    appointment_id: str
    status: str
    requested_at: int
    resolved_at: Optional[int] = None
