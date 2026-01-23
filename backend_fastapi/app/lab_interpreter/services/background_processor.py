"""
Background Processing for Lab Interpretation
==========================================
Handles async processing of lab report interpretation jobs.
"""

import time
import logging
from typing import Dict, Any

from ..graph import lab_interpretation_graph
from ..models.interpretation import InterpretResponse
from ...core.config import settings
from . import interpretation_jobs


logger = logging.getLogger(__name__)


async def process_interpretation_background(
    job_id: str,
    report_id: str,
    image_data: bytes,
    mime_type: str,
    patient_context: dict,
    user_id: str,
    get_interpretations_collection_func
):
    """
    Background task to process lab report interpretation.
    Updates job status and progress throughout execution.
    
    Args:
        job_id: Unique job identifier
        report_id: Report ID being interpreted
        image_data: Image bytes from the report
        mime_type: MIME type of the image
        patient_context: Patient context dictionary
        user_id: User who owns the report
        get_interpretations_collection_func: Function to get the interpretations collection
    """
    try:
        # Update to processing
        await interpretation_jobs.update_job_status(
            job_id=job_id,
            status="processing",
            progress=5,
            current_step="Starting verification..."
        )
        
        # Prepare initial state for graph
        initial_state = {
            "report_id": report_id,
            "image_data": image_data,
            "mime_type": mime_type,
            "patient_context": patient_context,
            "api_key": settings.GEMINI_API_KEY
        }
        
        # Execute workflow with progress tracking
        logger.info(f"Starting LangGraph workflow for job {job_id}")
        
        await interpretation_jobs.update_job_status(
            job_id=job_id,
            progress=15,
            current_step="Verifying document validity..."
        )
        
        result_state = await lab_interpretation_graph.ainvoke(initial_state)
        
        # Check for errors
        if result_state.get("error"):
            logger.error(f"Graph execution error for job {job_id}: {result_state['error']}")
            await interpretation_jobs.update_job_status(
                job_id=job_id,
                status="failed",
                progress=0,
                error_message=result_state["error"]
            )
            return
        
        final_result_dict = result_state.get("final_result")
        if not final_result_dict:
            logger.error(f"No final result from graph for job {job_id}")
            await interpretation_jobs.update_job_status(
                job_id=job_id,
                status="failed",
                progress=0,
                error_message="Graph completed but returned no result"
            )
            return
        
        logger.info(f"Graph execution completed for job {job_id}")
        
        # Cache the result in interpretations collection
        await interpretation_jobs.update_job_status(
            job_id=job_id,
            progress=95,
            current_step="Saving results..."
        )
        
        interpretations = get_interpretations_collection_func()
        cache_doc = {
            "report_id": report_id,
            "user_id": user_id,
            "patient_context": patient_context,
            "result": final_result_dict,
            "created_at": int(time.time() * 1000)
        }
        await interpretations.insert_one(cache_doc)
        
        # Build response
        response_data = InterpretResponse(
            success=True,
            message="Lab report interpreted successfully",
            cached=False,
            **final_result_dict
        ).model_dump()
        
        # Mark job as completed
        await interpretation_jobs.update_job_status(
            job_id=job_id,
            status="completed",
            progress=100,
            current_step="Analysis complete",
            result=response_data
        )
        
        logger.info(f"Job {job_id} completed successfully")
        
    except Exception as e:
        logger.error(f"Background processing error for job {job_id}: {e}", exc_info=True)
        await interpretation_jobs.update_job_status(
            job_id=job_id,
            status="failed",
            progress=0,
            error_message=str(e)
        )
