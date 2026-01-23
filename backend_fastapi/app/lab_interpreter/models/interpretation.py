"""
Interpretation Models
=====================
Pydantic models for interpretation requests and responses.
"""

from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from enum import Enum


class ValueStatus(str, Enum):
    """Status of a lab value compared to reference range."""
    NORMAL = "normal"
    LOW = "low"
    HIGH = "high"
    CRITICAL_LOW = "critical_low"
    CRITICAL_HIGH = "critical_high"
    UNKNOWN = "unknown"


class PatientContext(BaseModel):
    """Patient context for personalized interpretation."""
    sex: str = Field(default="unknown", description="Patient sex: male, female, or unknown")
    age: Optional[int] = Field(default=None, description="Patient age in years")
    is_fasting: bool = Field(default=False, description="Whether patient was fasting")
    is_pregnant: bool = Field(default=False, description="Whether patient is pregnant")
    
    class Config:
        json_schema_extra = {
            "example": {
                "sex": "male",
                "age": 45,
                "is_fasting": True,
                "is_pregnant": False
            }
        }


class BiomarkerEnrichment(BaseModel):
    """Educational enrichment data for a biomarker from knowledge base."""
    summary: Optional[str] = Field(None, description="Brief explanation of the biomarker")
    clinical_significance: Optional[str] = Field(None, description="Why this biomarker matters clinically")
    source_url: Optional[str] = Field(None, description="Source of the information")
    verified: bool = Field(default=False, description="Whether info has been medically verified")


class ExtractedValue(BaseModel):
    """A single extracted biomarker value from lab report."""
    biomarker_name: str = Field(..., description="Name as shown on report")
    matched_id: Optional[str] = Field(None, description="Matched biomarker ID from database")
    original_value: float = Field(..., description="Value as extracted from report")
    original_unit: str = Field(..., description="Unit as shown on report")
    converted_value: Optional[float] = Field(None, description="Value after unit conversion")
    reference_unit: Optional[str] = Field(None, description="Standard reference unit")
    reference_range: Optional[str] = Field(None, description="Reference range string (e.g., '10-40')")
    status: ValueStatus = Field(default=ValueStatus.UNKNOWN, description="Status compared to reference")
    interpretation: Optional[str] = Field(None, description="Clinical interpretation")
    confidence: float = Field(default=1.0, ge=0.0, le=1.0, description="Matching confidence")
    enrichment: Optional[BiomarkerEnrichment] = Field(None, description="Educational enrichment data")


class InterpretationResult(BaseModel):
    """Complete interpretation result for a lab report."""
    report_id: str
    patient_context: PatientContext
    lab_name: Optional[str] = None
    report_date: Optional[str] = None
    extracted_values: List[ExtractedValue] = []
    summary: Optional[str] = None
    abnormal_count: int = 0
    critical_flags: List[str] = []
    processing_time_ms: Optional[int] = None
    # Validation fields
    validation_passed: bool = True
    validation_confidence: float = 1.0
    validation_issues: List[Dict[str, Any]] = []
    validation_notes: Optional[str] = None


class InterpretRequest(BaseModel):
    """Request model for lab report interpretation."""
    report_id: str = Field(..., description="MongoDB report ID")
    patient_context: PatientContext = Field(default_factory=PatientContext)
    
    class Config:
        json_schema_extra = {
            "example": {
                "report_id": "507f1f77bcf86cd799439011",
                "patient_context": {
                    "sex": "male",
                    "age": 45,
                    "is_fasting": True
                }
            }
        }


class InterpretResponse(BaseModel):
    """Response model for lab report interpretation."""
    success: bool
    message: Optional[str] = None
    report_id: str
    lab_name: Optional[str] = None
    report_date: Optional[str] = None
    extracted_values: List[ExtractedValue] = []
    summary: Optional[str] = None
    abnormal_count: int = 0
    critical_flags: List[str] = []
    cached: bool = False
    processing_time_ms: Optional[int] = None
    # Validation fields
    validation_passed: bool = True
    validation_confidence: float = 1.0
    validation_issues: List[Dict[str, Any]] = []
    validation_notes: Optional[str] = None
    
    class Config:
        json_schema_extra = {
            "example": {
                "success": True,
                "report_id": "507f1f77bcf86cd799439011",
                "lab_name": "ABC Diagnostics",
                "report_date": "2026-01-20",
                "extracted_values": [
                    {
                        "biomarker_name": "Hemoglobin",
                        "matched_id": "hemoglobin",
                        "original_value": 14.2,
                        "original_unit": "g/dL",
                        "converted_value": 14.2,
                        "reference_unit": "g/dL",
                        "reference_range": "14.0-18.0",
                        "status": "normal",
                        "interpretation": "Within normal limits",
                        "confidence": 1.0
                    }
                ],
                "summary": "All values within normal limits.",
                "abnormal_count": 0,
                "critical_flags": [],
                "cached": False,
                "processing_time_ms": 2340
            }
        }


class BiomarkerListItem(BaseModel):
    """Simplified biomarker info for listing."""
    id: str
    name: str
    category: str
    unit: str


class BiomarkerListResponse(BaseModel):
    """Response for listing supported biomarkers."""
    success: bool
    count: int
    biomarkers: List[BiomarkerListItem]


class JobStatus(str, Enum):
    """Status of an interpretation job."""
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class StartJobResponse(BaseModel):
    """Response when starting an async interpretation job."""
    success: bool
    message: str
    job_id: str
    report_id: str


class JobStatusResponse(BaseModel):
    """Response model for job status queries."""
    job_id: str
    report_id: str
    status: JobStatus
    progress: int = Field(ge=0, le=100, description="Progress percentage")
    current_step: str
    result: Optional[InterpretResponse] = None
    error_message: Optional[str] = None
    created_at: str
    updated_at: str
