from email_validator import validate_email, EmailNotValidError
from bson import ObjectId
from jose import jwt
import json
import time

from ...core.config import settings
from ...core.database import get_doctors_collection, get_appointments_collection, get_users_collection
from ...core.security import get_password_hash
from ...core.cloudinary_config import upload_image_from_bytes


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
    address: str,
    fees: float = 0.0,
    image_bytes: bytes = None
) -> dict:
    """Add a new doctor."""
    doctors = get_doctors_collection()
    
    # Validate required fields
    if not all([name, email, password, speciality, degree, experience, about, address]):
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
            upload_result = await upload_image_from_bytes(image_bytes, "doctor")
            image_url = upload_result.get("secure_url")
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
    """Get all doctors (admin view with all fields and appointment stats)."""
    doctors = get_doctors_collection()
    appointments = get_appointments_collection()
    
    # 1. Aggregate appointment stats per doctor
    stats = {} # doc_id -> {total: 0, pending: 0, completed: 0}
    
    async for appt in appointments.find({}):
        doc_id = appt.get("docId")
        if not doc_id:
            continue
            
        if doc_id not in stats:
            stats[doc_id] = {"total": 0, "pending": 0, "completed": 0}
            
        stats[doc_id]["total"] += 1
        
        if appt.get("isCompleted"):
            stats[doc_id]["completed"] += 1
        elif not appt.get("cancelled"):
            stats[doc_id]["pending"] += 1

    # 2. Get doctors and attach stats
    cursor = doctors.find({})
    docs = []
    async for doc in cursor:
        doc_id = str(doc["_id"])
        doc["_id"] = doc_id
        doc.pop("password", None)
        
        # Attach stats using get() to handle cases with no appointments
        doc_stats = stats.get(doc_id, {"total": 0, "pending": 0, "completed": 0})
        doc["appointmentStats"] = doc_stats
        
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


# ============== PATIENT MANAGEMENT ==============

async def get_all_patients_admin() -> dict:
    """Get all patients (admin view with all fields except password)."""
    from ...core.database import get_medications_collection
    
    users = get_users_collection()
    appointments = get_appointments_collection()
    medications = get_medications_collection()
    
    # Get all appointments to calculate per-patient stats
    all_appts = []
    async for appt in appointments.find({}):
        all_appts.append(appt)
        
    # Get all medications
    meds_count_by_user = {}
    async for med in medications.find({"is_active": True}):
        # medication model uses user_id
        u_id = med.get("user_id")
        if u_id:
            meds_count_by_user[u_id] = meds_count_by_user.get(u_id, 0) + 1
    
    # Count appointments per user
    appt_count_by_user = {}
    for appt in all_appts:
        user_id = appt.get("userId")
        if user_id:
            appt_count_by_user[user_id] = appt_count_by_user.get(user_id, 0) + 1
    
    cursor = users.find({})
    patients = []
    async for user in cursor:
        user_id = str(user["_id"])
        user["_id"] = user_id
        user.pop("password", None)
        # Add stats
        user["appointmentCount"] = appt_count_by_user.get(user_id, 0)
        user["activeMedsCount"] = meds_count_by_user.get(user_id, 0)
        patients.append(user)
    
    return {"success": True, "patients": patients}


async def get_patient_details_admin(patient_id: str) -> dict:
    """Get detailed information about a specific patient."""
    users = get_users_collection()
    appointments = get_appointments_collection()
    
    try:
        user = await users.find_one({"_id": ObjectId(patient_id)})
    except:
        return {"success": False, "message": "Invalid patient ID"}
    
    if not user:
        return {"success": False, "message": "Patient not found"}
    
    user["_id"] = str(user["_id"])
    user.pop("password", None)
    
    # Get patient's appointments
    cursor = appointments.find({"userId": patient_id})
    appts = []
    async for appt in cursor:
        appt["_id"] = str(appt["_id"])
        appts.append(appt)
    
    return {
        "success": True, 
        "patient": user,
        "appointments": appts
    }


async def delete_patient_admin(patient_id: str) -> dict:
    """Delete a patient and optionally their associated data."""
    from ...core.database import get_medications_collection, get_dose_logs_collection, get_reports_collection
    
    users = get_users_collection()
    appointments = get_appointments_collection()
    medications = get_medications_collection()
    dose_logs = get_dose_logs_collection()
    reports = get_reports_collection()
    
    try:
        user = await users.find_one({"_id": ObjectId(patient_id)})
    except:
        return {"success": False, "message": "Invalid patient ID"}
    
    if not user:
        return {"success": False, "message": "Patient not found"}
    
    # Delete user's medications
    await medications.delete_many({"user_id": patient_id})
    
    # Delete user's dose logs
    await dose_logs.delete_many({"user_id": patient_id})
    
    # Delete user's reports
    await reports.delete_many({"user_id": patient_id})
    
    # Cancel user's appointments (mark as cancelled, don't delete)
    await appointments.update_many(
        {"userId": patient_id},
        {"$set": {"cancelled": True}}
    )
    
    # Delete the user
    await users.delete_one({"_id": ObjectId(patient_id)})
    
    return {"success": True, "message": "Patient deleted successfully"}


async def delete_doctor_admin(doctor_id: str) -> dict:
    """Delete a doctor and their associated data (appointments)."""
    doctors = get_doctors_collection()
    appointments = get_appointments_collection()
    
    try:
        doc = await doctors.find_one({"_id": ObjectId(doctor_id)})
    except:
        return {"success": False, "message": "Invalid doctor ID"}
    
    if not doc:
        return {"success": False, "message": "Doctor not found"}
        
    # Cancel all pending appointments for this doctor
    await appointments.update_many(
        {"docId": doctor_id, "isCompleted": False, "cancelled": False},
        {"$set": {"cancelled": True}}
    )
    
    # Delete the doctor
    await doctors.delete_one({"_id": ObjectId(doctor_id)})
    
    return {"success": True, "message": "Doctor deleted successfully"}

