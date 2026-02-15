"""
Background Processing for Lab Interpretation
==========================================
Handles async processing of lab report interpretation jobs.
Calls graph nodes directly for per-step progress tracking.
"""

import time
import logging
from typing import Dict, Any

from ..graph.nodes import verify_node, interpret_node, validate_node, finalize_node
from ..models.interpretation import InterpretResponse
from ...core.config import settings
from . import interpretation_jobs


logger = logging.getLogger(__name__)


# Maps pipeline stages to user-facing progress info
STAGE_INFO = {
    "verify": {
        "start_progress": 10,
        "end_progress": 30,
        "start_msg": "Uploading document to parser...",
        "end_msg": "Document verified successfully",
    },
    "interpret": {
        "start_progress": 35,
        "end_progress": 65,
        "start_msg": "Extracting biomarkers & interpreting values...",
        "end_msg": "Biomarker interpretation complete",
    },
    "validate": {
        "start_progress": 70,
        "end_progress": 82,
        "start_msg": "Validating results against reference ranges...",
        "end_msg": "Validation complete",
    },
    "finalize": {
        "start_progress": 85,
        "end_progress": 92,
        "start_msg": "Generating clinical summary...",
        "end_msg": "Summary generated",
    },
}


async def _update(job_id: str, progress: int, step: str, status: str = None):
    """Helper to update job progress."""
    kwargs = {"job_id": job_id, "progress": progress, "current_step": step}
    if status:
        kwargs["status"] = status
    await interpretation_jobs.update_job_status(**kwargs)


import asyncio

# Global lock to ensure FIFO processing (one job at a time)
# to prevent resource exhaustion from local LLM inference.
_processing_lock = asyncio.Lock()


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
    Calls each graph node directly and updates progress between steps.
    """
    try:
        start_time = time.time()
        # Mark as queued first
        await _update(job_id, 0, "Queued for processing...", status="pending")
        
        logger.info(f"Job {job_id} waiting for processing lock...")
        
        async with _processing_lock:
            logger.info(f"Job {job_id} acquired lock. Starting processing.")
            
            # Update to processing once lock acquired
            await _update(job_id, 5, "Preparing analysis environment...", status="processing")

            # Build initial state
            state: Dict[str, Any] = {
                "report_id": report_id,
                "image_data": image_data,
                "mime_type": mime_type,
                "patient_context": patient_context,
            }

            logger.info(f"Starting node-by-node execution for job {job_id}")

            # ── Step 1: Verify ──
            info = STAGE_INFO["verify"]
            await _update(job_id, info["start_progress"], info["start_msg"])

            result = await verify_node(state)
            state.update(result)
            if state.get("error"):
                await interpretation_jobs.update_job_status(
                    job_id=job_id, status="failed", progress=0,
                    error_message=state["error"]
                )
                return

            await _update(job_id, info["end_progress"], info["end_msg"])
            logger.info(f"Job {job_id}: verify_node done")

            # ── Step 2: Interpret ──
            info = STAGE_INFO["interpret"]
            await _update(job_id, info["start_progress"], info["start_msg"])

            result = await interpret_node(state)
            state.update(result)
            if state.get("error"):
                await interpretation_jobs.update_job_status(
                    job_id=job_id, status="failed", progress=0,
                    error_message=state["error"]
                )
                return

            await _update(job_id, info["end_progress"], info["end_msg"])
            logger.info(f"Job {job_id}: interpret_node done")

            # ── Step 3: Validate ──
            info = STAGE_INFO["validate"]
            await _update(job_id, info["start_progress"], info["start_msg"])

            result = await validate_node(state)
            state.update(result)
            # validate_node doesn't set error — it always succeeds

            await _update(job_id, info["end_progress"], info["end_msg"])
            logger.info(f"Job {job_id}: validate_node done")

            # ── Step 4: Finalize ──
            info = STAGE_INFO["finalize"]
            await _update(job_id, info["start_progress"], info["start_msg"])

            result = await finalize_node(state)
            state.update(result)
            if state.get("error"):
                await interpretation_jobs.update_job_status(
                    job_id=job_id, status="failed", progress=0,
                    error_message=state["error"]
                )
                return

            await _update(job_id, info["end_progress"], info["end_msg"])
            logger.info(f"Job {job_id}: finalize_node done")

            # ── Save results ──
            final_result_dict = state.get("final_result")
            if not final_result_dict:
                logger.error(f"No final result for job {job_id}")
                await interpretation_jobs.update_job_status(
                    job_id=job_id, status="failed", progress=0,
                    error_message="Pipeline completed but returned no result"
                )
                return

            # Calculate total processing time
            end_time = time.time()
            processing_time_ms = int((end_time - start_time) * 1000)
            final_result_dict["processing_time_ms"] = processing_time_ms
            logger.info(f"Job {job_id} finished in {processing_time_ms}ms")

            await _update(job_id, 95, "Saving results...")

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

            # Mark as completed
            await interpretation_jobs.update_job_status(
                job_id=job_id,
                status="completed",
                progress=100,
                current_step="Analysis complete",
                result=response_data
            )

            # Trigger notification
            try:
                from ..services.notification_service import send_lab_report_ready
                report_type = patient_context.get("report_type", "Lab Report")
                await send_lab_report_ready(
                    user_id=user_id,
                    report_id=report_id,
                    report_type=report_type
                )
            except Exception as e:
                logger.error(f"Failed to send notification for job {job_id}: {e}")

            logger.info(f"Job {job_id} completed successfully")

    except Exception as e:
        logger.error(f"Background processing error for job {job_id}: {e}", exc_info=True)
        await interpretation_jobs.update_job_status(
            job_id=job_id,
            status="failed",
            progress=0,
            error_message=str(e)
        )
