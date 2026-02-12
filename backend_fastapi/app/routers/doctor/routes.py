"""Doctor routes - Main doctor functionality."""
from fastapi import APIRouter, Depends, Body
from pydantic import BaseModel
from ...dependencies.auth import get_current_doctor
from ...services import doctor_service, report_service
from ...models.doctor import DoctorLogin, DoctorUpdate
from ...models.appointment import AppointmentCancel, AppointmentAction, AppointmentReject

router = APIRouter(prefix="/api/doctor", tags=["Doctor"])


class ReportAccessRequest(BaseModel):
    user_id: str
    appointment_id: str


@router.post("/login")
async def login(doctor: DoctorLogin):
    """Login doctor."""
    return await doctor_service.login_doctor(doctor.email, doctor.password)


@router.get("/list")
async def list_doctors():
    """Get list of all doctors (public)."""
    return await doctor_service.get_all_doctors()


@router.get("/appointments")
async def get_appointments(doc_id: str = Depends(get_current_doctor)):
    """Get doctor's appointments."""
    return await doctor_service.get_doctor_appointments(doc_id)


@router.post("/accept-appointment")
async def accept_appointment(data: AppointmentAction, doc_id: str = Depends(get_current_doctor)):
    """Accept a pending appointment."""
    return await doctor_service.accept_doctor_appointment(doc_id, data.appointmentId)


@router.post("/reject-appointment")
async def reject_appointment(data: AppointmentReject, doc_id: str = Depends(get_current_doctor)):
    """Reject a pending appointment with optional reason."""
    return await doctor_service.reject_doctor_appointment(doc_id, data.appointmentId, data.reason)


@router.post("/cancel-appointment")
async def cancel_appointment(data: AppointmentCancel, doc_id: str = Depends(get_current_doctor)):
    """Cancel an appointment."""
    return await doctor_service.cancel_doctor_appointment(doc_id, data.appointmentId)


@router.post("/complete-appointment")
async def complete_appointment(data: AppointmentCancel, doc_id: str = Depends(get_current_doctor)):
    """Mark appointment as completed. Only works for accepted appointments."""
    return await doctor_service.complete_doctor_appointment(doc_id, data.appointmentId)


@router.post("/change-availability")
async def change_availability(doc_id: str = Depends(get_current_doctor)):
    """Toggle doctor availability."""
    return await doctor_service.change_doctor_availability(doc_id)


@router.get("/dashboard")
async def get_dashboard(doc_id: str = Depends(get_current_doctor)):
    """Get doctor dashboard data."""
    return await doctor_service.get_doctor_dashboard(doc_id)


@router.get("/profile")
async def get_profile(doc_id: str = Depends(get_current_doctor)):
    """Get doctor profile."""
    return await doctor_service.get_doctor_profile(doc_id)


@router.post("/update-profile")
async def update_profile(data: DoctorUpdate, doc_id: str = Depends(get_current_doctor)):
    """Update doctor profile."""
    return await doctor_service.update_doctor_profile(
        doc_id=doc_id,
        address=data.address,
        available=data.available,
        about=data.about,
        availability_schedule=data.availability_schedule
    )


# ==================== PATIENT REPORTS ACCESS ====================

@router.post("/request-report-access")
async def request_report_access(
    data: ReportAccessRequest,
    doc_id: str = Depends(get_current_doctor)
):
    """Request access to a patient's lab reports. Requires valid appointment."""
    return await report_service.request_report_access(
        doctor_id=doc_id,
        user_id=data.user_id,
        appointment_id=data.appointment_id
    )


@router.get("/approved-patients")
async def get_approved_patients(doc_id: str = Depends(get_current_doctor)):
    """Get list of patients who have approved report access."""
    return await report_service.get_approved_patients(doc_id)


@router.get("/patient-reports/{user_id}")
async def get_patient_reports(user_id: str, doc_id: str = Depends(get_current_doctor)):
    """Get a patient's reports (only if access was approved)."""
    return await report_service.get_patient_reports_for_doctor(doc_id, user_id)


# ==================== NOTIFICATIONS ====================

@router.get("/notifications")
async def get_notifications(doc_id: str = Depends(get_current_doctor)):
    """Get doctor notifications."""
    from ...core.database import get_notifications_collection
    from bson import ObjectId
    
    notifications = get_notifications_collection()
    cursor = notifications.find({"user_id": doc_id}).sort("created_at", -1).limit(20)
    
    notif_list = []
    async for n in cursor:
        notif_list.append({
            "id": str(n["_id"]),
            "type": n.get("type", ""),
            "message": n.get("message", ""),
            "data": n.get("data", {}),
            "read": n.get("read", False),
            "created_at": n.get("created_at", 0)
        })
    
    return {"success": True, "notifications": notif_list}


@router.post("/notifications/{notif_id}/read")
async def mark_notification_read(notif_id: str, doc_id: str = Depends(get_current_doctor)):
    """Mark a notification as read."""
    from ...core.database import get_notifications_collection
    from bson import ObjectId
    
    notifications = get_notifications_collection()
    
    await notifications.update_one(
        {"_id": ObjectId(notif_id), "user_id": doc_id},
        {"$set": {"read": True}}
    )
    
    return {"success": True}
