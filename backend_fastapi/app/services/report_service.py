"""
Report Service - Handles lab report uploads and management
"""
from bson import ObjectId
from fastapi import UploadFile, HTTPException
import time
from ..core.database import get_reports_collection, get_users_collection
from ..core.cloudinary_config import upload_image_from_bytes


async def upload_report(
    user_id: str,
    file: UploadFile,
    description: str = "",
    report_type: str = "other"
) -> dict:
    """Upload a new lab report for a user."""
    reports = get_reports_collection()
    
    if not ObjectId.is_valid(user_id):
        raise HTTPException(status_code=400, detail="Invalid user id")
    
    # Validate file type
    allowed_types = [
        "image/jpeg", "image/png", "image/gif", "image/webp",
        "application/pdf", 
        "video/mp4", "video/webm", "video/quicktime"
    ]
    
    content_type = file.content_type or "application/octet-stream"
    if content_type not in allowed_types:
        raise HTTPException(
            status_code=400, 
            detail=f"File type '{content_type}' not allowed. Allowed: images, PDF, videos"
        )
    
    # Read file bytes
    file_bytes = await file.read()
    file_size = len(file_bytes)
    
    # Max file size: 10MB
    max_size = 10 * 1024 * 1024
    if file_size > max_size:
        raise HTTPException(status_code=400, detail="File size exceeds 10MB limit")
    
    # Upload to Cloudinary
    try:
        # Determine resource type for cloudinary
        resource_type = "image"
        if content_type.startswith("video/"):
            resource_type = "video"
        elif content_type == "application/pdf":
            resource_type = "raw"
        
        upload_result = await upload_image_from_bytes(
            file_bytes,
            folder=f"reports/{user_id}",
            resource_type=resource_type
        )
        file_url = upload_result.get("secure_url")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")
    
    # Create report document
    report_doc = {
        "user_id": user_id,
        "file_url": file_url,
        "file_type": content_type,
        "original_name": file.filename or "unnamed",
        "description": description,
        "report_type": report_type,
        "file_size": file_size,
        "uploaded_at": int(time.time() * 1000)
    }
    
    result = await reports.insert_one(report_doc)
    report_doc["_id"] = str(result.inserted_id)
    
    return {
        "success": True, 
        "message": "Report uploaded successfully",
        "report": {
            "id": report_doc["_id"],
            "file_url": file_url,
            "original_name": report_doc["original_name"],
            "uploaded_at": report_doc["uploaded_at"]
        }
    }


async def get_user_reports(user_id: str, skip: int = 0, limit: int = 20) -> dict:
    """Get all reports for a user, sorted by upload date (newest first)."""
    reports = get_reports_collection()
    
    if not ObjectId.is_valid(user_id):
        raise HTTPException(status_code=400, detail="Invalid user id")
    
    cursor = reports.find({"user_id": user_id}).sort("uploaded_at", -1).skip(skip).limit(limit)
    
    report_list = []
    async for report in cursor:
        report_list.append({
            "id": str(report["_id"]),
            "file_url": report["file_url"],
            "file_type": report.get("file_type", ""),
            "original_name": report.get("original_name", ""),
            "description": report.get("description", ""),
            "report_type": report.get("report_type", "other"),
            "file_size": report.get("file_size", 0),
            "uploaded_at": report.get("uploaded_at", 0)
        })
    
    # Get total count
    total = await reports.count_documents({"user_id": user_id})
    
    return {
        "success": True,
        "reports": report_list,
        "total": total,
        "skip": skip,
        "limit": limit
    }


async def delete_report(user_id: str, report_id: str) -> dict:
    """Delete a report (user can only delete their own reports)."""
    reports = get_reports_collection()
    
    if not ObjectId.is_valid(user_id) or not ObjectId.is_valid(report_id):
        raise HTTPException(status_code=400, detail="Invalid id")
    
    # Find report and verify ownership
    report = await reports.find_one({"_id": ObjectId(report_id)})
    
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    
    if report["user_id"] != user_id:
        raise HTTPException(status_code=403, detail="You can only delete your own reports")
    
    # Delete from database (Cloudinary cleanup can be done separately)
    await reports.delete_one({"_id": ObjectId(report_id)})
    
    return {"success": True, "message": "Report deleted successfully"}


async def get_report_by_id(report_id: str, user_id: str = None) -> dict:
    """Get a single report by ID. If user_id provided, verify ownership."""
    reports = get_reports_collection()
    
    if not ObjectId.is_valid(report_id):
        raise HTTPException(status_code=400, detail="Invalid report id")
    
    report = await reports.find_one({"_id": ObjectId(report_id)})
    
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    
    if user_id and report["user_id"] != user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    return {
        "success": True,
        "report": {
            "id": str(report["_id"]),
            "user_id": report["user_id"],
            "file_url": report["file_url"],
            "file_type": report.get("file_type", ""),
            "original_name": report.get("original_name", ""),
            "description": report.get("description", ""),
            "report_type": report.get("report_type", "other"),
            "file_size": report.get("file_size", 0),
            "uploaded_at": report.get("uploaded_at", 0)
        }
    }


# ==================== DOCTOR ACCESS REQUEST SYSTEM ====================
from ..core.database import (
    get_report_access_requests_collection, 
    get_appointments_collection,
    get_doctors_collection,
    get_notifications_collection
)


async def request_report_access(doctor_id: str, user_id: str, appointment_id: str) -> dict:
    """
    Doctor requests access to a patient's reports.
    Validates that there is an appointment between doctor and patient.
    """
    requests = get_report_access_requests_collection()
    appointments = get_appointments_collection()
    doctors = get_doctors_collection()
    notifications = get_notifications_collection()
    
    # Validate IDs
    for id_val, id_name in [(doctor_id, "doctor"), (user_id, "user"), (appointment_id, "appointment")]:
        if not ObjectId.is_valid(id_val):
            raise HTTPException(status_code=400, detail=f"Invalid {id_name} id")
    
    # Verify appointment exists and belongs to this doctor-patient pair
    appointment = await appointments.find_one({
        "_id": ObjectId(appointment_id),
        "docId": ObjectId(doctor_id),
        "userId": ObjectId(user_id)
    })
    
    if not appointment:
        raise HTTPException(
            status_code=403, 
            detail="No valid appointment found. You must have an appointment with this patient."
        )
    
    # Check for existing pending request
    existing = await requests.find_one({
        "doctor_id": doctor_id,
        "user_id": user_id,
        "status": "pending"
    })
    
    if existing:
        return {"success": False, "message": "You already have a pending request for this patient"}
    
    # Get doctor info for notification
    doctor = await doctors.find_one({"_id": ObjectId(doctor_id)})
    doctor_name = doctor.get("name", "A doctor") if doctor else "A doctor"
    
    # Create access request
    request_doc = {
        "doctor_id": doctor_id,
        "user_id": user_id,
        "appointment_id": appointment_id,
        "status": "pending",
        "requested_at": int(time.time() * 1000),
        "resolved_at": None
    }
    
    result = await requests.insert_one(request_doc)
    request_id = str(result.inserted_id)
    
    # Create notification for user
    notification_doc = {
        "user_id": user_id,
        "type": "report_access_request",
        "message": f"Dr. {doctor_name} is requesting access to view your lab reports",
        "data": {
            "request_id": request_id,
            "doctor_id": doctor_id,
            "doctor_name": doctor_name
        },
        "read": False,
        "created_at": int(time.time() * 1000)
    }
    
    await notifications.insert_one(notification_doc)
    
    return {
        "success": True, 
        "message": "Access request sent. Waiting for patient approval.",
        "request_id": request_id
    }


async def get_pending_access_requests(user_id: str) -> dict:
    """Get all pending access requests for a user."""
    requests = get_report_access_requests_collection()
    doctors = get_doctors_collection()
    
    if not ObjectId.is_valid(user_id):
        raise HTTPException(status_code=400, detail="Invalid user id")
    
    cursor = requests.find({"user_id": user_id, "status": "pending"}).sort("requested_at", -1)
    
    request_list = []
    async for req in cursor:
        # Get doctor info
        doctor = await doctors.find_one({"_id": ObjectId(req["doctor_id"])})
        doctor_name = doctor.get("name", "Unknown") if doctor else "Unknown"
        doctor_speciality = doctor.get("speciality", "") if doctor else ""
        doctor_image = doctor.get("image", "") if doctor else ""
        
        request_list.append({
            "id": str(req["_id"]),
            "doctor_id": req["doctor_id"],
            "doctor_name": doctor_name,
            "doctor_speciality": doctor_speciality,
            "doctor_image": doctor_image,
            "requested_at": req["requested_at"]
        })
    
    return {"success": True, "requests": request_list}


async def approve_access_request(user_id: str, request_id: str) -> dict:
    """User approves a doctor's access request."""
    requests = get_report_access_requests_collection()
    
    if not ObjectId.is_valid(request_id):
        raise HTTPException(status_code=400, detail="Invalid request id")
    
    req = await requests.find_one({"_id": ObjectId(request_id)})
    
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    
    if req["user_id"] != user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    if req["status"] != "pending":
        return {"success": False, "message": "Request already resolved"}
    
    await requests.update_one(
        {"_id": ObjectId(request_id)},
        {"$set": {"status": "approved", "resolved_at": int(time.time() * 1000)}}
    )
    
    return {"success": True, "message": "Access approved. Doctor can now view your reports."}


async def deny_access_request(user_id: str, request_id: str) -> dict:
    """User denies a doctor's access request."""
    requests = get_report_access_requests_collection()
    
    if not ObjectId.is_valid(request_id):
        raise HTTPException(status_code=400, detail="Invalid request id")
    
    req = await requests.find_one({"_id": ObjectId(request_id)})
    
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    
    if req["user_id"] != user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    if req["status"] != "pending":
        return {"success": False, "message": "Request already resolved"}
    
    await requests.update_one(
        {"_id": ObjectId(request_id)},
        {"$set": {"status": "denied", "resolved_at": int(time.time() * 1000)}}
    )
    
    return {"success": True, "message": "Access request denied."}


async def get_patient_reports_for_doctor(doctor_id: str, user_id: str) -> dict:
    """
    Doctor gets a patient's reports - only if access was approved.
    """
    requests = get_report_access_requests_collection()
    reports = get_reports_collection()
    
    # Check if doctor has approved access
    access = await requests.find_one({
        "doctor_id": doctor_id,
        "user_id": user_id,
        "status": "approved"
    })
    
    if not access:
        raise HTTPException(
            status_code=403, 
            detail="Access denied. You need patient approval to view their reports."
        )
    
    # Fetch patient's reports
    cursor = reports.find({"user_id": user_id}).sort("uploaded_at", -1)
    
    report_list = []
    async for report in cursor:
        report_list.append({
            "id": str(report["_id"]),
            "file_url": report["file_url"],
            "file_type": report.get("file_type", ""),
            "original_name": report.get("original_name", ""),
            "description": report.get("description", ""),
            "report_type": report.get("report_type", "other"),
            "uploaded_at": report.get("uploaded_at", 0)
        })
    
    return {"success": True, "reports": report_list}


async def get_approved_patients(doctor_id: str) -> dict:
    """Get list of patients who have approved report access for this doctor."""
    requests = get_report_access_requests_collection()
    users = get_users_collection()
    
    if not ObjectId.is_valid(doctor_id):
        raise HTTPException(status_code=400, detail="Invalid doctor id")
    
    cursor = requests.find({"doctor_id": doctor_id, "status": "approved"})
    
    patient_list = []
    seen_users = set()
    
    async for req in cursor:
        user_id = req["user_id"]
        if user_id in seen_users:
            continue
        seen_users.add(user_id)
        
        user = await users.find_one({"_id": ObjectId(user_id)})
        if user:
            patient_list.append({
                "id": user_id,
                "name": user.get("name", "Unknown"),
                "email": user.get("email", ""),
                "image": user.get("image", ""),
                "approved_at": req.get("resolved_at", 0)
            })
    
    return {"success": True, "patients": patient_list}
