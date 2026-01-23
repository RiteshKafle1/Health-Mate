"""
Lab Interpretation API Router
=============================
Endpoints for interpreting lab reports using AI.
"""

import time
import httpx
import base64
import logging
from bson import ObjectId
from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from typing import Optional

from ..graph import lab_interpretation_graph

from ..models.interpretation import (
    PatientContext,
    InterpretRequest,
    InterpretResponse,
    BiomarkerListItem,
    BiomarkerListResponse,
    ExtractedValue,
    ValueStatus,
    JobStatus,
    StartJobResponse,
    JobStatusResponse
)
from ..services.gemini_interpreter import LabInterpreter
from ..services.reference_loader import (
    get_reference_data,
    get_biomarker_by_id,
    search_biomarkers,
    get_all_categories
)
from ...core.config import settings
from ...core.database import get_database, get_reports_collection as get_reports_col
from ..services import interpretation_jobs


router = APIRouter(prefix="/api/lab", tags=["Lab Interpretation"])

logger = logging.getLogger(__name__)


# MongoDB collection for caching interpretations
def get_interpretations_collection():
    """Get the lab_interpretations collection."""
    db = get_database()
    return db["lab_interpretations"]


def get_reports_collection():
    """Get the reports collection."""
    return get_reports_col()


async def get_current_user_optional(authorization: Optional[str] = None):
    """
    Get current user from authorization header.
    Returns None if not authenticated.
    """
    # Import here to avoid circular imports
    from ...dependencies.auth import get_current_user
    try:
        if authorization:
            return await get_current_user(authorization)
    except:
        pass
    return None


@router.post("/interpret", response_model=InterpretResponse)
async def interpret_lab_report(
    request: InterpretRequest
):
    """
    Interpret a lab report using Gemini Vision AI.
    
    This endpoint:
    1. Fetches the report image from Cloudinary
    2. Extracts all biomarker values using Gemini Vision
    3. Converts units to reference standards
    4. Compares values against reference ranges
    5. Generates clinical interpretation
    
    **Note**: Results are cached - subsequent calls for the same report
    will return cached results instantly.
    """
    interpretations = get_interpretations_collection()
    reports = get_reports_collection()
    
    # Validate report ID
    if not ObjectId.is_valid(request.report_id):
        raise HTTPException(status_code=400, detail="Invalid report ID")
    
    # Check for cached interpretation
    cached = await interpretations.find_one({"report_id": request.report_id})
    if cached:
        return InterpretResponse(
            success=True,
            message="Retrieved cached interpretation",
            cached=True,
            report_id=request.report_id,
            lab_name=cached.get("result", {}).get("lab_name"),
            report_date=cached.get("result", {}).get("report_date"),
            extracted_values=[
                ExtractedValue(**v) for v in cached.get("result", {}).get("extracted_values", [])
            ],
            summary=cached.get("result", {}).get("summary"),
            abnormal_count=cached.get("result", {}).get("abnormal_count", 0),
            critical_flags=cached.get("result", {}).get("critical_flags", []),
            processing_time_ms=cached.get("result", {}).get("processing_time_ms")
        )
    
    # Get report from database
    report = await reports.find_one({"_id": ObjectId(request.report_id)})
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    
    # Get file URL
    file_url = report.get("file_url")
    if not file_url:
        raise HTTPException(status_code=400, detail="Report has no file URL")
    
    # Check file type - must be image or PDF
    file_type = report.get("file_type", "")
    if not (file_type.startswith("image/") or file_type == "application/pdf"):
        raise HTTPException(
            status_code=400, 
            detail=f"Unsupported file type: {file_type}. Only images and PDFs can be interpreted."
        )
    
    # Check Gemini API key
    if not settings.GEMINI_API_KEY:
        raise HTTPException(
            status_code=503, 
            detail="Lab interpretation service not configured. GEMINI_API_KEY required."
        )
    
    try:
        # Step 1: Fetch image (Router specific logic now)
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(file_url)
            resp.raise_for_status()
            image_data = resp.content
            
            content_type = resp.headers.get("content-type", "image/jpeg")
            mime_type = content_type.split(";")[0].strip()
            if mime_type == "application/pdf":
                mime_type = "application/pdf"
            elif not mime_type.startswith("image/"):
                mime_type = "image/jpeg"

        # Step 2: Invoke LangGraph Workflow
        initial_state = {
            "report_id": request.report_id,
            "image_data": image_data,
            "mime_type": mime_type,
            "patient_context": request.patient_context.model_dump(),
            "api_key": settings.GEMINI_API_KEY
        }
        
        result_state = await lab_interpretation_graph.ainvoke(initial_state)
        
        # Check for errors in the graph execution
        if result_state.get("error"):
            error_msg = result_state["error"]
            # Check for verification/validation errors (400) vs system errors (500)
            if "invalid" in error_msg.lower() or "verification" in error_msg.lower():
                raise HTTPException(status_code=400, detail=error_msg)
            raise HTTPException(status_code=500, detail=error_msg)
            
        # Get final result
        final_result_dict = result_state.get("final_result")
        if not final_result_dict:
             raise HTTPException(status_code=500, detail="Graph completed but returned no result")
             
        # Parse back to Pydantic model for type safety (optional, but good)
        # However, validation_issues are dicts in the state, matching the model
        
        # Cache the result
        cache_doc = {
            "report_id": request.report_id,
            "user_id": report.get("user_id"),
            "patient_context": request.patient_context.model_dump(),
            "result": final_result_dict,
            "created_at": int(time.time() * 1000)
        }
        await interpretations.insert_one(cache_doc)
        
        # Return response (final_result_dict matches the structure of InterpretationResult)
        return InterpretResponse(
            success=True,
            message="Lab report interpreted successfully (via Agent Graph)",
            cached=False,
            **final_result_dict
        )
        
    except HTTPException:
        raise
    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f"Interpretation error: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to interpret lab report: {str(e)}"
        )


@router.get("/interpret/{report_id}", response_model=InterpretResponse)
async def get_interpretation(report_id: str):
    """
    Get a previously cached interpretation for a report.
    
    If no interpretation exists, returns 404. Use POST /interpret to create one.
    """
    if not ObjectId.is_valid(report_id):
        raise HTTPException(status_code=400, detail="Invalid report ID")
    
    interpretations = get_interpretations_collection()
    cached = await interpretations.find_one({"report_id": report_id})
    
    if not cached:
        raise HTTPException(
            status_code=404,
            detail="No interpretation found for this report. Use POST /lab/interpret to analyze it."
        )
    
    return InterpretResponse(
        success=True,
        message="Retrieved cached interpretation",
        cached=True,
        report_id=report_id,
        lab_name=cached.get("result", {}).get("lab_name"),
        report_date=cached.get("result", {}).get("report_date"),
        extracted_values=[
            ExtractedValue(**v) for v in cached.get("result", {}).get("extracted_values", [])
        ],
        summary=cached.get("result", {}).get("summary"),
        abnormal_count=cached.get("result", {}).get("abnormal_count", 0),
        critical_flags=cached.get("result", {}).get("critical_flags", []),
        processing_time_ms=cached.get("result", {}).get("processing_time_ms")
    )


@router.delete("/interpret/{report_id}")
async def delete_interpretation(report_id: str):
    """
    Delete a cached interpretation to allow re-interpretation.
    
    Useful when patient context changes or you want to re-analyze.
    """
    if not ObjectId.is_valid(report_id):
        raise HTTPException(status_code=400, detail="Invalid report ID")
    
    interpretations = get_interpretations_collection()
    result = await interpretations.delete_one({"report_id": report_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="No interpretation found to delete")
    
    return {"success": True, "message": "Interpretation deleted. You can now re-interpret the report."}


@router.get("/biomarkers", response_model=BiomarkerListResponse)
async def list_biomarkers(
    category: Optional[str] = None,
    search: Optional[str] = None
):
    """
    Get list of all supported biomarkers.
    
    Optionally filter by category or search query.
    """
    data = get_reference_data()
    biomarkers = data.biomarkers
    
    # Filter by category
    if category:
        biomarkers = [b for b in biomarkers if b.category.lower() == category.lower()]
    
    # Search
    if search:
        search_lower = search.lower()
        biomarkers = [
            b for b in biomarkers 
            if search_lower in b.canonical_name.lower() 
            or any(search_lower in s.lower() for s in b.synonyms)
        ]
    
    items = [
        BiomarkerListItem(
            id=b.id,
            name=b.canonical_name,
            category=b.category,
            unit=b.reference_unit
        )
        for b in biomarkers
    ]
    
    return BiomarkerListResponse(
        success=True,
        count=len(items),
        biomarkers=items
    )


@router.get("/biomarkers/{biomarker_id}")
async def get_biomarker_details(biomarker_id: str):
    """
    Get detailed information about a specific biomarker.
    
    Includes all reference ranges, synonyms, and interpretation notes.
    """
    biomarker = get_biomarker_by_id(biomarker_id)
    
    if not biomarker:
        raise HTTPException(
            status_code=404,
            detail=f"Biomarker '{biomarker_id}' not found"
        )
    
    return {
        "success": True,
        "biomarker": biomarker.model_dump()
    }


@router.get("/categories")
async def list_categories():
    """Get list of all biomarker categories."""
    categories = get_all_categories()
    
    return {
        "success": True,
        "count": len(categories),
        "categories": sorted(categories)
    }


@router.get("/health")
async def health_check():
    """
    Health check endpoint for the lab interpretation service.
    
    Verifies that reference data and Gemini API are accessible.
    """
    try:
        # Check reference data
        data = get_reference_data()
        biomarker_count = len(data.biomarkers)
        
        # Check Gemini API key
        gemini_configured = bool(settings.GEMINI_API_KEY)
        
        return {
            "success": True,
            "status": "healthy",
            "biomarkers_loaded": biomarker_count,
            "gemini_configured": gemini_configured,
            "version": data.version
        }
    except Exception as e:
        return {
            "success": False,
            "status": "unhealthy",
            "error": str(e)
        }


@router.post("/interpret/async", response_model=StartJobResponse, status_code=202)
async def start_interpretation_job(
    request: InterpretRequest,
    background_tasks: BackgroundTasks
):
    """
    Start lab report interpretation as a background job.
    
    This endpoint immediately returns a job ID, allowing the user to continue
    using the application while interpretation runs in the background.
    
    Poll GET /interpret/status/{job_id} to check progress and retrieve results.
    """
    from ..services.background_processor import process_interpretation_background
    
    interpretations = get_interpretations_collection()
    reports = get_reports_collection()
    
    # Validate report ID
    if not ObjectId.is_valid(request.report_id):
        raise HTTPException(status_code=400, detail="Invalid report ID")
    
    # Check for cached interpretation first
    cached = await interpretations.find_one({"report_id": request.report_id})
    if cached:
        # Return existing interpretation wrapped in a job response
        return StartJobResponse(
            success=True,
            message="Interpretation already exists (cached)",
            job_id="cached",
            report_id=request.report_id
        )
    
    # Check if there's already a pending/processing job for this report
    existing_job = await interpretation_jobs.get_job_by_report(request.report_id)
    if existing_job and existing_job["status"] in ["pending", "processing"]:
        return StartJobResponse(
            success=True,
            message="Interpretation job already in progress",
            job_id=existing_job["job_id"],
            report_id=request.report_id
        )
    
    # Get report from database
    report = await reports.find_one({"_id": ObjectId(request.report_id)})
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    
    # Get file URL
    file_url = report.get("file_url")
    if not file_url:
        raise HTTPException(status_code=400, detail="Report has no file URL")
    
    # Check file type
    file_type = report.get("file_type", "")
    if not (file_type.startswith("image/") or file_type == "application/pdf"):
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {file_type}. Only images and PDFs can be interpreted."
        )
    
    # Check Gemini API key
    if not settings.GEMINI_API_KEY:
        raise HTTPException(
            status_code=503,
            detail="Lab interpretation service not configured. GEMINI_API_KEY required."
        )
    
    # Fetch image data
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(file_url)
            resp.raise_for_status()
            image_data = resp.content
            
            content_type = resp.headers.get("content-type", "image/jpeg")
            mime_type = content_type.split(";")[0].strip()
            if mime_type == "application/pdf":
                mime_type = "application/pdf"
            elif not mime_type.startswith("image/"):
                mime_type = "image/jpeg"
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch report file: {str(e)}"
        )
    
    # Create job
    user_id = report.get("user_id", "unknown")
    job_id = await interpretation_jobs.create_job(
        report_id=request.report_id,
        user_id=user_id,
        patient_context=request.patient_context.model_dump()
    )
    
    # Launch background task
    background_tasks.add_task(
        process_interpretation_background,
        job_id=job_id,
        report_id=request.report_id,
        image_data=image_data,
        mime_type=mime_type,
        patient_context=request.patient_context.model_dump(),
        user_id=user_id,
        get_interpretations_collection_func=get_interpretations_collection
    )
    
    logger.info(f"Started background job {job_id} for report {request.report_id}")
    
    return StartJobResponse(
        success=True,
        message="Interpretation job started. Poll /interpret/status/{job_id} for progress.",
        job_id=job_id,
        report_id=request.report_id
    )


@router.get("/interpret/status/{job_id}", response_model=JobStatusResponse)
async def get_job_status_endpoint(job_id: str):
    """
    Get the status of an interpretation job.
    
    Returns current status, progress percentage, and interpretation result when complete.
    """
    # Check for cached result first (job_id = "cached")
    if job_id == "cached":
        raise HTTPException(
            status_code=400,
            detail="Use GET /interpret/{report_id} for cached results"
        )
    
    job = await interpretation_jobs.get_job_status(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    return JobStatusResponse(
        job_id=job["job_id"],
        report_id=job["report_id"],
        status=JobStatus(job["status"]),
        progress=job["progress"],
        current_step=job["current_step"],
        result=job.get("result"),
        error_message=job.get("error_message"),
        created_at=job["created_at"].isoformat(),
        updated_at=job["updated_at"].isoformat()
    )
