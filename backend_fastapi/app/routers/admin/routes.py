"""Admin routes - Main admin functionality."""
from fastapi import APIRouter, Depends, UploadFile, File, Form, Body
from typing import Optional
from pydantic import BaseModel
from ...dependencies.auth import get_current_admin
from ...services import admin_service, doctor_service, analytics_service

router = APIRouter(prefix="/api/admin", tags=["Admin"])


class AdminLogin(BaseModel):
    email: str
    password: str


class AppointmentCancel(BaseModel):
    appointmentId: str


class ChangeAvailability(BaseModel):
    docId: str


@router.post("/login")
async def login(data: AdminLogin):
    """Login admin."""
    return await admin_service.login_admin(data.email, data.password)


@router.post("/add-doctor")
async def add_doctor(
    name: str = Form(...),
    email: str = Form(...),
    password: str = Form(...),
    speciality: str = Form(...),
    degree: str = Form(...),
    experience: str = Form(...),
    about: str = Form(...),
    fees: float = Form(0.0),
    address: str = Form(...),
    image: Optional[UploadFile] = File(None),
    _: bool = Depends(get_current_admin)
):
    """Add a new doctor."""
    image_bytes = None
    if image:
        image_bytes = await image.read()
    
    return await admin_service.add_doctor(
        name=name,
        email=email,
        password=password,
        speciality=speciality,
        degree=degree,
        experience=experience,
        about=about,
        fees=fees,
        address=address,
        image_bytes=image_bytes
    )


@router.get("/all-doctors")
async def get_all_doctors(_: bool = Depends(get_current_admin)):
    """Get all doctors."""
    return await admin_service.get_all_doctors_admin()


@router.post("/change-availability")
async def change_availability(data: ChangeAvailability, _: bool = Depends(get_current_admin)):
    """Toggle doctor availability."""
    return await admin_service.change_doctor_availability_admin(data.docId)


@router.get("/appointments")
async def get_appointments(_: bool = Depends(get_current_admin)):
    """Get all appointments."""
    return await admin_service.get_all_appointments_admin()


@router.post("/cancel-appointment")
async def cancel_appointment(data: AppointmentCancel, _: bool = Depends(get_current_admin)):
    """Cancel an appointment."""
    return await admin_service.cancel_appointment_admin(data.appointmentId)


@router.get("/dashboard")
async def get_dashboard(_: bool = Depends(get_current_admin)):
    """Get admin dashboard data (legacy - basic stats)."""
    return await admin_service.get_admin_dashboard()


# ============== NEW ANALYTICS ENDPOINTS ==============

@router.get("/dashboard/stats")
async def get_platform_stats(_: bool = Depends(get_current_admin)):
    """Get comprehensive platform statistics for admin dashboard KPIs."""
    stats = await analytics_service.get_platform_stats()
    return {"success": True, "stats": stats}


@router.get("/dashboard/doctor-performance")
async def get_doctor_performance(_: bool = Depends(get_current_admin)):
    """Get performance metrics for all doctors."""
    performance = await analytics_service.get_doctor_performance()
    return {"success": True, "doctors": performance}


@router.get("/dashboard/appointment-analytics")
async def get_appointment_analytics(_: bool = Depends(get_current_admin)):
    """Get appointment analytics for charts."""
    analytics = await analytics_service.get_appointment_analytics()
    return {"success": True, "analytics": analytics}


@router.get("/dashboard/activity")
async def get_recent_activity(_: bool = Depends(get_current_admin)):
    """Get recent platform activity feed."""
    activity = await analytics_service.get_recent_activity(limit=10)
    return {"success": True, "activity": activity}


@router.get("/dashboard/registrations")
async def get_registration_stats(period: str = 'month', _: bool = Depends(get_current_admin)):
    """Get registration statistics (users and doctors) for a period."""
    stats = await analytics_service.get_registration_stats(period=period)
    return {"success": True, "stats": stats}


# ============== PATIENT MANAGEMENT ==============

class PatientDelete(BaseModel):
    patientId: str


@router.get("/all-patients")
async def get_all_patients(_: bool = Depends(get_current_admin)):
    """Get all patients."""
    return await admin_service.get_all_patients_admin()


@router.get("/patient/{patient_id}")
async def get_patient_details(patient_id: str, _: bool = Depends(get_current_admin)):
    """Get detailed information about a specific patient."""
    return await admin_service.get_patient_details_admin(patient_id)



class DoctorDelete(BaseModel):
    docId: str


@router.post("/delete-patient")
async def delete_patient(data: PatientDelete, _: bool = Depends(get_current_admin)):
    """Delete a patient and their associated data."""
    return await admin_service.delete_patient_admin(data.patientId)


@router.post("/delete-doctor")
async def delete_doctor(data: DoctorDelete, _: bool = Depends(get_current_admin)):
    """Delete a doctor and their associated data."""
    return await admin_service.delete_doctor_admin(data.docId)
