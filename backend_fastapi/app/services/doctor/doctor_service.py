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
    doctors = get_doctors_collection()
    from ...core.database import get_notifications_collection
    import time
    
    try:
        appt = await appointments.find_one({"_id": ObjectId(appointment_id)})
    except Exception:
        return {"success": False, "message": "Invalid appointment ID"}
        
    if not appt:
        return {"success": False, "message": "Appointment not found"}
    
    if appt["docId"] != doc_id:
        return {"success": False, "message": "Invalid doctor or appointment"}
    
    # Update status
    await appointments.update_one(
        {"_id": ObjectId(appointment_id)},
        {"$set": {"cancelled": True, "status": "cancelled"}}
    )
    
    # Release the slot
    slot_date = appt.get("slotDate")
    slot_time = appt.get("slotTime")
    
    doctor = await doctors.find_one({"_id": ObjectId(doc_id)})
    if doctor:
        slots_booked = doctor.get("slots_booked", {})
        if slot_date in slots_booked and slot_time in slots_booked[slot_date]:
            slots_booked[slot_date].remove(slot_time)
            await doctors.update_one(
                {"_id": ObjectId(doc_id)},
                {"$set": {"slots_booked": slots_booked}}
            )
            
    # Send notification to patient
    notifications = get_notifications_collection()
    doctor_name = appt.get("docData", {}).get("name", "The doctor")
    
    notification_doc = {
        "user_id": appt["userId"],
        "type": "appointment_cancelled",
        "message": f"Dr. {doctor_name} has cancelled your appointment for {slot_date} at {slot_time}",
        "data": {
            "appointment_id": appointment_id,
            "doctor_id": doc_id
        },
        "read": False,
        "created_at": int(time.time() * 1000)
    }
    await notifications.insert_one(notification_doc)
    
    return {"success": True, "message": "Appointment Cancelled"}


async def complete_doctor_appointment(doc_id: str, appointment_id: str) -> dict:
    """Mark an appointment as completed. Only accepted appointments can be completed."""
    appointments = get_appointments_collection()
    
    try:
        appt = await appointments.find_one({"_id": ObjectId(appointment_id)})
    except Exception:
        return {"success": False, "message": "Invalid appointment ID"}
    
    if not appt:
        return {"success": False, "message": "Appointment not found"}
    
    if appt["docId"] != doc_id:
        return {"success": False, "message": "Invalid doctor or appointment"}
    
    # Check if appointment is accepted before completing
    appt_status = appt.get("status", "pending")
    if appt_status != "accepted":
        return {"success": False, "message": "Can only complete accepted appointments. Please accept the appointment first."}
    
    await appointments.update_one(
        {"_id": ObjectId(appointment_id)},
        {"$set": {"isCompleted": True, "status": "completed"}}
    )
    
    return {"success": True, "message": "Appointment Completed"}


async def accept_doctor_appointment(doc_id: str, appointment_id: str) -> dict:
    """Doctor accepts a pending appointment."""
    appointments = get_appointments_collection()
    from ...core.database import get_notifications_collection, get_users_collection
    import time
    
    try:
        appt = await appointments.find_one({"_id": ObjectId(appointment_id)})
    except Exception:
        return {"success": False, "message": "Invalid appointment ID"}
    
    if not appt:
        return {"success": False, "message": "Appointment not found"}
    
    if appt["docId"] != doc_id:
        return {"success": False, "message": "Invalid doctor or appointment"}
    
    # Check current status
    current_status = appt.get("status", "pending")
    if current_status != "pending":
        return {"success": False, "message": f"Cannot accept appointment with status '{current_status}'"}
    
    # Update status to accepted
    await appointments.update_one(
        {"_id": ObjectId(appointment_id)},
        {"$set": {"status": "accepted"}}
    )
    
    # Send notification to patient
    notifications = get_notifications_collection()
    doctor_name = appt.get("docData", {}).get("name", "Your doctor")
    slot_date = appt.get("slotDate", "")
    slot_time = appt.get("slotTime", "")
    
    notification_doc = {
        "user_id": appt["userId"],
        "type": "appointment_accepted",
        "message": f"Dr. {doctor_name} has confirmed your appointment for {slot_date} at {slot_time}",
        "data": {
            "appointment_id": appointment_id,
            "doctor_id": doc_id,
            "slot_date": slot_date,
            "slot_time": slot_time
        },
        "read": False,
        "created_at": int(time.time() * 1000)
    }
    await notifications.insert_one(notification_doc)
    
    return {"success": True, "message": "Appointment accepted successfully"}


async def reject_doctor_appointment(doc_id: str, appointment_id: str, reason: str = None) -> dict:
    """Doctor rejects a pending appointment."""
    appointments = get_appointments_collection()
    doctors = get_doctors_collection()
    from ...core.database import get_notifications_collection
    import time
    
    try:
        appt = await appointments.find_one({"_id": ObjectId(appointment_id)})
    except Exception:
        return {"success": False, "message": "Invalid appointment ID"}
    
    if not appt:
        return {"success": False, "message": "Appointment not found"}
    
    if appt["docId"] != doc_id:
        return {"success": False, "message": "Invalid doctor or appointment"}
    
    # Check current status
    current_status = appt.get("status", "pending")
    if current_status != "pending":
        return {"success": False, "message": f"Cannot reject appointment with status '{current_status}'"}
    
    # Update status to rejected
    update_data = {"status": "rejected"}
    if reason:
        update_data["rejection_reason"] = reason
    
    await appointments.update_one(
        {"_id": ObjectId(appointment_id)},
        {"$set": update_data}
    )
    
    # Release the slot from doctor's slots_booked
    slot_date = appt.get("slotDate")
    slot_time = appt.get("slotTime")
    
    doctor = await doctors.find_one({"_id": ObjectId(doc_id)})
    if doctor:
        slots_booked = doctor.get("slots_booked", {})
        if slot_date in slots_booked and slot_time in slots_booked[slot_date]:
            slots_booked[slot_date].remove(slot_time)
            await doctors.update_one(
                {"_id": ObjectId(doc_id)},
                {"$set": {"slots_booked": slots_booked}}
            )
    
    # Send notification to patient
    notifications = get_notifications_collection()
    doctor_name = appt.get("docData", {}).get("name", "The doctor")
    
    message = f"Dr. {doctor_name} was unable to accept your appointment request"
    if reason:
        message += f". Reason: {reason}"
    
    notification_doc = {
        "user_id": appt["userId"],
        "type": "appointment_rejected",
        "message": message,
        "data": {
            "appointment_id": appointment_id,
            "doctor_id": doc_id,
            "reason": reason
        },
        "read": False,
        "created_at": int(time.time() * 1000)
    }
    await notifications.insert_one(notification_doc)
    
    return {"success": True, "message": "Appointment rejected"}


async def get_all_doctors() -> dict:
    """Get list of all doctors (public)."""
    doctors = get_doctors_collection()
    
    try:
        cursor = doctors.find({})
        docs = []
        async for doc in cursor:
            doc["_id"] = str(doc["_id"])
            # Remove sensitive fields
            doc.pop("password", None)
            doc.pop("email", None)
            # Ensure availability_schedule has a default
            doc["availability_schedule"] = doc.get("availability_schedule", {})
            docs.append(doc)
        
        return {"success": True, "doctors": docs}
    except Exception as e:
        return {"success": False, "message": f"Failed to fetch doctors: {str(e)}"}


async def change_doctor_availability(doc_id: str) -> dict:
    """Toggle doctor's availability."""
    doctors = get_doctors_collection()
    
    try:
        doctor = await doctors.find_one({"_id": ObjectId(doc_id)})
    except Exception:
        return {"success": False, "message": "Invalid doctor ID"}
    
    if not doctor:
        return {"success": False, "message": "Doctor not found"}
    
    current_available = doctor.get("available", True)
    try:
        await doctors.update_one(
            {"_id": ObjectId(doc_id)},
            {"$set": {"available": not current_available}}
        )
    except Exception as e:
        return {"success": False, "message": f"Database error: {str(e)}"}
    
    return {"success": True, "message": "Availability changed successfully"}


async def get_doctor_profile(doc_id: str) -> dict:
    """Get doctor's profile."""
    doctors = get_doctors_collection()
    
    try:
        doctor = await doctors.find_one({"_id": ObjectId(doc_id)})
    except Exception:
        return {"success": False, "message": "Invalid doctor ID"}
    
    if not doctor:
        return {"success": False, "message": "Doctor not found"}
    
    doctor["_id"] = str(doctor["_id"])
    doctor.pop("password", None)
    # Ensure availability_schedule has a default
    doctor["availability_schedule"] = doctor.get("availability_schedule", {})
    
    return {"success": True, "profileData": doctor}


async def update_doctor_profile(doc_id: str, address: dict = None, available: bool = None, about: str = None, availability_schedule: dict = None) -> dict:
    """Update doctor's profile."""
    doctors = get_doctors_collection()
    
    update_data = {}
    if address is not None:
        update_data["address"] = address
    if available is not None:
        update_data["available"] = available
    if about is not None:
        update_data["about"] = about
    if availability_schedule is not None:
        update_data["availability_schedule"] = availability_schedule
    
    if update_data:
        try:
            await doctors.update_one(
                {"_id": ObjectId(doc_id)},
                {"$set": update_data}
            )
        except Exception as e:
            return {"success": False, "message": f"Failed to update profile: {str(e)}"}
    
    return {"success": True, "message": "Profile Updated"}


async def get_doctor_dashboard(doc_id: str) -> dict:
    """Get doctor's dashboard data."""
    appointments = get_appointments_collection()
    
    try:
        cursor = appointments.find({"docId": doc_id})
        appts = []
        async for appt in cursor:
            appt["_id"] = str(appt["_id"])
            appts.append(appt)
    except Exception as e:
        return {"success": False, "message": f"Failed to fetch dashboard: {str(e)}"}
    
    patient_set = set()
    completed_count = 0
    
    for appt in appts:
        if appt.get("isCompleted"):
            completed_count += 1
        patient_set.add(appt.get("userId"))
    
    dash_data = {
        "appointments": len(appts),
        "completed": completed_count,
        "patients": len(patient_set),
        "latestAppointments": list(reversed(appts))[:5]
    }
    
    return {"success": True, "dashData": dash_data}
