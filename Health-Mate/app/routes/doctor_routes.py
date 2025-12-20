from fastapi import APIRouter, Depends, Body
from ..dependencies.auth import get_current_doctor
from ..services import doctor_service
from ..models.doctor_model import DoctorLogin, DoctorUpdate
from ..models.appointment_model import AppointmentCancel

router = APIRouter(prefix="/api/doctor", tags=["Doctor"])


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


@router.post("/cancel-appointment")
async def cancel_appointment(data: AppointmentCancel, doc_id: str = Depends(get_current_doctor)):
    """Cancel an appointment."""
    return await doctor_service.cancel_doctor_appointment(doc_id, data.appointmentId)


@router.post("/complete-appointment")
async def complete_appointment(data: AppointmentCancel, doc_id: str = Depends(get_current_doctor)):
    """Mark appointment as completed."""
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
        fees=data.fees,
        address=data.address,
        available=data.available,
        about=data.about
    )
