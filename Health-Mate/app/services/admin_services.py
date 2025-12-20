from email_validator import validate_email, EmailNotValidError
from bson import ObjectId
from jose import jwt
import json
import time

from ..core.config import settings
from ..core.database import get_doctors_collection, get_appointments_collection, get_users_collection
from ..core.security import get_password_hash
from ..core.cloudinary_config import upload_image_from_bytes


async def login_admin(email: str, password: str) -> dict:
    """Login admin user."""
    if email == settings.ADMIN_EMAIL and password == settings.ADMIN_PASSWORD:
        # Create JWT token with admin claims
        token = jwt.encode({"email": email, "role": "admin"}, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)
        return {"success": True, "token": token}
    return {"success": False, "message": "Invalid credentials"}


async def add_doctor(
    name: str,
    email: str,
    password: str,
    speciality: str,
    degree: str,
    experience: str,
    about: str,
    fees: float,
    address: str,
    image_bytes: bytes = None
) -> dict:
    """Add a new doctor."""
    doctors = get_doctors_collection()
    
    # Validate required fields
    if not all([name, email, password, speciality, degree, experience, about, fees, address]):
        return {"success": False, "message": "Missing Details"}
    
    # Validate email
    try:
        validate_email(email)
    except EmailNotValidError:
        return {"success": False, "message": "Please enter a valid email"}
    
    # Validate password
    if len(password) < 8:
        return {"success": False, "message": "Please enter a strong password"}
    
    # Hash password
    hashed_password = get_password_hash(password)
    
    # Upload image if provided
    image_url = ""
    if image_bytes:
        try:
            image_url = await upload_image_from_bytes(image_bytes, "doctor")
        except Exception as e:
            return {"success": False, "message": f"Image upload failed: {str(e)}"}
    
    # Parse address
    try:
        address_dict = json.loads(address)
    except json.JSONDecodeError:
        address_dict = {"line1": address, "line2": ""}
    
    doctor_data = {
        "name": name,
        "email": email,
        "password": hashed_password,
        "image": image_url,
        "speciality": speciality,
        "degree": degree,
        "experience": experience,
        "about": about,
        "fees": float(fees),
        "address": address_dict,
        "available": True,
        "slots_booked": {},
        "date": int(time.time() * 1000)
    }
    
    await doctors.insert_one(doctor_data)
    
    return {"success": True, "message": "Doctor Added"}


async def get_all_doctors_admin() -> dict:
    """Get all doctors (admin view with all fields except password)."""
    doctors = get_doctors_collection()
    
    cursor = doctors.find({})
    docs = []
    async for doc in cursor:
        doc["_id"] = str(doc["_id"])
        doc.pop("password", None)
        docs.append(doc)
    
    return {"success": True, "doctors": docs}


async def get_all_appointments_admin() -> dict:
    """Get all appointments for admin."""
    appointments = get_appointments_collection()
    
    cursor = appointments.find({})
    appts = []
    async for appt in cursor:
        appt["_id"] = str(appt["_id"])
        appts.append(appt)
    
    return {"success": True, "appointments": appts}


async def cancel_appointment_admin(appointment_id: str) -> dict:
    """Cancel any appointment (admin)."""
    appointments = get_appointments_collection()
    doctors = get_doctors_collection()
    
    appt = await appointments.find_one({"_id": ObjectId(appointment_id)})
    if not appt:
        return {"success": False, "message": "Appointment not found"}
    
    # Cancel appointment
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


async def change_doctor_availability_admin(doc_id: str) -> dict:
    """Toggle doctor availability (admin)."""
    doctors = get_doctors_collection()
    
    if not doc_id:
        return {"success": False, "message": "Doctor ID missing"}
    
    doctor = await doctors.find_one({"_id": ObjectId(doc_id)})
    if not doctor:
        return {"success": False, "message": "Doctor not found"}
    
    current_available = doctor.get("available", True)
    await doctors.update_one(
        {"_id": ObjectId(doc_id)},
        {"$set": {"available": not current_available}}
    )
    
    return {"success": True, "message": "Availability changed successfully"}


async def get_admin_dashboard() -> dict:
    """Get admin dashboard data."""
    doctors = get_doctors_collection()
    users = get_users_collection()
    appointments = get_appointments_collection()
    
    # Count doctors
    docs_cursor = doctors.find({})
    docs = []
    async for doc in docs_cursor:
        docs.append(doc)
    
    # Count users  
    users_cursor = users.find({})
    user_list = []
    async for user in users_cursor:
        user_list.append(user)
    
    # Get appointments
    appts_cursor = appointments.find({})
    appts = []
    async for appt in appts_cursor:
        appt["_id"] = str(appt["_id"])
        appts.append(appt)
    
    dash_data = {
        "doctors": len(docs),
        "appointments": len(appts),
        "patients": len(user_list),
        "latestAppointments": list(reversed(appts))[:5]
    }
    
    return {"success": True, "dashData": dash_data}
