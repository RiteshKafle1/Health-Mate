"""Dose scheduling service - generate schedules, track doses, calculate status."""
from bson import ObjectId
from datetime import datetime, timedelta
from typing import List, Optional, Tuple
from ...core.database import get_dose_schedules_collection, get_dose_logs_collection, get_medications_collection
from ...models.dose_schedule import (
    DoseStatus, DEFAULT_SCHEDULES, TIMING_PRESETS,
    EARLY_WINDOW, ON_TIME_WINDOW, LATE_WINDOW, MISSED_THRESHOLD
)


def generate_schedule_times(frequency: int, timing: Optional[str] = None) -> List[str]:
    """
    Generate optimal dose times based on frequency and timing hint.
    
    Args:
        frequency: Number of doses per day (1-6)
        timing: Optional timing hint like "After breakfast", "With meals"
        
    Returns:
        List of time strings like ["08:00", "20:00"]
    """
    # Check if timing has a preset
    if timing and timing in TIMING_PRESETS:
        preset = TIMING_PRESETS[timing]
        if isinstance(preset, list):
            # "With meals" returns 3 times
            return preset[:frequency]
        elif preset:
            # Single time preset - adjust based on frequency
            if frequency == 1:
                return [preset]
            elif frequency == 2:
                # Add 12 hours
                base_hour = int(preset.split(":")[0])
                second_hour = (base_hour + 12) % 24
                return [preset, f"{second_hour:02d}:00"]
            elif frequency >= 3:
                # Use default schedule but shift to meal-aligned times
                return DEFAULT_SCHEDULES.get(frequency, DEFAULT_SCHEDULES[3])
    
    # Use default schedule for the frequency
    return DEFAULT_SCHEDULES.get(frequency, DEFAULT_SCHEDULES[1])


def calculate_dose_status(
    scheduled_time: str,
    current_time: datetime,
    taken_at: Optional[str] = None
) -> Tuple[DoseStatus, int]:
    """
    Calculate the status of a dose based on scheduled time and whether it was taken.
    
    Args:
        scheduled_time: Scheduled time string "HH:MM"
        current_time: Current datetime
        taken_at: Actual time taken (if any) "HH:MM"
        
    Returns:
        Tuple of (DoseStatus, time_diff_in_minutes)
    """
    # Parse scheduled time for today
    hour, minute = map(int, scheduled_time.split(":"))
    scheduled_dt = current_time.replace(hour=hour, minute=minute, second=0, microsecond=0)
    
    if taken_at:
        # Dose was taken - calculate if on-time or late
        taken_hour, taken_minute = map(int, taken_at.split(":"))
        taken_dt = current_time.replace(hour=taken_hour, minute=taken_minute, second=0, microsecond=0)
        
        diff_minutes = int((taken_dt - scheduled_dt).total_seconds() / 60)
        
        if -EARLY_WINDOW <= diff_minutes <= ON_TIME_WINDOW:
            return DoseStatus.TAKEN, diff_minutes
        else:
            return DoseStatus.LATE, diff_minutes
    else:
        # Dose not taken - check if pending, available, or missed
        diff_minutes = int((current_time - scheduled_dt).total_seconds() / 60)
        
        if diff_minutes < -EARLY_WINDOW:
            # More than 30min before scheduled time
            return DoseStatus.PENDING, diff_minutes
        elif diff_minutes <= MISSED_THRESHOLD:
            # Within the taking window (-30min to +2hr)
            return DoseStatus.AVAILABLE, diff_minutes
        else:
            # Past the 2hr window
            return DoseStatus.MISSED, diff_minutes


async def create_or_update_schedule(
    user_id: str,
    medication_id: str,
    scheduled_times: List[str],
    is_custom: bool = False
) -> dict:
    """Create or update a dose schedule for a medication."""
    schedules = get_dose_schedules_collection()
    now = datetime.utcnow()
    
    # Check if schedule exists
    existing = await schedules.find_one({
        "medication_id": medication_id,
        "user_id": user_id
    })
    
    if existing:
        # Update existing
        await schedules.update_one(
            {"_id": existing["_id"]},
            {"$set": {
                "scheduled_times": scheduled_times,
                "is_custom": is_custom,
                "updated_at": now
            }}
        )
        schedule_id = str(existing["_id"])
    else:
        # Create new
        result = await schedules.insert_one({
            "medication_id": medication_id,
            "user_id": user_id,
            "scheduled_times": scheduled_times,
            "is_custom": is_custom,
            "created_at": now,
            "updated_at": now
        })
        schedule_id = str(result.inserted_id)
    
    return {
        "success": True,
        "schedule_id": schedule_id,
        "scheduled_times": scheduled_times
    }


async def get_schedule(user_id: str, medication_id: str) -> dict:
    """Get the dose schedule for a medication."""
    schedules = get_dose_schedules_collection()
    medications = get_medications_collection()
    
    schedule = await schedules.find_one({
        "medication_id": medication_id,
        "user_id": user_id
    })
    
    if not schedule:
        # Try to generate default schedule from medication
        med = await medications.find_one({
            "_id": ObjectId(medication_id),
            "user_id": user_id
        })
        if med:
            times = generate_schedule_times(med.get("frequency", 1), med.get("timing"))
            # Create the schedule
            await create_or_update_schedule(user_id, medication_id, times, False)
            return {
                "success": True,
                "schedule": {
                    "_id": None,
                    "medication_id": medication_id,
                    "medication_name": med.get("name"),
                    "scheduled_times": times,
                    "is_custom": False
                }
            }
        return {"success": False, "message": "Medication not found"}
    
    # Get medication name
    med = await medications.find_one({"_id": ObjectId(medication_id)})
    
    schedule["_id"] = str(schedule["_id"])
    if isinstance(schedule.get("created_at"), datetime):
        schedule["created_at"] = schedule["created_at"].isoformat()
    if isinstance(schedule.get("updated_at"), datetime):
        schedule["updated_at"] = schedule["updated_at"].isoformat()
    schedule["medication_name"] = med.get("name") if med else None
    
    return {"success": True, "schedule": schedule}


async def get_today_doses(user_id: str) -> dict:
    """Get all doses for today with their status."""
    schedules = get_dose_schedules_collection()
    logs = get_dose_logs_collection()
    medications = get_medications_collection()
    
    today = datetime.now().strftime("%Y-%m-%d")
    now = datetime.now()
    
    doses = []
    total = 0
    taken_count = 0
    missed_count = 0
    pending_count = 0
    
    # Get all medications for user
    meds_cursor = medications.find({"user_id": user_id, "is_active": {"$ne": False}})
    
    async for med in meds_cursor:
        med_id = str(med["_id"])
        med_name = med.get("name", "Unknown")
        
        # Get schedule for this medication
        schedule = await schedules.find_one({
            "medication_id": med_id,
            "user_id": user_id
        })
        
        if not schedule:
            # Generate default schedule
            times = generate_schedule_times(med.get("frequency", 1), med.get("timing"))
            await create_or_update_schedule(user_id, med_id, times, False)
        else:
            times = schedule.get("scheduled_times", [])
        
        # For each scheduled time, check if there's a log
        for scheduled_time in times:
            total += 1
            
            # Check for existing log
            log = await logs.find_one({
                "medication_id": med_id,
                "user_id": user_id,
                "date": today,
                "scheduled_time": scheduled_time
            })
            
            taken_at = log.get("taken_at") if log else None
            status, time_diff = calculate_dose_status(scheduled_time, now, taken_at)
            
            # Calculate time until/since
            hour, minute = map(int, scheduled_time.split(":"))
            scheduled_dt = now.replace(hour=hour, minute=minute, second=0, microsecond=0)
            diff_minutes = int((scheduled_dt - now).total_seconds() / 60)
            
            dose_item = {
                "medication_id": med_id,
                "medication_name": med_name,
                "scheduled_time": scheduled_time,
                "status": status.value,
                "taken_at": taken_at,
                "time_until": diff_minutes if diff_minutes > 0 else None,
                "time_since": abs(diff_minutes) if diff_minutes < 0 else None,
                "can_take": status in (DoseStatus.AVAILABLE, DoseStatus.PENDING),
                "dose_log_id": str(log["_id"]) if log else None
            }
            doses.append(dose_item)
            
            # Update counts
            if status == DoseStatus.TAKEN or status == DoseStatus.LATE:
                taken_count += 1
            elif status == DoseStatus.MISSED:
                missed_count += 1
            else:
                pending_count += 1
    
    # Sort doses by scheduled time
    doses.sort(key=lambda x: x["scheduled_time"])
    
    return {
        "success": True,
        "date": today,
        "doses": doses,
        "summary": {
            "total": total,
            "taken": taken_count,
            "missed": missed_count,
            "pending": pending_count,
            "adherence_rate": round((taken_count / total * 100), 1) if total > 0 else 100
        }
    }


async def mark_dose_taken(
    user_id: str,
    medication_id: str,
    scheduled_time: str,
    taken_at: Optional[str] = None
) -> dict:
    """Mark a dose as taken."""
    logs = get_dose_logs_collection()
    medications = get_medications_collection()
    
    today = datetime.now().strftime("%Y-%m-%d")
    now = datetime.now()
    
    # Default taken_at to current time
    if not taken_at:
        taken_at = now.strftime("%H:%M")
    
    # Calculate status
    status, time_diff = calculate_dose_status(scheduled_time, now, taken_at)
    
    # Check if log already exists
    existing = await logs.find_one({
        "medication_id": medication_id,
        "user_id": user_id,
        "date": today,
        "scheduled_time": scheduled_time
    })
    
    if existing:
        # Update existing log
        await logs.update_one(
            {"_id": existing["_id"]},
            {"$set": {
                "status": status.value,
                "taken_at": taken_at
            }}
        )
        log_id = str(existing["_id"])
    else:
        # Create new log
        result = await logs.insert_one({
            "medication_id": medication_id,
            "user_id": user_id,
            "date": today,
            "scheduled_time": scheduled_time,
            "status": status.value,
            "taken_at": taken_at,
            "created_at": now
        })
        log_id = str(result.inserted_id)
    
    # Decrement stock if tracking
    med = await medications.find_one({
        "_id": ObjectId(medication_id),
        "user_id": user_id
    })
    
    if med and med.get("current_stock") is not None:
        dose_per_intake = med.get("dose_per_intake", 1)
        new_stock = max(0, med.get("current_stock", 0) - dose_per_intake)
        await medications.update_one(
            {"_id": ObjectId(medication_id)},
            {"$set": {"current_stock": new_stock, "updated_at": now}}
        )
    
    return {
        "success": True,
        "message": f"Dose marked as {status.value}",
        "log_id": log_id,
        "status": status.value,
        "taken_at": taken_at,
        "time_diff_minutes": time_diff
    }


async def get_dose_history(
    user_id: str,
    start_date: str,
    end_date: str,
    medication_id: Optional[str] = None
) -> dict:
    """Get dose history for a date range."""
    logs = get_dose_logs_collection()
    medications = get_medications_collection()
    
    query = {
        "user_id": user_id,
        "date": {"$gte": start_date, "$lte": end_date}
    }
    
    if medication_id:
        query["medication_id"] = medication_id
    
    cursor = logs.find(query).sort("date", -1).sort("scheduled_time", 1)
    
    log_list = []
    taken_count = 0
    total_count = 0
    
    async for log in cursor:
        log["_id"] = str(log["_id"])
        if isinstance(log.get("created_at"), datetime):
            log["created_at"] = log["created_at"].isoformat()
        
        # Get medication name
        med = await medications.find_one({"_id": ObjectId(log["medication_id"])})
        log["medication_name"] = med.get("name") if med else None
        
        log_list.append(log)
        total_count += 1
        if log.get("status") in ("taken", "late"):
            taken_count += 1
    
    return {
        "success": True,
        "start_date": start_date,
        "end_date": end_date,
        "logs": log_list,
        "adherence_rate": round((taken_count / total_count * 100), 1) if total_count > 0 else 100
    }


async def update_schedule(
    user_id: str,
    medication_id: str,
    scheduled_times: List[str]
) -> dict:
    """Update custom schedule times for a medication."""
    return await create_or_update_schedule(user_id, medication_id, scheduled_times, is_custom=True)


async def auto_create_schedule_for_medication(
    user_id: str,
    medication_id: str,
    frequency: int,
    timing: Optional[str] = None
) -> dict:
    """Automatically create a schedule when a medication is added."""
    times = generate_schedule_times(frequency, timing)
    return await create_or_update_schedule(user_id, medication_id, times, is_custom=False)
