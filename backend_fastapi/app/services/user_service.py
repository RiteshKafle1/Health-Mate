from email_validator import validate_email, EmailNotValidError
from bson import ObjectId
from ..core.database import get_users_collection, get_doctors_collection, get_appointments_collection
from ..core.security import get_password_hash, verify_password, create_access_token
from ..core.redis import store_session
from ..core.cloudinary_config import upload_image_from_bytes
import json
import time
from fastapi import UploadFile,HTTPException


async def register_user(name: str, email: str, password: str) -> dict:
    """Register a new user with enhanced security validation."""
    from ..utils.password_validator import validate_password_strength
    from ..utils.email_validator import validate_email_address
    
    users = get_users_collection()
    
    # Enhanced email validation (format + disposable check)
    email_validation = validate_email_address(email)
    if not email_validation["valid"]:
        return {"success": False, "message": email_validation["message"]}
    
    normalized_email = email_validation["normalized_email"]
    
    # Enhanced password validation (strength + breach check)
    password_validation = validate_password_strength(password, check_breach=True)
    if not password_validation["valid"]:
        # Return detailed feedback for UI
        suggestions = ", ".join(password_validation["suggestions"])
        return {
            "success": False,
            "message": f"Password does not meet security requirements: {suggestions}",
            "password_feedback": password_validation
        }
    
    # Check if user exists (use normalized email)
    existing = await users.find_one({"email": normalized_email})
    if existing:
        return {"success": False, "message": "User already exists"}
    
    # Hash password
    hashed_password = get_password_hash(password)
    
    # Default user image
    default_image = "data:image/png;base64,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"
    
    # Create user document
    user_data = {
        "name": name,
        "email": normalized_email,  # Use normalized email
        "password": hashed_password,
        "image": default_image,
        "phone": "000000000",
        "address": {"line1": "", "line2": ""},
        "gender": "Not Selected",
        "dob": "Not Selected",
        # Security fields
        "email_verified": False,
        "failed_login_attempts": 0,
        "locked_until": None,
        "created_at": int(time.time() * 1000)
    }
    
    result = await users.insert_one(user_data)
    user_id = str(result.inserted_id)
    
    # Create JWT token
    token = create_access_token({"id": user_id})
    
    # Store session in Redis
    await store_session(user_id, token)
    
    return {"success": True, "token": token}


async def login_user(email: str, password: str) -> dict:
    """Login a user with account lockout protection."""
    from ..utils.email_validator import validate_email_address
    from ..middleware.rate_limiter import AccountLockout
    
    users = get_users_collection()
    
    # Normalize email
    email_validation = validate_email_address(email)
    if email_validation["valid"]:
        normalized_email = email_validation["normalized_email"]
    else:
        normalized_email = email  # Use as is if validation fails
    
    user = await users.find_one({"email": normalized_email})
    if not user:
        return {"success": False, "message": "User does not exist"}
    
    user_id = str(user["_id"])
    
    # Check if account is locked
    is_locked, remaining_seconds = await AccountLockout.is_account_locked(user_id)
    if is_locked:
        minutes = remaining_seconds // 60
        hours = minutes // 60
        if hours > 0:
            time_msg = f"{hours} hour{'s' if hours > 1 else ''}"
        else:
            time_msg = f"{minutes} minute{'s' if minutes > 1 else ''}"
        
        return {
            "success": False,
            "message": f"Account is locked due to too many failed login attempts. Please try again in {time_msg}.",
            "locked": True,
            "locked_until": user.get("locked_until")
        }
    
    # Verify password
    if not verify_password(password, user["password"]):
        # Record failed login attempt
        lockout_seconds = await AccountLockout.record_failed_login(user_id)
        
        failed_attempts = user.get("failed_login_attempts", 0) + 1
        
        if lockout_seconds:
            minutes = lockout_seconds // 60
            hours = minutes // 60
            if hours > 0:
                time_msg = f"{hours} hour{'s' if hours > 1 else ''}"
            else:
                time_msg = f"{minutes} minute{'s' if minutes > 1 else ''}"
            
            return {
                "success": False,
                "message": f"Too many failed login attempts. Account locked for {time_msg}.",
                "locked": True
            }
        else:
            remaining_attempts = 5 - failed_attempts
            if remaining_attempts > 0:
                return {
                    "success": False,
                    "message": f"Invalid credentials. {remaining_attempts} attempt{'s' if remaining_attempts > 1 else ''} remaining before account lockout."
                }
            else:
                return {"success": False, "message": "Invalid credentials"}
    
    # Successful login - reset failed attempts
    await AccountLockout.reset_failed_attempts(user_id)
    
    token = create_access_token({"id": user_id})
    
    # Store session in Redis
    await store_session(user_id, token)
    
    return {"success": True, "token": token}


async def get_user_profile(user_id: str) -> dict:
    """Get user profile by ID."""
    users = get_users_collection()
    
    user = await users.find_one({"_id": ObjectId(user_id)})
    if not user:
        return {"success": False, "message": "User not found"}
    
    # Remove password from response
    user["_id"] = str(user["_id"])
    del user["password"]
    
    return {"success": True, "userData": user}


async def update_user_profile(
    user_id: str,
    name: str = None,
    phone: str = None,
    address: str = None,
    dob: str = None,
    gender: str = None,
    weight: str = None,
    height: str = None,
    image_bytes: bytes = None
) -> dict:
    """Update user profile."""
    users = get_users_collection()
    
    if not name or not phone or not dob or not gender:
        return {"success": False, "message": "Data Missing"}
    
    update_data = {
        "name": name,
        "phone": phone,
        "dob": dob,
        "gender": gender,
        "weight": weight,
        "height": height
    }
    
    if address:
        try:
            update_data["address"] = json.loads(address)
        except json.JSONDecodeError:
            pass
    
    # Handle image upload
    if image_bytes:
        try:
            image_url = await upload_image_from_bytes(image_bytes, "profile")
            update_data["image"] = image_url
        except Exception as e:
            print(f"Image upload error: {e}")
    
    await users.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": update_data}
    )
    
    return {"success": True, "message": "Profile Updated"}


async def book_appointment(user_id: str, doc_id: str, slot_date: str, slot_time: str) -> dict:
    """Book an appointment."""
    users = get_users_collection()
    doctors = get_doctors_collection()
    appointments = get_appointments_collection()
    
    # Get doctor data
    doc_data = await doctors.find_one({"_id": ObjectId(doc_id)})
    if not doc_data:
        return {"success": False, "message": "Doctor not found"}
    
    if not doc_data.get("available", True):
        return {"success": False, "message": "Doctor Not Available"}
    
    slots_booked = doc_data.get("slots_booked", {})
    
    # Check slot availability
    if slot_date in slots_booked:
        if slot_time in slots_booked[slot_date]:
            return {"success": False, "message": "Slot Not Available"}
        slots_booked[slot_date].append(slot_time)
    else:
        slots_booked[slot_date] = [slot_time]
    
    # Get user data
    user_data = await users.find_one({"_id": ObjectId(user_id)})
    if not user_data:
        return {"success": False, "message": "User not found"}
    
    # Prepare data for appointment
    user_data["_id"] = str(user_data["_id"])
    del user_data["password"]
    
    doc_data_clean = {k: v for k, v in doc_data.items() if k != "password" and k != "slots_booked"}
    doc_data_clean["_id"] = str(doc_data_clean["_id"])
    
    appointment_data = {
        "userId": user_id,
        "docId": doc_id,
        "userData": user_data,
        "docData": doc_data_clean,
        "amount": doc_data["fees"],
        "slotTime": slot_time,
        "slotDate": slot_date,
        "date": int(time.time() * 1000),
        "cancelled": False,
        "payment": False,
        "isCompleted": False
    }
    
    await appointments.insert_one(appointment_data)
    
    # Update doctor's slots_booked
    await doctors.update_one(
        {"_id": ObjectId(doc_id)},
        {"$set": {"slots_booked": slots_booked}}
    )
    
    return {"success": True, "message": "Appointment Booked"}


async def list_user_appointments(user_id: str) -> dict:
    """Get all appointments for a user."""
    appointments = get_appointments_collection()
    
    cursor = appointments.find({"userId": user_id})
    appts = []
    async for appt in cursor:
        appt["_id"] = str(appt["_id"])
        appts.append(appt)
    
    return {"success": True, "appointments": appts}


async def cancel_user_appointment(user_id: str, appointment_id: str) -> dict:
    """Cancel a user's appointment."""
    appointments = get_appointments_collection()
    doctors = get_doctors_collection()
    
    appt = await appointments.find_one({"_id": ObjectId(appointment_id)})
    if not appt:
        return {"success": False, "message": "Appointment not found"}
    
    if appt["userId"] != user_id:
        return {"success": False, "message": "Unauthorized action"}
    
    # Cancel the appointment
    await appointments.update_one(
        {"_id": ObjectId(appointment_id)},
        {"$set": {"cancelled": True}}
    )
    
    # Release doctor slot
    doc_id = appt["docId"]
    slot_date = appt["slotDate"]
    slot_time = appt["slotTime"]
    
    doctor = await doctors.find_one({"_id": ObjectId(doc_id)})
    if doctor:
        slots_booked = doctor.get("slots_booked", {})
        if slot_date in slots_booked and slot_time in slots_booked[slot_date]:
            slots_booked[slot_date].remove(slot_time)
            await doctors.update_one(
                {"_id": ObjectId(doc_id)},
                {"$set": {"slots_booked": slots_booked}}
            )
    
    return {"success": True, "message": "Appointment Cancelled"}




ALLOWED_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/webp"]

async def upload_user_file(user_id: str, file: UploadFile):
    users = get_users_collection()

    if not ObjectId.is_valid(user_id):
        raise HTTPException(status_code=400, detail="Invalid user id")

    if not file:
        raise HTTPException(status_code=400, detail="File required")

    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(
            status_code=400,
            detail="Only image files are allowed"
        )

    file_bytes = await file.read()

    if not file_bytes:
        raise HTTPException(status_code=400, detail="Empty file")

    try:
        upload = upload_image_from_bytes(
            file_bytes,
            folder=f"users/{user_id}"
        )
    except Exception:
        raise HTTPException(
            status_code=500,
            detail="Cloudinary upload failed"
        )

    file_url = upload.get("secure_url")

    await users.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"file": file_url}}
    )

    return {"success": True, "file_url": file_url}


async def get_user_file(user_id: str):
    users = get_users_collection()

    if not ObjectId.is_valid(user_id):
        raise HTTPException(status_code=400, detail="Invalid user id")

    user = await users.find_one(
        {"_id": ObjectId(user_id)},
        {"file": 1}
    )

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    file_url = user.get("file")

    if not file_url:
        raise HTTPException(status_code=404, detail="No file uploaded")

    return {"success": True, "file_url": file_url}
