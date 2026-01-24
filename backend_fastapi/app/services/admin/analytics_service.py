"""Analytics service for admin dashboard."""
from datetime import datetime, timedelta
from bson import ObjectId
from ...core.database import (
    get_doctors_collection,
    get_appointments_collection, 
    get_users_collection,
    get_medications_collection,
    get_dose_logs_collection
)


def get_creation_timestamp(doc: dict) -> int:
    """Get document creation timestamp from 'date' field or '_id'."""
    if "date" in doc and doc["date"]:
        return int(doc["date"])
    
    # Fallback to _id generation time
    if "_id" in doc:
        try:
            oid = doc["_id"]
            if isinstance(oid, str):
                oid = ObjectId(oid)
            return int(oid.generation_time.timestamp() * 1000)
        except:
            pass
            
    return 0


async def get_platform_stats() -> dict:
    """Get overall platform statistics for admin dashboard KPIs."""
    doctors = get_doctors_collection()
    users = get_users_collection()
    appointments = get_appointments_collection()
    medications = get_medications_collection()
    
    # Get current date info
    today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    today_str = today.strftime("%d_%m_%Y")
    week_ago = today - timedelta(days=7)
    week_ago_timestamp = int(week_ago.timestamp() * 1000)
    
    # Count doctors
    all_docs = []
    async for doc in doctors.find({}):
        all_docs.append(doc)
    
    total_doctors = len(all_docs)
    available_doctors = len([d for d in all_docs if d.get("available", False)])
    
    # Count users
    all_users = []
    async for user in users.find({}):
        all_users.append(user)
    
    total_patients = len(all_users)
    
    # New patients this week
    new_patients_week = 0
    for user in all_users:
        user_date = get_creation_timestamp(user)
        if user_date >= week_ago_timestamp:
            new_patients_week += 1
    
    # Get all appointments
    all_appts = []
    async for appt in appointments.find({}):
        appt["_id"] = str(appt["_id"])
        all_appts.append(appt)
    
    total_appointments = len(all_appts)
    
    # Today's appointments
    todays_appointments = len([
        a for a in all_appts 
        if a.get("slotDate", "").replace("-", "_") == today_str or 
           a.get("slotDate") == today.strftime("%Y-%m-%d")
    ])
    
    # Appointment status counts
    completed = len([a for a in all_appts if a.get("isCompleted", False)])
    cancelled = len([a for a in all_appts if a.get("cancelled", False)])
    pending = total_appointments - completed - cancelled
    
    # Completion rate
    completion_rate = round((completed / total_appointments * 100), 1) if total_appointments > 0 else 0
    
    # Users with medications (active medication users)
    med_user_ids = set()
    async for med in medications.find({}):
        if med.get("user_id"):
            med_user_ids.add(str(med.get("user_id")))
    
    active_medication_users = len(med_user_ids)
    
    return {
        "totalDoctors": total_doctors,
        "availableDoctors": available_doctors,
        "totalPatients": total_patients,
        "newPatientsThisWeek": new_patients_week,
        "totalAppointments": total_appointments,
        "todaysAppointments": todays_appointments,
        "completedAppointments": completed,
        "cancelledAppointments": cancelled,
        "pendingAppointments": pending,
        "completionRate": completion_rate,
        "activeMedicationUsers": active_medication_users
    }


async def get_doctor_performance() -> list:
    """Get performance metrics for each doctor."""
    doctors = get_doctors_collection()
    appointments = get_appointments_collection()
    
    # Get all appointments grouped by doctor
    appt_by_doctor = {}
    async for appt in appointments.find({}):
        doc_id = appt.get("docId")
        if doc_id:
            if doc_id not in appt_by_doctor:
                appt_by_doctor[doc_id] = []
            appt_by_doctor[doc_id].append(appt)
    
    # Build performance data for each doctor
    performance = []
    async for doc in doctors.find({}):
        doc_id = str(doc["_id"])
        doc_appts = appt_by_doctor.get(doc_id, [])
        
        total = len(doc_appts)
        completed = len([a for a in doc_appts if a.get("isCompleted", False)])
        cancelled = len([a for a in doc_appts if a.get("cancelled", False)])
        pending = total - completed - cancelled
        
        # Unique patients
        patient_set = set(a.get("userId") for a in doc_appts if a.get("userId"))
        
        performance.append({
            "_id": doc_id,
            "name": doc.get("name", "Unknown"),
            "image": doc.get("image", ""),
            "speciality": doc.get("speciality", "General"),
            "available": doc.get("available", False),
            "totalAppointments": total,
            "completed": completed,
            "cancelled": cancelled,
            "pending": pending,
            "patients": len(patient_set),
            "completionRate": round((completed / total * 100), 1) if total > 0 else 0
        })
    
    # Sort by total appointments descending
    performance.sort(key=lambda x: x["totalAppointments"], reverse=True)
    
    return performance


async def get_appointment_analytics() -> dict:
    """Get appointment analytics for charts."""
    appointments = get_appointments_collection()
    doctors = get_doctors_collection()
    
    # Build specialty lookup
    specialty_by_doc = {}
    async for doc in doctors.find({}):
        specialty_by_doc[str(doc["_id"])] = doc.get("speciality", "General")
    
    # Get all appointments
    all_appts = []
    async for appt in appointments.find({}):
        appt["_id"] = str(appt["_id"])
        all_appts.append(appt)
    
    # By Status
    completed = len([a for a in all_appts if a.get("isCompleted", False)])
    cancelled = len([a for a in all_appts if a.get("cancelled", False)])
    pending = len(all_appts) - completed - cancelled
    
    by_status = [
        {"name": "Completed", "value": completed, "color": "#10b981"},
        {"name": "Pending", "value": pending, "color": "#f59e0b"},
        {"name": "Cancelled", "value": cancelled, "color": "#ef4444"}
    ]
    
    # By Specialty
    specialty_counts = {}
    for appt in all_appts:
        doc_id = appt.get("docId")
        specialty = specialty_by_doc.get(doc_id, "General")
        specialty_counts[specialty] = specialty_counts.get(specialty, 0) + 1
    
    by_specialty = [
        {"name": name, "value": count}
        for name, count in sorted(specialty_counts.items(), key=lambda x: x[1], reverse=True)
    ]
    
    # Daily trend (last 7 days)
    today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    daily_trend = []
    
    for i in range(6, -1, -1):  # 7 days including today
        day = today - timedelta(days=i)
        day_str_underscore = day.strftime("%d_%m_%Y")
        day_str_dash = day.strftime("%Y-%m-%d")
        
        count = len([
            a for a in all_appts 
            if a.get("slotDate") == day_str_underscore or 
               a.get("slotDate") == day_str_dash
        ])
        
        daily_trend.append({
            "date": day.strftime("%b %d"),
            "count": count
        })
    
    return {
        "byStatus": by_status,
        "bySpecialty": by_specialty,
        "dailyTrend": daily_trend
    }


async def get_recent_activity(limit: int = 10) -> list:
    """Get recent platform activity for activity feed."""
    appointments = get_appointments_collection()
    users = get_users_collection()
    
    activities = []
    
    # Recent completed appointments
    async for appt in appointments.find({"isCompleted": True}).sort("date", -1).limit(5):
        user_name = "Unknown"
        if appt.get("userData"):
            user_name = appt["userData"].get("name", "Unknown")
        doc_name = "Unknown"
        if appt.get("docData"):
            doc_name = appt["docData"].get("name", "Unknown")
        
        activities.append({
            "type": "appointment_completed",
            "message": f"{user_name}'s appointment with Dr. {doc_name} completed",
            "timestamp": appt.get("date", 0),
            "icon": "check"
        })
    
    # Recent new users (last 5) - Manually sort since 'date' might be missing query-side
    all_users_for_activity = []
    async for user in users.find({}):
        all_users_for_activity.append(user)
    
    # Sort in memory by creation timestamp
    all_users_for_activity.sort(key=lambda x: get_creation_timestamp(x), reverse=True)
    recent_users = all_users_for_activity[:5]
    
    for user in recent_users:
        timestamp = get_creation_timestamp(user)
        activities.append({
            "type": "new_user",
            "message": f"New patient: {user.get('name', 'Unknown')} registered",
            "timestamp": timestamp,
            "icon": "user"
        })
    
    # Sort by timestamp descending and limit
    activities.sort(key=lambda x: x.get("timestamp", 0), reverse=True)
    
    return activities[:limit]


async def get_registration_stats(period: str = 'month') -> dict:
    """Get registration statistics for users and doctors."""
    users = get_users_collection()
    doctors = get_doctors_collection()
    
    # Determine start date
    today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    
    if period == 'week':
        start_date = today - timedelta(days=7)
        days_to_process = 8
    elif period == 'month':
        start_date = today - timedelta(days=30)
        days_to_process = 31
    elif period == 'today': # Add explicit today handling requested by user
        start_date = today
        days_to_process = 1
    else:  # default
        start_date = today - timedelta(days=30)
        days_to_process = 31
        
    start_timestamp = int(start_date.timestamp() * 1000)
    
    # Fetch all users/doctors to filter by correct timestamp helper
    # Optimization: could use _id range if we trust monotonic _id, but getting all is safer for consistency
    # given the scale is likely small-medium. For large scale, we'd use _id query.
    
    all_users = []
    async for user in users.find({}):
        all_users.append(user)
        
    all_docs = []
    async for doc in doctors.find({}):
        all_docs.append(doc)
        
    new_users = [u for u in all_users if get_creation_timestamp(u) >= start_timestamp]
    new_doctors = [d for d in all_docs if get_creation_timestamp(d) >= start_timestamp]
        
    # Aggregate by day
    stats = []
    for i in range(days_to_process):
        current_day = start_date + timedelta(days=i)
        next_day = current_day + timedelta(days=1)
        
        day_start = int(current_day.timestamp() * 1000)
        day_end = int(next_day.timestamp() * 1000)
        
        user_count = len([
            u for u in new_users 
            if day_start <= get_creation_timestamp(u) < day_end
        ])
        
        doc_count = len([
            d for d in new_doctors 
            if day_start <= get_creation_timestamp(d) < day_end
        ])
        
        stats.append({
            "date": current_day.strftime("%b %d"),
            "users": user_count,
            "doctors": doc_count
        })
        
    # Calculate totals
    total_new_users = len(new_users)
    total_new_doctors = len(new_doctors)
    
    return {
        "chartData": stats,
        "summary": {
            "users": total_new_users,
            "doctors": total_new_doctors
        }
    }
