"""
Interpretation Job Management Service
======================================
Manages background interpretation jobs with status tracking and progress updates.
"""

import uuid
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from motor.motor_asyncio import AsyncIOMotorCollection

from ...core.database import get_database


def get_jobs_collection() -> AsyncIOMotorCollection:
    """Get the interpretation_jobs collection."""
    db = get_database()
    return db["interpretation_jobs"]


async def create_job(report_id: str, user_id: str, patient_context: Dict[str, Any]) -> str:
    """
    Create a new interpretation job.
    
    Args:
        report_id: ID of the report to interpret
        user_id: ID of the user requesting interpretation
        patient_context: Patient context data
        
    Returns:
        Job ID (UUID string)
    """
    collection = get_jobs_collection()
    
    job_id = str(uuid.uuid4())
    job_doc = {
        "job_id": job_id,
        "report_id": report_id,
        "user_id": user_id,
        "patient_context": patient_context,
        "status": "pending",
        "progress": 0,
        "current_step": "Initializing...",
        "result": None,
        "error_message": None,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    
    await collection.insert_one(job_doc)
    return job_id


async def update_job_status(
    job_id: str,
    status: Optional[str] = None,
    progress: Optional[int] = None,
    current_step: Optional[str] = None,
    result: Optional[Dict[str, Any]] = None,
    error_message: Optional[str] = None
) -> bool:
    """
    Update job status and progress.
    
    Args:
        job_id: Job ID to update
        status: New status (pending, processing, completed, failed)
        progress: Progress percentage (0-100)
        current_step: Current processing step description
        result: Final interpretation result (when completed)
        error_message: Error message (when failed)
        
    Returns:
        True if job was updated, False if not found
    """
    collection = get_jobs_collection()
    
    update_data = {"updated_at": datetime.utcnow()}
    
    if status is not None:
        update_data["status"] = status
    if progress is not None:
        update_data["progress"] = min(100, max(0, progress))
    if current_step is not None:
        update_data["current_step"] = current_step
    if result is not None:
        update_data["result"] = result
    if error_message is not None:
        update_data["error_message"] = error_message
    
    result = await collection.update_one(
        {"job_id": job_id},
        {"$set": update_data}
    )
    
    return result.modified_count > 0


async def get_job_status(job_id: str) -> Optional[Dict[str, Any]]:
    """
    Get current job status and details.
    
    Args:
        job_id: Job ID to retrieve
        
    Returns:
        Job document or None if not found
    """
    collection = get_jobs_collection()
    job = await collection.find_one({"job_id": job_id})
    
    if job:
        # Remove MongoDB _id for cleaner response
        job.pop("_id", None)
    
    return job


async def get_job_by_report(report_id: str) -> Optional[Dict[str, Any]]:
    """
    Get the most recent job for a report.
    
    Args:
        report_id: Report ID
        
    Returns:
        Job document or None if not found
    """
    collection = get_jobs_collection()
    job = await collection.find_one(
        {"report_id": report_id},
        sort=[("created_at", -1)]
    )
    
    if job:
        job.pop("_id", None)
    
    return job


async def cleanup_old_jobs(days: int = 1) -> int:
    """
    Delete completed/failed jobs older than specified days.
    
    Args:
        days: Age threshold in days
        
    Returns:
        Number of jobs deleted
    """
    collection = get_jobs_collection()
    cutoff_date = datetime.utcnow() - timedelta(days=days)
    
    result = await collection.delete_many({
        "status": {"$in": ["completed", "failed"]},
        "created_at": {"$lt": cutoff_date}
    })
    
    return result.deleted_count


async def ensure_indexes():
    """Create necessary indexes for the jobs collection."""
    collection = get_jobs_collection()
    
    # Unique index on job_id
    await collection.create_index("job_id", unique=True)
    
    # Index on report_id for quick lookups
    await collection.create_index("report_id")
    
    # TTL index to auto-delete old jobs after 7 days
    await collection.create_index(
        "created_at",
        expireAfterSeconds=7 * 24 * 60 * 60  # 7 days
    )
    
    # Compound index for user queries
    await collection.create_index([("user_id", 1), ("created_at", -1)])
