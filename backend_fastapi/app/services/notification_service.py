"""
Unified Notification Service
Handles all notification types: profile completion, medication reminders, 
appointments, health check-ins, and future browser push notifications.
"""
from bson import ObjectId
from datetime import datetime, timedelta
from typing import Optional, Dict, List
from ..core.database import get_notifications_collection, get_users_collection, get_medications_collection, get_appointments_collection
import time

# Notification Types Enum
NOTIFICATION_TYPES = {
    # Profile
    "profile_incomplete": "Profile Completion",
    "welcome": "Welcome",
    # Medication
    "medication_reminder": "Medication Reminder",
    "medication_low_stock": "Low Stock Alert",
    "medication_missed": "Missed Dose",
    "medication_out_of_stock": "Out of Stock",
    # Appointment
    "appointment_confirmed": "Appointment Confirmed",
    "appointment_reminder": "Appointment Reminder",
    "appointment_completed": "Appointment Completed",
    "appointment_cancelled": "Appointment Cancelled",
    "appointment_accepted": "Appointment Accepted",
    "appointment_rejected": "Appointment Rejected",
    "appointment_booked": "New Appointment Booked",

    "appointment_user_cancelled": "Patient Cancelled",
    "appointment_admin_cancelled": "Admin Cancelled",
    "appointment_missed": "Appointment Missed",
    "payment_success": "Payment Successful",
    # Health
    "health_checkin": "Health Check-in",
    # Reports
    "report_access_request": "Report Access Request",
    "report_access_approved": "Access Approved",
    "report_access_denied": "Access Denied",
    "lab_report_uploaded": "Lab Report Uploaded",
    "lab_report_ready": "Lab Results Ready",
}

# Default notification preferences
DEFAULT_NOTIFICATION_PREFERENCES = {
    "profile_reminders": True,
    "medication_reminders": True,
    "appointment_reminders": True,
    "health_checkins": False,
    "low_stock_alerts": True,
    "push_enabled": False  # Future: browser push
}


# ==================== CORE NOTIFICATION FUNCTIONS ====================

async def create_notification(
    user_id: str,
    notification_type: str,
    message: str,
    data: Dict = None,
    priority: str = "medium",
    action_url: str = None,
    expires_at: int = None
) -> dict:
    """
    Create a notification for a user.
    
    Args:
        user_id: User ID
        notification_type: Type from NOTIFICATION_TYPES
        message: Human-readable message
        data: Type-specific data (medication_id, appointment_id, etc.)
        priority: "low", "medium", "high", "urgent"
        action_url: Optional frontend route to navigate
        expires_at: Optional expiration timestamp (milliseconds)
    
    Returns:
        dict with success status and notification
    """
    notifications = get_notifications_collection()
    
    notification_data = {
        "user_id": user_id,
        "type": notification_type,
        "title": NOTIFICATION_TYPES.get(notification_type, "Notification"),
        "message": message,
        "data": data or {},
        "priority": priority,
        "read": False,
        "created_at": int(time.time() * 1000),
        "action_url": action_url,
        "expires_at": expires_at
    }
    
    result = await notifications.insert_one(notification_data)
    notification_data["_id"] = str(result.inserted_id)
    notification_data["id"] = str(result.inserted_id)
    
    # === REAL-TIME DELIVERY ===
    # Cache in Redis for quick access
    try:
        from ..redis.notification_cache import cache_notification
        await cache_notification(user_id, notification_data)
    except Exception as e:
        print(f"Redis cache warning: {e}")
    
    # Emit via Socket.IO for instant delivery
    try:
        from ..sockets import emit_to_user
        await emit_to_user(user_id, "new_notification", notification_data)
    except Exception as e:
        print(f"Socket emit warning: {e}")
    
    return {
        "success": True,
        "notification": notification_data
    }


async def get_user_notifications(user_id: str, unread_only: bool = False, limit: int = 20) -> dict:
    """Get notifications for a user."""
    notifications = get_notifications_collection()
    
    query = {"user_id": user_id}
    if unread_only:
        query["read"] = False
    
    cursor = notifications.find(query).sort("created_at", -1).limit(limit)
    notif_list = []
    
    async for n in cursor:
        notif_list.append({
            "id": str(n["_id"]),
            "type": n.get("type", ""),
            "message": n.get("message", ""),
            "data": n.get("data", {}),
            "priority": n.get("priority", "medium"),
            "read": n.get("read", False),
            "created_at": n.get("created_at", 0),
            "action_url": n.get("action_url")
        })
    
    return {
        "success": True,
        "notifications": notif_list
    }


async def create_multi_role_notification(notifications_list: List[Dict]) -> List[Dict]:
    """
    Create specific notifications for multiple users/roles from a single event.
    
    Args:
        notifications_list: List of dicts, each containing:
            - user_id: Target user ID
            - type: Notification type
            - message: Message for this user
            - data: Optional data
            - priority: Optional priority
            
    Returns:
        List of created notification results
    """
    results = []
    for n in notifications_list:
        try:
            res = await create_notification(
                user_id=n["user_id"],
                notification_type=n["type"],
                message=n["message"],
                data=n.get("data"),
                priority=n.get("priority", "medium"),
                action_url=n.get("action_url")
            )
            results.append(res)
        except Exception as e:
            print(f"Error creating notification for {n.get('user_id')}: {e}")
    
    return results


async def mark_as_read(notification_id: str) -> dict:
    """Mark a notification as read."""
    notifications = get_notifications_collection()
    
    result = await notifications.update_one(
        {"_id": ObjectId(notification_id)},
        {"$set": {"read": True}}
    )
    
    return {"success": result.modified_count > 0}


async def mark_all_as_read(user_id: str) -> dict:
    """Mark all notifications for a user as read."""
    notifications = get_notifications_collection()
    
    result = await notifications.update_many(
        {"user_id": user_id, "read": False},
        {"$set": {"read": True}}
    )
    
    return {
        "success": True, 
        "modified_count": result.modified_count
    }


async def delete_notification(user_id: str, notification_id: str) -> dict:
    """Delete a notification."""
    notifications = get_notifications_collection()
    
    result = await notifications.delete_one({
        "_id": ObjectId(notification_id),
        "user_id": user_id
    })
    
    if result.deleted_count == 0:
        return {"success": False, "message": "Notification not found"}
        
    return {"success": True}


# ==================== PROFILE COMPLETION ====================

def calculate_profile_completion(user_data: dict) -> int:
    """
    Calculate profile completion percentage based on 8 fields:
    - name (always present at signup)
    - phone
    - address.line1
    - address.line2
    - gender
    - dob
    - weight
    - height
    - image (not default)
    
    Returns: 0-100 percentage
    """
    fields_checked = 0
    fields_completed = 0
    
    # Name (always present, always counts as completed)
    fields_checked += 1
    if user_data.get("name"):
        fields_completed += 1
    
    # Phone
    fields_checked += 1
    phone = user_data.get("phone", "")
    if phone and phone != "000000000":  # Not default
        fields_completed += 1
    
    # Address line1
    fields_checked += 1
    address = user_data.get("address", {})
    if isinstance(address, dict):
        if address.get("line1"):
            fields_completed += 1
    
    # Address line2
    fields_checked += 1
    if isinstance(address, dict):
        if address.get("line2"):
            fields_completed += 1
    
    # Gender
    fields_checked += 1
    gender = user_data.get("gender", "")
    if gender and gender != "Not Selected":
        fields_completed += 1
    
    # Date of Birth
    fields_checked += 1
    dob = user_data.get("dob", "")
    if dob and dob != "Not Selected":
        fields_completed += 1
    
    # Weight
    fields_checked += 1
    weight = user_data.get("weight", "")
    if weight and weight != "Not Set":
        fields_completed += 1
    
    # Height
    fields_checked += 1
    height = user_data.get("height", "")
    if height and height != "Not Set":
        fields_completed += 1
    
    # Image (check if not default)
    fields_checked += 1
    image = user_data.get("image", "")
    default_image_start = "data:image/png;base64,iVBORw0KGgo"
    if image and not image.startswith(default_image_start):
        fields_completed += 1
    
    # Calculate percentage
    if fields_checked == 0:
        return 0
    
    percentage = int((fields_completed / fields_checked) * 100)
    return percentage


def should_send_profile_reminder(user_data: dict) -> bool:
    """
    Check if should send profile reminder based on:
    - Profile is incomplete (< 100%)
    - User has profile_reminders enabled
    - 15 hours have passed since last reminder
    """
    # Check if profile is complete
    completion = calculate_profile_completion(user_data)
    if completion >= 100:
        return False
    
    # Check notification preferences
    prefs = user_data.get("notification_preferences", DEFAULT_NOTIFICATION_PREFERENCES)
    if not prefs.get("profile_reminders", True):
        return False
    
    # Check last reminder time (15 hours = 54000000 milliseconds)
    last_reminder_at = user_data.get("last_profile_reminder_at", 0)
    current_time = int(time.time() * 1000)
    time_since_last = current_time - last_reminder_at
    
    # 15 hours in milliseconds
    fifteen_hours_ms = 15 * 60 * 60 * 1000
    
    return time_since_last >= fifteen_hours_ms


async def send_profile_completion_reminder(user_id: str) -> dict:
    """Send profile completion reminder notification."""
    users = get_users_collection()
    
    # Get user data to calculate completion percentage
    user = await users.find_one({"_id": ObjectId(user_id)})
    if not user:
        return {"success": False, "message": "User not found"}
    
    completion = calculate_profile_completion(user)
    
    message = f"Your profile is {completion}% complete. Complete your profile to get personalized health recommendations!"
    
    result = await create_notification(
        user_id=user_id,
        notification_type="profile_incomplete",
        message=message,
        data={"completion_percentage": completion},
        priority="medium",
        action_url="/profile"
    )
    
    # Update last reminder timestamp
    await users.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"last_profile_reminder_at": int(time.time() * 1000)}}
    )
    
    return result


# ==================== MEDICATION REMINDERS ====================

async def send_medication_reminder(user_id: str, medication_id: str, medication_name: str, time_slot: str) -> dict:
    """Send medication dose reminder."""
    message = f"⏰ Time to take your {medication_name} - {time_slot}"
    
    return await create_notification(
        user_id=user_id,
        notification_type="medication_reminder",
        message=message,
        data={
            "medication_id": medication_id,
            "medication_name": medication_name,
            "time_slot": time_slot
        },
        priority="high",
        action_url="/medications"
    )


async def check_upcoming_doses(user_id: str) -> List[dict]:
    """
    Check for upcoming medication doses (within next 15 minutes).
    Called by scheduler every 30 minutes.
    Returns list of notifications sent.
    """
    users = get_users_collection()
    medications = get_medications_collection()
    
    # Check if user has medication reminders enabled
    user = await users.find_one({"_id": ObjectId(user_id)})
    if not user:
        return []
    
    prefs = user.get("notification_preferences", DEFAULT_NOTIFICATION_PREFERENCES)
    if not prefs.get("medication_reminders", True):
        return []
    
    # Get active medications
    cursor = medications.find({"user_id": user_id, "is_active": True})
    notifications_sent = []
    
    current_time = datetime.now()
    current_time_str = current_time.strftime("%H:%M")
    
    async for med in cursor:
        schedule_times = med.get("schedule_times", [])
        doses_taken_today = med.get("doses_taken_today", {})
        doses_taken_date = med.get("doses_taken_date")
        today = current_time.strftime("%Y-%m-%d")
        
        # Reset if new day
        if doses_taken_date != today:
            doses_taken_today = {}
        
        for time_slot in schedule_times:
            # Skip if already taken
            if doses_taken_today.get(time_slot, False):
                continue
            
            # Parse scheduled time
            try:
                scheduled_time = datetime.strptime(time_slot, "%H:%M").time()
                scheduled_datetime = datetime.combine(current_time.date(), scheduled_time)
                
                # Check if dose is within next 15 minutes
                time_diff = (scheduled_datetime - current_time).total_seconds() / 60
                
                if 0 <= time_diff <= 15:
                    # Send reminder
                    result = await send_medication_reminder(
                        user_id=user_id,
                        medication_id=str(med["_id"]),
                        medication_name=med.get("name", "medication"),
                        time_slot=time_slot
                    )
                    notifications_sent.append(result)
            except:
                continue
    
    return notifications_sent


async def send_low_stock_alert(user_id: str, medication_id: str, medication_name: str, days_remaining: int) -> dict:
    """Send low stock alert notification."""
    if days_remaining <= 3:
        message = f"🚨 URGENT: {medication_name} - Only {days_remaining} days left! Please refill soon."
        priority = "urgent"
    elif days_remaining <= 7:
        message = f"⚠️ Low stock: {medication_name} - {days_remaining} days remaining. Consider refilling."
        priority = "high"
    else:
        message = f"📦 {medication_name} stock getting low - {days_remaining} days remaining."
        priority = "medium"
    
    return await create_notification(
        user_id=user_id,
        notification_type="medication_low_stock",
        message=message,
        data={
            "medication_id": medication_id,
            "medication_name": medication_name,
            "days_remaining": days_remaining
        },
        priority=priority,
        action_url="/medications"
    )


# ==================== APPOINTMENT NOTIFICATIONS ====================

async def send_appointment_confirmation(user_id: str, appointment_id: str, doctor_name: str, slot_date: str, slot_time: str) -> dict:
    """Send appointment booking confirmation."""
    message = f"✓ Appointment confirmed with Dr. {doctor_name} on {slot_date} at {slot_time}"
    
    return await create_notification(
        user_id=user_id,
        notification_type="appointment_confirmed",
        message=message,
        data={
            "appointment_id": appointment_id,
            "doctor_name": doctor_name,
            "slot_date": slot_date,
            "slot_time": slot_time
        },
        priority="medium",
        action_url="/appointments"
    )


async def send_appointment_reminder(user_id: str, appointment_id: str, doctor_name: str, slot_date: str, slot_time: str) -> dict:
    """Send 24-hour appointment reminder."""
    message = f"📅 Reminder: Appointment with Dr. {doctor_name} tomorrow at {slot_time}"
    
    return await create_notification(
        user_id=user_id,
        notification_type="appointment_reminder",
        message=message,
        data={
            "appointment_id": appointment_id,
            "doctor_name": doctor_name,
            "slot_date": slot_date,
            "slot_time": slot_time
        },
        priority="high",
        action_url="/appointments"
    )


async def send_appointment_status_update(user_id: str, appointment_id: str, status: str, doctor_name: str) -> dict:
    """Send appointment status update (completed/cancelled)."""
    if status == "completed":
        message = f"✓ Your appointment with Dr. {doctor_name} has been completed"
        notification_type = "appointment_completed"
    elif status == "cancelled":
        message = f"✗ Your appointment with Dr. {doctor_name} has been cancelled"
        notification_type = "appointment_cancelled"
    else:
        message = f"Appointment status updated: {status}"
        notification_type = "appointment_confirmed"
    
    return await create_notification(
        user_id=user_id,
        notification_type=notification_type,
        message=message,
        data={
            "appointment_id": appointment_id,
            "doctor_name": doctor_name,
            "status": status
        },
        priority="medium",
        action_url="/appointments"
    )


# ==================== HEALTH CHECK-INS (FUTURE) ====================

async def send_health_checkin(user_id: str) -> dict:
    """Send periodic health check-in notification."""
    message = "💚 How are you feeling today? Take a quick health survey to track your wellness."
    
    return await create_notification(
        user_id=user_id,
        notification_type="health_checkin",
        message=message,
        data={},
        priority="low",
        action_url="/health-survey"
    )


# ==================== APPOINTMENT ACCEPT / REJECT ====================

async def send_appointment_accepted(user_id: str, appointment_id: str, doctor_name: str, slot_date: str, slot_time: str) -> dict:
    """Notify user that doctor accepted their appointment."""
    message = f"✅ Dr. {doctor_name} has confirmed your appointment for {slot_date} at {slot_time}"
    return await create_notification(
        user_id=user_id,
        notification_type="appointment_accepted",
        message=message,
        data={"appointment_id": appointment_id, "doctor_name": doctor_name, "slot_date": slot_date, "slot_time": slot_time},
        priority="high",
        action_url="/appointments"
    )


async def send_appointment_rejected(user_id: str, appointment_id: str, doctor_name: str, reason: str = None) -> dict:
    """Notify user that doctor rejected their appointment."""
    message = f"❌ Dr. {doctor_name} was unable to accept your appointment request"
    if reason:
        message += f". Reason: {reason}"
    return await create_notification(
        user_id=user_id,
        notification_type="appointment_rejected",
        message=message,
        data={"appointment_id": appointment_id, "doctor_name": doctor_name, "reason": reason},
        priority="high",
        action_url="/appointments"
    )


async def send_appointment_booked_to_doctor(doctor_id: str, appointment_id: str, patient_name: str, slot_date: str, slot_time: str) -> dict:
    """Notify doctor that a patient booked an appointment."""
    message = f"📋 New appointment request from {patient_name} for {slot_date} at {slot_time}"
    return await create_notification(
        user_id=doctor_id,
        notification_type="appointment_booked",
        message=message,
        data={"appointment_id": appointment_id, "patient_name": patient_name, "slot_date": slot_date, "slot_time": slot_time},
        priority="high",
        action_url="/doctor/appointments"
    )


async def send_appointment_cancelled_by_patient(doctor_id: str, appointment_id: str, patient_name: str, slot_date: str, slot_time: str) -> dict:
    """Notify doctor that a patient cancelled their appointment."""
    message = f"🚫 {patient_name} cancelled their appointment for {slot_date} at {slot_time}"
    return await create_notification(
        user_id=doctor_id,
        notification_type="appointment_user_cancelled",
        message=message,
        data={"appointment_id": appointment_id, "patient_name": patient_name, "slot_date": slot_date, "slot_time": slot_time},
        priority="medium",
        action_url="/doctor/appointments"
    )

async def send_appointment_cancelled_by_admin(user_id: str, appointment_id: str, doctor_name: str, slot_date: str, slot_time: str) -> dict:
    """Notify user that admin cancelled their appointment."""
    message = f"🚫 Your appointment with Dr. {doctor_name} on {slot_date} at {slot_time} has been cancelled by admin"
    return await create_notification(
        user_id=user_id,
        notification_type="appointment_admin_cancelled",
        message=message,
        data={"appointment_id": appointment_id, "doctor_name": doctor_name, "slot_date": slot_date, "slot_time": slot_time},
        priority="high",
        action_url="/appointments"
    )

async def send_payment_success(user_id: str, appointment_id: str, amount: float, doctor_name: str) -> dict:
    """Notify user that payment was successful."""
    message = f"💰 Payment of ₹{amount} for appointment with Dr. {doctor_name} was successful"
    return await create_notification(
        user_id=user_id,
        notification_type="payment_success",
        message=message,
        data={"appointment_id": appointment_id, "amount": amount, "doctor_name": doctor_name},
        priority="medium",
        action_url=f"/appointments"
    )

async def send_appointment_missed(user_id: str, appointment_id: str, other_party_name: str, slot_date: str, slot_time: str, is_doctor: bool = False) -> dict:
    """Notify user or doctor that an appointment was missed."""
    if is_doctor:
        message = f"⏰ Appointment with {other_party_name} on {slot_date} at {slot_time} was missed"
        action_url = "/doctor/appointments"
    else:
        message = f"⏰ Your appointment with Dr. {other_party_name} on {slot_date} at {slot_time} was missed"
        action_url = "/appointments"
    return await create_notification(
        user_id=user_id,
        notification_type="appointment_missed",
        message=message,
        data={"appointment_id": appointment_id, "slot_date": slot_date, "slot_time": slot_time},
        priority="medium",
        action_url=action_url
    )


# ==================== REPORT ACCESS NOTIFICATIONS ====================

async def send_report_access_request(user_id: str, request_id: str, doctor_id: str, doctor_name: str) -> dict:
    """Notify user that a doctor is requesting report access."""
    message = f"🔒 Dr. {doctor_name} is requesting access to view your lab reports"
    return await create_notification(
        user_id=user_id,
        notification_type="report_access_request",
        message=message,
        data={"request_id": request_id, "doctor_id": doctor_id, "doctor_name": doctor_name},
        priority="high",
        action_url="/reports"
    )


async def send_report_access_approved(doctor_id: str, patient_name: str, request_id: str) -> dict:
    """Notify doctor that patient approved report access."""
    message = f"✅ {patient_name} has approved your request to view their lab reports"
    return await create_notification(
        user_id=doctor_id,
        notification_type="report_access_approved",
        message=message,
        data={"request_id": request_id, "patient_name": patient_name},
        priority="high",
        action_url="/doctor/patient-reports"
    )


async def send_report_access_denied(doctor_id: str, patient_name: str, request_id: str) -> dict:
    """Notify doctor that patient denied report access."""
    message = f"❌ {patient_name} has denied your request to view their lab reports"
    return await create_notification(
        user_id=doctor_id,
        notification_type="report_access_denied",
        message=message,
        data={"request_id": request_id, "patient_name": patient_name},
        priority="medium",
        action_url="/doctor/patient-reports"
    )


# ==================== MEDICATION ALERTS ====================

async def send_missed_dose_alert(user_id: str, medication_id: str, medication_name: str, time_slot: str) -> dict:
    """Send alert when a scheduled dose was missed."""
    message = f"⚠️ You missed your {medication_name} dose at {time_slot}. Take it as soon as possible."
    return await create_notification(
        user_id=user_id,
        notification_type="medication_missed",
        message=message,
        data={"medication_id": medication_id, "medication_name": medication_name, "time_slot": time_slot},
        priority="high",
        action_url="/medications"
    )


async def send_out_of_stock_alert(user_id: str, medication_id: str, medication_name: str) -> dict:
    """Send alert when a medication is completely out of stock."""
    message = f"🚨 {medication_name} is completely out of stock! Please refill immediately."
    return await create_notification(
        user_id=user_id,
        notification_type="medication_out_of_stock",
        message=message,
        data={"medication_id": medication_id, "medication_name": medication_name},
        priority="urgent",
        action_url="/medications"
    )


# ==================== LAB REPORT NOTIFICATIONS ====================

async def send_lab_report_uploaded(user_id: str, report_id: str, report_type: str) -> dict:
    """Notify user that their lab report was uploaded successfully."""
    message = f"📄 Your {report_type} lab report has been uploaded successfully"
    return await create_notification(
        user_id=user_id,
        notification_type="lab_report_uploaded",
        message=message,
        data={"report_id": report_id, "report_type": report_type},
        priority="low",
        action_url=f"/reports"
    )


async def send_lab_report_ready(user_id: str, report_id: str, report_type: str) -> dict:
    """Notify user that their lab report interpretation is ready."""
    message = f"🔬 Your {report_type} lab report analysis is ready! View your detailed results."
    return await create_notification(
        user_id=user_id,
        notification_type="lab_report_ready",
        message=message,
        data={"report_id": report_id, "report_type": report_type},
        priority="high",
        action_url=f"/reports/analysis/{report_id}"
    )


# ==================== WELCOME NOTIFICATION ====================

async def send_welcome_notification(user_id: str, user_name: str) -> dict:
    """Send welcome notification to newly registered user."""
    message = f"👋 Welcome to Health-Mate, {user_name}! Complete your profile to get personalized health recommendations."
    return await create_notification(
        user_id=user_id,
        notification_type="welcome",
        message=message,
        data={"user_name": user_name},
        priority="medium",
        action_url="/profile"
    )


# ==================== NOTIFICATION PREFERENCES ====================

async def update_notification_preferences(user_id: str, preferences: dict) -> dict:
    """Update user's notification preferences."""
    users = get_users_collection()
    
    # Merge with current preferences
    user = await users.find_one({"_id": ObjectId(user_id)})
    if not user:
        return {"success": False, "message": "User not found"}
    
    current_prefs = user.get("notification_preferences", DEFAULT_NOTIFICATION_PREFERENCES)
    updated_prefs = {**current_prefs, **preferences}
    
    await users.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"notification_preferences": updated_prefs}}
    )
    
    return {
        "success": True,
        "message": "Notification preferences updated",
        "preferences": updated_prefs
    }


async def get_notification_preferences(user_id: str) -> dict:
    """Get user's notification preferences."""
    users = get_users_collection()
    
    user = await users.find_one({"_id": ObjectId(user_id)})
    if not user:
        return {"success": False, "message": "User not found"}
    
    prefs = user.get("notification_preferences", DEFAULT_NOTIFICATION_PREFERENCES)
    
    return {
        "success": True,
        "preferences": prefs
    }
