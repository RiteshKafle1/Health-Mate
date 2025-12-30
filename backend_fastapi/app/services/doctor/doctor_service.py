from bson import ObjectId
from ...core.database import get_doctors_collection, get_appointments_collection
from ...core.security import get_password_hash, verify_password, create_access_token


async def login_doctor(email: str, password: str) -> dict:
    """Login a doctor."""
    doctors = get_doctors_collection()
    
    doctor = await doctors.find_one({"email": email})
    if not doctor:
        return {"success": False, "message": "Invalid credentials"}
    
    if not verify_password(password, doctor["password"]):
        return {"success": False, "message": "Invalid credentials"}
    
    doctor_id = str(doctor["_id"])
    token = create_access_token({"id": doctor_id})
    
    return {"success": True, "token": token}


async def get_doctor_appointments(doc_id: str) -> dict:
    """Get all appointments for a doctor."""
    appointments = get_appointments_collection()
    
    cursor = appointments.find({"docId": doc_id})
    appts = []
    async for appt in cursor:
        appt["_id"] = str(appt["_id"])
        appts.append(appt)
    
    return {"success": True, "appointments": appts}


async def cancel_doctor_appointment(doc_id: str, appointment_id: str) -> dict:
    """Cancel a doctor's appointment."""
    appointments = get_appointments_collection()
    
    appt = await appointments.find_one({"_id": ObjectId(appointment_id)})
    if not appt:
        return {"success": False, "message": "Appointment not found"}
    
    if appt["docId"] != doc_id:
        return {"success": False, "message": "Invalid doctor or appointment"}
    
    await appointments.update_one(
        {"_id": ObjectId(appointment_id)},
        {"$set": {"cancelled": True}}
    )
    
    return {"success": True, "message": "Appointment Cancelled"}


async def complete_doctor_appointment(doc_id: str, appointment_id: str) -> dict:
    """Mark an appointment as completed."""
    appointments = get_appointments_collection()
    
    appt = await appointments.find_one({"_id": ObjectId(appointment_id)})
    if not appt:
        return {"success": False, "message": "Appointment not found"}
    
    if appt["docId"] != doc_id:
        return {"success": False, "message": "Invalid doctor or appointment"}
    
    await appointments.update_one(
        {"_id": ObjectId(appointment_id)},
        {"$set": {"isCompleted": True}}
    )
    
    return {"success": True, "message": "Appointment Completed"}


async def get_all_doctors() -> dict:
    """Get list of all doctors (public)."""
    doctors = get_doctors_collection()
    
    cursor = doctors.find({})
    docs = []
    async for doc in cursor:
        doc["_id"] = str(doc["_id"])
        # Remove sensitive fields
        doc.pop("password", None)
        doc.pop("email", None)
        docs.append(doc)
    
    return {"success": True, "doctors": docs}


async def change_doctor_availability(doc_id: str) -> dict:
    """Toggle doctor's availability."""
    doctors = get_doctors_collection()
    
    doctor = await doctors.find_one({"_id": ObjectId(doc_id)})
    if not doctor:
        return {"success": False, "message": "Doctor not found"}
    
    current_available = doctor.get("available", True)
    await doctors.update_one(
        {"_id": ObjectId(doc_id)},
        {"$set": {"available": not current_available}}
    )
    
    return {"success": True, "message": "Availability changed successfully"}


async def get_doctor_profile(doc_id: str) -> dict:
    """Get doctor's profile."""
    doctors = get_doctors_collection()
    
    doctor = await doctors.find_one({"_id": ObjectId(doc_id)})
    if not doctor:
        return {"success": False, "message": "Doctor not found"}
    
    doctor["_id"] = str(doctor["_id"])
    doctor.pop("password", None)
    
    return {"success": True, "profileData": doctor}


async def update_doctor_profile(doc_id: str, fees: float = None, address: dict = None, available: bool = None, about: str = None) -> dict:
    """Update doctor's profile."""
    doctors = get_doctors_collection()
    
    update_data = {}
    if fees is not None:
        update_data["fees"] = fees
    if address is not None:
        update_data["address"] = address
    if available is not None:
        update_data["available"] = available
    if about is not None:
        update_data["about"] = about
    
    if update_data:
        await doctors.update_one(
            {"_id": ObjectId(doc_id)},
            {"$set": update_data}
        )
    
    return {"success": True, "message": "Profile Updated"}


async def get_doctor_dashboard(doc_id: str) -> dict:
    """Get doctor's dashboard data."""
    appointments = get_appointments_collection()
    
    cursor = appointments.find({"docId": doc_id})
    appts = []
    async for appt in cursor:
        appt["_id"] = str(appt["_id"])
        appts.append(appt)
    
    earnings = 0
    patient_set = set()
    
    for appt in appts:
        if appt.get("isCompleted") or appt.get("payment"):
            earnings += appt.get("amount", 0)
        patient_set.add(appt.get("userId"))
    
    dash_data = {
        "earnings": earnings,
        "appointments": len(appts),
        "patients": len(patient_set),
        "latestAppointments": list(reversed(appts))[:5]
    }
    
    return {"success": True, "dashData": dash_data}
