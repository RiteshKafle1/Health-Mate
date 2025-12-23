from fastapi import APIRouter, Depends, UploadFile, File, Form, Body
from typing import Optional
from pydantic import BaseModel
from ..dependencies.auth import get_current_admin
from ..services import admin_service, doctor_service

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
    fees: float = Form(...),
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
    """Get admin dashboard data."""
    return await admin_service.get_admin_dashboard()
