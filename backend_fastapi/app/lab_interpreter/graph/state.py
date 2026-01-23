from typing import TypedDict, List, Optional, Any, Dict, Union

class LabReportState(TypedDict):
    """
    State definition for the Lab Interpretation Graph.
    """
    # Inputs
    report_id: str
    image_data: bytes
    mime_type: str
    patient_context: dict  # serialized PatientContext
    api_key: str
    
    # Intermediate State
    verification_result: Optional[dict]  # VerificationResult dict
    extracted_data: Optional[dict]       # Raw Gemini output
    processed_values: List[dict]         # List of ExtractedValue dicts
    validation_issues: List[dict]        # List of ValidationIssue dicts
    validation_passed: bool
    validation_confidence: float
    validation_notes: str
    
    # Outputs
    final_result: Optional[dict]         # InterpretationResult dict
    error: Optional[str]
