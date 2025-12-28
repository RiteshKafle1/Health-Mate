from fastapi import APIRouter, Depends, UploadFile, File, Form
from typing import Optional
from ..dependencies.auth import get_current_user
from ..services import user_service, payment_service
from ..models.user import UserCreate, UserLogin
from ..models.appointment import AppointmentCreate, AppointmentCancel, PaymentRequest, RazorpayVerify
from ..middleware.rate_limiter import rate_limit_login, rate_limit_registration

router = APIRouter(prefix="/api/user", tags=["User"])


@router.post("/register", dependencies=[Depends(rate_limit_registration)])
async def register(user: UserCreate):
    """Register a new user. Rate limited to 3 attempts per hour per IP."""
    return await user_service.register_user(user.name, user.email, user.password)


@router.post("/login", dependencies=[Depends(rate_limit_login)])
async def login(user: UserLogin):
    """Login user. Rate limited to 5 attempts per 15 minutes per IP."""
    return await user_service.login_user(user.email, user.password)


@router.get("/get-profile")
async def get_profile(user_id: str = Depends(get_current_user)):
    """Get user profile."""
    return await user_service.get_user_profile(user_id)


@router.post("/update-profile")
async def update_profile(
    name: str = Form(...),
    phone: str = Form(...),
    address: str = Form(...),
    dob: str = Form(...),
    gender: str = Form(...),
    image: Optional[UploadFile] = File(None),
    user_id: str = Depends(get_current_user)
):
    """Update user profile."""
    image_bytes = None
    if image:
        image_bytes = await image.read()
    
    return await user_service.update_user_profile(
        user_id=user_id,
        name=name,
        phone=phone,
        address=address,
        dob=dob,
        gender=gender,
        image_bytes=image_bytes
    )


@router.post("/book-appointment")
async def book_appointment(appointment: AppointmentCreate, user_id: str = Depends(get_current_user)):
    """Book an appointment."""
    return await user_service.book_appointment(
        user_id=user_id,
        doc_id=appointment.docId,
        slot_date=appointment.slotDate,
        slot_time=appointment.slotTime
    )


@router.get("/appointments")
async def list_appointments(user_id: str = Depends(get_current_user)):
    """Get all user appointments."""
    return await user_service.list_user_appointments(user_id)


@router.post("/cancel-appointment")
async def cancel_appointment(data: AppointmentCancel, user_id: str = Depends(get_current_user)):
    """Cancel an appointment."""
    return await user_service.cancel_user_appointment(user_id, data.appointmentId)


@router.post("/payment-razorpay")
async def payment_razorpay(data: PaymentRequest, user_id: str = Depends(get_current_user)):
    """Create Razorpay order."""
    return await payment_service.create_razorpay_order(data.appointmentId)


@router.post("/verifyRazorpay")
async def verify_razorpay(data: RazorpayVerify, user_id: str = Depends(get_current_user)):
    """Verify Razorpay payment."""
    return await payment_service.verify_razorpay_payment(data.razorpay_order_id)
