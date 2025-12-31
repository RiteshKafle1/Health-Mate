"""User routes - Main user functionality."""
from fastapi import APIRouter, Depends, UploadFile, File, Form
from typing import Optional
from bson import ObjectId
from ...dependencies.auth import get_current_user
from ...services import user_service, payment_service, report_service
from ...models.user import UserCreate, UserLogin
from ...models.appointment import AppointmentCreate, AppointmentCancel, PaymentRequest, RazorpayVerify
from ...middleware.rate_limiter import rate_limit_login, rate_limit_registration
from ...core.database import get_notifications_collection

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
    weight: str = Form(None),
    height: str = Form(None),
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
        weight=weight,
        height=height,
        image_bytes=image_bytes
    )


# ==================== LAB REPORTS ====================

@router.post("/reports")
async def upload_report(
    file: UploadFile = File(...),
    description: str = Form(""),
    report_type: str = Form("other"),
    user_id: str = Depends(get_current_user)
):
    """Upload a lab report or medical document."""
    return await report_service.upload_report(
        user_id=user_id,
        file=file,
        description=description,
        report_type=report_type
    )

@router.get("/reports")
async def get_reports(
    skip: int = 0,
    limit: int = 20,
    user_id: str = Depends(get_current_user)
):
    """Get all user's lab reports, sorted by date."""
    return await report_service.get_user_reports(user_id, skip, limit)

@router.get("/reports/{report_id}")
async def get_report(
    report_id: str,
    user_id: str = Depends(get_current_user)
):
    """Get a single report by ID."""
    return await report_service.get_report_by_id(report_id, user_id)

@router.delete("/reports/{report_id}")
async def delete_report(
    report_id: str,
    user_id: str = Depends(get_current_user)
):
    """Delete a user's report."""
    return await report_service.delete_report(user_id, report_id)


# ==================== APPOINTMENTS ====================

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


# ==================== PAYMENTS ====================

@router.post("/payment-razorpay")
async def payment_razorpay(data: PaymentRequest, user_id: str = Depends(get_current_user)):
    """Create Razorpay order."""
    return await payment_service.create_razorpay_order(data.appointmentId)


@router.post("/verifyRazorpay")
async def verify_razorpay(data: RazorpayVerify, user_id: str = Depends(get_current_user)):
    """Verify Razorpay payment."""
    return await payment_service.verify_razorpay_payment(data.razorpay_order_id)


# ==================== REPORT ACCESS REQUESTS ====================

@router.get("/report-access-requests")
async def get_access_requests(user_id: str = Depends(get_current_user)):
    """Get pending report access requests from doctors."""
    return await report_service.get_pending_access_requests(user_id)


@router.post("/report-access-requests/{request_id}/approve")
async def approve_request(request_id: str, user_id: str = Depends(get_current_user)):
    """Approve a doctor's access request."""
    return await report_service.approve_access_request(user_id, request_id)


@router.post("/report-access-requests/{request_id}/deny")
async def deny_request(request_id: str, user_id: str = Depends(get_current_user)):
    """Deny a doctor's access request."""
    return await report_service.deny_access_request(user_id, request_id)


# ==================== NOTIFICATIONS ====================

@router.get("/notifications")
async def get_notifications(user_id: str = Depends(get_current_user)):
    """Get user notifications."""
    notifications = get_notifications_collection()
    cursor = notifications.find({"user_id": user_id}).sort("created_at", -1).limit(20)
    
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
async def mark_notification_read(notif_id: str, user_id: str = Depends(get_current_user)):
    """Mark a notification as read."""
    notifications = get_notifications_collection()
    
    await notifications.update_one(
        {"_id": ObjectId(notif_id), "user_id": user_id},
        {"$set": {"read": True}}
    )
    
    return {"success": True}


# ==================== NOTIFICATION PREFERENCES ====================

@router.get("/notification-preferences")
async def get_preferences(user_id: str = Depends(get_current_user)):
    """Get user's notification preferences."""
    from ...services.notification_service import get_notification_preferences
    return await get_notification_preferences(user_id)


@router.put("/notification-preferences")
async def update_preferences(
    preferences: dict,
    user_id: str = Depends(get_current_user)
):
    """Update user's notification preferences."""
    from ...services.notification_service import update_notification_preferences
    return await update_notification_preferences(user_id, preferences)
