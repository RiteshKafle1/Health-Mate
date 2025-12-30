"""Medication service - CRUD operations for medications with stock tracking."""
from bson import ObjectId
from datetime import datetime, timedelta
from typing import List, Optional, Dict
import re
from ...core.database import get_medications_collection


def parse_duration_to_days(duration: str) -> Optional[int]:
    """Parse duration string like '7 days', '2 weeks', '1 month' to days."""
    if not duration:
        return None
    
    duration = duration.lower().strip()
    
    # Pattern: number + unit
    match = re.match(r'(\d+)\s*(day|days|week|weeks|month|months)', duration)
    if match:
        num = int(match.group(1))
        unit = match.group(2)
        
        if 'week' in unit:
            return num * 7
        elif 'month' in unit:
            return num * 30  # Approximate
        else:
            return num
    
    # Try to parse just a number (assume days)
    try:
        return int(re.search(r'\d+', duration).group())
    except:
        return None


def calculate_stock_days_remaining(current_stock: int, frequency: int, dose_per_intake: int = 1) -> int:
    """Calculate how many days of stock remain."""
    if not current_stock or not frequency:
        return 0
    
    daily_consumption = frequency * dose_per_intake
    if daily_consumption <= 0:
        return 0
    
    return current_stock // daily_consumption


def calculate_stock_status(
    current_stock: Optional[int], 
    total_stock: Optional[int],
    frequency: int = 1,
    dose_per_intake: int = 1
) -> str:
    """
    Determine stock status based on days remaining.
    
    Uses smart thresholds:
    - "critical": 3 days or less of stock remaining
    - "low": 7 days or less of stock remaining
    - "medium": 14 days or less of stock remaining  
    - "healthy": more than 14 days of stock remaining
    - "out": no stock left
    """
    if current_stock is None:
        return "unknown"
    
    if current_stock <= 0:
        return "out"
    
    # Calculate days remaining based on actual consumption rate
    daily_consumption = frequency * dose_per_intake
    if daily_consumption <= 0:
        daily_consumption = 1  # Fallback to 1 pill/day
    
    days_remaining = current_stock // daily_consumption
    
    # Use days-based thresholds for smarter alerts
    if days_remaining <= 3:
        return "critical"  # Urgent - need to refill soon!
    elif days_remaining <= 7:
        return "low"  # Low - should plan to refill
    elif days_remaining <= 14:
        return "medium"  # Getting low, but not urgent
    else:
        return "healthy"  # Plenty of stock


def calculate_duration_progress(start_date: Optional[str], end_date: Optional[str]) -> dict:
    """Calculate progress through medication duration."""
    if not start_date:
        return {"progress": 0, "days_elapsed": 0, "total_days": 0}
    
    today = datetime.now().date()
    
    try:
        start = datetime.strptime(start_date, "%Y-%m-%d").date()
    except:
        return {"progress": 0, "days_elapsed": 0, "total_days": 0}
    
    days_elapsed = (today - start).days
    if days_elapsed < 0:
        days_elapsed = 0
    
    if end_date:
        try:
            end = datetime.strptime(end_date, "%Y-%m-%d").date()
            total_days = (end - start).days
            if total_days <= 0:
                total_days = 1
            progress = min(100, (days_elapsed / total_days) * 100)
            return {"progress": round(progress, 1), "days_elapsed": days_elapsed, "total_days": total_days}
        except:
            pass
    
    return {"progress": 0, "days_elapsed": days_elapsed, "total_days": 0}


def generate_schedule_times(frequency: int) -> List[str]:
    """
    Generate schedule times based on frequency.
    Distributes doses evenly throughout the day (8am to 8pm).
    """
    if frequency <= 0:
        return []
    
    if frequency == 1:
        return ["08:00"]
    elif frequency == 2:
        return ["08:00", "20:00"]
    elif frequency == 3:
        return ["08:00", "14:00", "20:00"]
    elif frequency == 4:
        return ["08:00", "12:00", "16:00", "20:00"]
    else:
        # For more than 4, distribute evenly
        times = []
        start_hour = 8
        end_hour = 22
        interval = (end_hour - start_hour) / (frequency - 1) if frequency > 1 else 0
        for i in range(frequency):
            hour = int(start_hour + i * interval)
            times.append(f"{hour:02d}:00")
        return times


def calculate_next_dose_time(schedule_times: Optional[List[str]], doses_taken: Optional[Dict[str, bool]]) -> Optional[str]:
    """Calculate the next scheduled dose time that hasn't been taken."""
    if not schedule_times:
        return None
    
    current_time = datetime.now().strftime("%H:%M")
    doses_taken = doses_taken or {}
    
    # Find the next untaken dose
    for time in sorted(schedule_times):
        if not doses_taken.get(time, False):
            # Return this time if it's in the future or is the next one
            return time
    
    # All doses taken for today
    return None


def enrich_medication(med: dict) -> dict:
    """Add calculated fields to medication record."""
    
    # ===== DAILY RESET LOGIC =====
    # Check if we need to reset doses for a new day
    today = datetime.now().strftime("%Y-%m-%d")
    doses_taken_date = med.get("doses_taken_date")
    
    if doses_taken_date and doses_taken_date != today:
        # It's a new day - need to reset the dose tracking
        # Store previous day's data for history logging
        med["_previous_doses"] = med.get("doses_taken_today", {}).copy()
        med["_previous_date"] = doses_taken_date
        med["doses_taken_today"] = {}
        med["doses_taken_date"] = today
        med["_needs_daily_reset"] = True  # Flag for async processing
    elif not doses_taken_date:
        # First time - initialize
        med["doses_taken_date"] = today
        med["doses_taken_today"] = {}
    
    # Initialize if missing (fallback)
    if not med.get("doses_taken_today"):
        med["doses_taken_today"] = {}
    # ===== END DAILY RESET LOGIC =====
    
    # Calculate stock metrics
    current_stock = med.get("current_stock")
    total_stock = med.get("total_stock")
    frequency = med.get("frequency", 1)
    dose_per_intake = med.get("dose_per_intake", 1)
    
    if current_stock is not None and frequency:
        med["days_remaining"] = calculate_stock_days_remaining(current_stock, frequency, dose_per_intake)
    else:
        med["days_remaining"] = None
    
    if total_stock and current_stock is not None:
        med["stock_percentage"] = round((current_stock / total_stock) * 100, 1) if total_stock > 0 else 0
    else:
        med["stock_percentage"] = None
    
    med["stock_status"] = calculate_stock_status(current_stock, total_stock, frequency, dose_per_intake)
    
    # Calculate duration progress
    progress_info = calculate_duration_progress(med.get("start_date"), med.get("end_date"))
    med["duration_progress"] = progress_info["progress"]
    med["days_elapsed"] = progress_info["days_elapsed"]
    med["total_days"] = progress_info["total_days"]
    
    # Generate schedule times if not set
    if not med.get("schedule_times") and frequency:
        med["schedule_times"] = generate_schedule_times(frequency)
    
    # Calculate next dose time
    med["next_dose_time"] = calculate_next_dose_time(
        med.get("schedule_times"), 
        med.get("doses_taken_today")
    )
    
    return med



async def create_medication(
    user_id: str,
    name: str,
    frequency: int,
    duration: str,
    timing: str,
    description: Optional[str] = None,
    total_stock: Optional[int] = None,
    current_stock: Optional[int] = None,
    dose_per_intake: int = 1,
    start_date: Optional[str] = None,
    is_active: bool = True,
    purpose: Optional[str] = None,
    instructions: Optional[str] = None,
    schedule_times: Optional[List[str]] = None
) -> dict:
    """Create a new medication for a user."""
    medications = get_medications_collection()
    
    now = datetime.utcnow()
    
    # Auto-set start_date to today if not provided
    if start_date is None:
        start_date = now.strftime("%Y-%m-%d")
    
    # Auto-calculate end_date based on duration
    end_date = None
    duration_days = parse_duration_to_days(duration)
    if duration_days and start_date:
        try:
            start_dt = datetime.strptime(start_date, "%Y-%m-%d")
            end_dt = start_dt + timedelta(days=duration_days)
            end_date = end_dt.strftime("%Y-%m-%d")
        except:
            pass
    
    # If current_stock not provided, default to total_stock
    if current_stock is None and total_stock is not None:
        current_stock = total_stock
    
    # Auto-generate schedule times if not provided
    if schedule_times is None:
        schedule_times = generate_schedule_times(frequency)
    
    medication_data = {
        "user_id": user_id,
        "name": name,
        "frequency": frequency,
        "duration": duration,
        "timing": timing,
        "description": description or "",
        "total_stock": total_stock,
        "current_stock": current_stock,
        "dose_per_intake": dose_per_intake,
        "start_date": start_date,
        "end_date": end_date,
        "is_active": is_active,
        "purpose": purpose,
        "instructions": instructions,
        "schedule_times": schedule_times,
        "doses_taken_today": {},
        "doses_taken_date": now.strftime("%Y-%m-%d"),  # Track which date the doses were taken
        "created_at": now,
        "updated_at": now
    }
    
    result = await medications.insert_one(medication_data)
    medication_data["_id"] = str(result.inserted_id)
    medication_data["created_at"] = now.isoformat()
    medication_data["updated_at"] = now.isoformat()
    
    # Enrich with calculated fields
    medication_data = enrich_medication(medication_data)
    
    return {
        "success": True,
        "message": "Medication added successfully",
        "medication": medication_data
    }


async def get_user_medications(user_id: str) -> dict:
    """Get all medications for a user with calculated fields."""
    medications = get_medications_collection()
    
    cursor = medications.find({"user_id": user_id})
    meds_list = []
    
    # Summary stats - detailed counts for each status
    total_meds = 0
    active_meds = 0
    critical_count = 0  # Urgent (≤3 days)
    low_count = 0       # Low stock (≤7 days)
    medium_count = 0    # Getting low (≤14 days)
    healthy_count = 0   # Good (>14 days)
    out_count = 0       # Out of stock
    
    async for med in cursor:
        med_id = med["_id"]  # Keep ObjectId for updates
        med["_id"] = str(med["_id"])
        if isinstance(med.get("created_at"), datetime):
            med["created_at"] = med["created_at"].isoformat()
        if isinstance(med.get("updated_at"), datetime):
            med["updated_at"] = med["updated_at"].isoformat()
        
        # Enrich with calculated fields (includes daily reset check)
        med = enrich_medication(med)
        
        # Process daily reset if flagged
        if med.get("_needs_daily_reset"):
            # Persist the reset to database
            await medications.update_one(
                {"_id": med_id},
                {"$set": {
                    "doses_taken_today": {},
                    "doses_taken_date": med["doses_taken_date"],
                    "updated_at": datetime.utcnow()
                }}
            )
            
            # Log previous day's doses to history (async, don't block)
            previous_date = med.get("_previous_date")
            previous_doses = med.get("_previous_doses", {})
            schedule_times = med.get("schedule_times", [])
            
            if previous_date and schedule_times:
                # Import here to avoid circular imports
                try:
                    from .dose_history_service import log_dose_event
                    for time_slot in schedule_times:
                        was_taken = previous_doses.get(time_slot, False)
                        await log_dose_event(
                            user_id=user_id,
                            medication_id=med["_id"],
                            medication_name=med.get("name", "Unknown"),
                            date=previous_date,
                            time_slot=time_slot,
                            status="taken" if was_taken else "missed",
                            actual_time=None  # We don't have exact time from previous day
                        )
                except ImportError:
                    # Service not yet created, skip history logging
                    pass
            
            # Clean up internal flags before adding to list
            del med["_needs_daily_reset"]
            if "_previous_doses" in med:
                del med["_previous_doses"]
            if "_previous_date" in med:
                del med["_previous_date"]
        
        meds_list.append(med)
        
        # Update summary stats
        total_meds += 1
        if med.get("is_active", True):
            active_meds += 1
        
        # Count by stock status
        stock_status = med.get("stock_status")
        if stock_status == "critical":
            critical_count += 1
        elif stock_status == "low":
            low_count += 1
        elif stock_status == "medium":
            medium_count += 1
        elif stock_status == "healthy":
            healthy_count += 1
        elif stock_status == "out":
            out_count += 1
    
    return {
        "success": True,
        "medications": meds_list,
        "summary": {
            "total": total_meds,
            "active": active_meds,
            "critical": critical_count,     # Urgent
            "low": low_count,               # Low Stock
            "medium": medium_count,         # Getting Low
            "healthy": healthy_count,       # Good
            "out": out_count,               # Out of Stock
            # Legacy fields for backwards compatibility
            "low_stock": critical_count + low_count,
            "out_of_stock": out_count
        }
    }


async def get_medication(user_id: str, medication_id: str) -> dict:
    """Get a specific medication by ID with calculated fields."""
    medications = get_medications_collection()
    
    try:
        med = await medications.find_one({
            "_id": ObjectId(medication_id),
            "user_id": user_id
        })
    except Exception:
        return {"success": False, "message": "Invalid medication ID"}
    
    if not med:
        return {"success": False, "message": "Medication not found"}
    
    med["_id"] = str(med["_id"])
    if isinstance(med.get("created_at"), datetime):
        med["created_at"] = med["created_at"].isoformat()
    if isinstance(med.get("updated_at"), datetime):
        med["updated_at"] = med["updated_at"].isoformat()
    
    # Enrich with calculated fields
    med = enrich_medication(med)
    
    return {
        "success": True,
        "medication": med
    }


async def update_medication(
    user_id: str,
    medication_id: str,
    name: Optional[str] = None,
    frequency: Optional[int] = None,
    duration: Optional[str] = None,
    timing: Optional[str] = None,
    description: Optional[str] = None,
    total_stock: Optional[int] = None,
    current_stock: Optional[int] = None,
    dose_per_intake: Optional[int] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    is_active: Optional[bool] = None,
    purpose: Optional[str] = None,
    instructions: Optional[str] = None,
    purpose_source: Optional[str] = None,
    instructions_source: Optional[str] = None,
    schedule_times: Optional[List[str]] = None
) -> dict:
    """Update an existing medication."""
    medications = get_medications_collection()
    
    # Build update data with only provided fields
    update_data = {"updated_at": datetime.utcnow()}
    
    if name is not None:
        update_data["name"] = name
    if frequency is not None:
        update_data["frequency"] = frequency
    if duration is not None:
        update_data["duration"] = duration
    if timing is not None:
        update_data["timing"] = timing
    if description is not None:
        update_data["description"] = description
    if total_stock is not None:
        update_data["total_stock"] = total_stock
    if current_stock is not None:
        update_data["current_stock"] = current_stock
    if dose_per_intake is not None:
        update_data["dose_per_intake"] = dose_per_intake
    if start_date is not None:
        update_data["start_date"] = start_date
    if end_date is not None:
        update_data["end_date"] = end_date
    if is_active is not None:
        update_data["is_active"] = is_active
    if purpose is not None:
        # Normalize empty strings to None so fields can be cleared
        update_data["purpose"] = purpose.strip() if purpose.strip() else None
    if instructions is not None:
        update_data["instructions"] = instructions.strip() if instructions.strip() else None
    if purpose_source is not None:
        # Clear source if purpose was cleared
        update_data["purpose_source"] = purpose_source if (purpose is None or purpose.strip()) else None
    if instructions_source is not None:
        # Clear source if instructions was cleared  
        update_data["instructions_source"] = instructions_source if (instructions is None or instructions.strip()) else None
    if schedule_times is not None:
        update_data["schedule_times"] = schedule_times
    
    # Recalculate end_date if duration or start_date changed
    if duration is not None or start_date is not None:
        # Get current med to merge with new values
        current_med = await get_medication(user_id, medication_id)
        if current_med["success"]:
            current = current_med["medication"]
            use_duration = duration if duration is not None else current.get("duration")
            use_start = start_date if start_date is not None else current.get("start_date")
            
            if use_duration and use_start:
                duration_days = parse_duration_to_days(use_duration)
                if duration_days:
                    try:
                        start_dt = datetime.strptime(use_start, "%Y-%m-%d")
                        end_dt = start_dt + timedelta(days=duration_days)
                        update_data["end_date"] = end_dt.strftime("%Y-%m-%d")
                    except:
                        pass
    
    try:
        result = await medications.update_one(
            {"_id": ObjectId(medication_id), "user_id": user_id},
            {"$set": update_data}
        )
    except Exception:
        return {"success": False, "message": "Invalid medication ID"}
    
    if result.matched_count == 0:
        return {"success": False, "message": "Medication not found or not owned by you"}
    
    # Fetch updated medication
    return await get_medication(user_id, medication_id)


async def update_stock(user_id: str, medication_id: str, current_stock: int) -> dict:
    """Update just the current stock level."""
    return await update_medication(user_id, medication_id, current_stock=current_stock)


async def refill_stock(user_id: str, medication_id: str, refill_amount: int, total_stock: Optional[int] = None) -> dict:
    """Refill medication stock by adding to current amount."""
    # Get current medication
    med_result = await get_medication(user_id, medication_id)
    if not med_result["success"]:
        return med_result
    
    current = med_result["medication"]
    current_stock = (current.get("current_stock") or 0) + refill_amount
    
    update_args = {"current_stock": current_stock}
    if total_stock is not None:
        update_args["total_stock"] = total_stock
    
    result = await update_medication(user_id, medication_id, **update_args)
    if result["success"]:
        result["message"] = f"Refilled {refill_amount} pills. New stock: {current_stock}"
    return result


async def delete_medication(user_id: str, medication_id: str) -> dict:
    """Delete a medication."""
    medications = get_medications_collection()
    
    try:
        result = await medications.delete_one({
            "_id": ObjectId(medication_id),
            "user_id": user_id
        })
    except Exception:
        return {"success": False, "message": "Invalid medication ID"}
    
    if result.deleted_count == 0:
        return {"success": False, "message": "Medication not found or not owned by you"}
    
    return {"success": True, "message": "Medication deleted successfully"}


async def get_medications_summary(user_id: str) -> str:
    """Get a text summary of all medications for context awareness."""
    result = await get_user_medications(user_id)
    
    if not result["success"] or not result["medications"]:
        return "No medications currently recorded."
    
    meds = result["medications"]
    summary = result.get("summary", {})
    
    summary_lines = [
        f"Current medications ({summary.get('active', len(meds))} active):"
    ]
    
    if summary.get("low_stock", 0) > 0:
        summary_lines.append(f"⚠️ {summary['low_stock']} medications have low stock!")
    
    for i, med in enumerate(meds, 1):
        line = f"{i}. {med['name']} - {med['frequency']}x daily"
        
        if med.get('timing'):
            line += f" ({med['timing']})"
        
        # Add stock info
        if med.get("current_stock") is not None:
            line += f" | Stock: {med['current_stock']} "
            if med.get("days_remaining"):
                line += f"({med['days_remaining']} days left)"
            if med.get("stock_status") == "low":
                line += " ⚠️ LOW"
            elif med.get("stock_status") == "out":
                line += " ❌ OUT"
        
        # Add progress info
        if med.get("duration_progress") and med.get("duration_progress") > 0:
            line += f" | Progress: {med['duration_progress']:.0f}%"
        
        summary_lines.append(line)
    
    return "\n".join(summary_lines)


async def get_low_stock_medications(user_id: str) -> dict:
    """Get medications with low or out of stock."""
    result = await get_user_medications(user_id)
    
    if not result["success"]:
        return result
    
    low_stock = [
        med for med in result["medications"]
        if med.get("stock_status") in ("low", "out")
    ]
    
    return {
        "success": True,
        "medications": low_stock,
        "count": len(low_stock)
    }


async def mark_dose_taken(user_id: str, medication_id: str, time_slot: str, taken: bool) -> dict:
    """
    Mark a specific dose as taken or untaken.
    Updates doses_taken_today with the time slot status.
    Also decrements current_stock when marking as taken.
    NOW ALSO LOGS TO DOSE HISTORY FOR ADHERENCE TRACKING.
    """
    medications = get_medications_collection()
    
    # First get the medication to check ownership and current state
    med_result = await get_medication(user_id, medication_id)
    if not med_result["success"]:
        return med_result
    
    current_med = med_result["medication"]
    today = datetime.now().strftime("%Y-%m-%d")
    
    # Get current doses_taken_today, reset if it's a new day
    doses_taken_today = current_med.get("doses_taken_today", {})
    doses_taken_date = current_med.get("doses_taken_date")
    
    if doses_taken_date != today:
        # New day - reset the doses
        doses_taken_today = {}
    
    # Check if this is a state change
    was_taken = doses_taken_today.get(time_slot, False)
    
    # Update the dose status
    doses_taken_today[time_slot] = taken
    
    # Calculate stock change
    current_stock = current_med.get("current_stock")
    dose_per_intake = current_med.get("dose_per_intake", 1)
    
    if current_stock is not None:
        if taken and not was_taken:
            # Marking as taken - decrement stock
            current_stock = max(0, current_stock - dose_per_intake)
        elif not taken and was_taken:
            # Unmarking as taken - increment stock back
            current_stock = current_stock + dose_per_intake
    
    try:
        update_data = {
            "doses_taken_today": doses_taken_today,
            "doses_taken_date": today,
            "updated_at": datetime.utcnow()
        }
        
        if current_stock is not None:
            update_data["current_stock"] = current_stock
        
        result = await medications.update_one(
            {"_id": ObjectId(medication_id), "user_id": user_id},
            {"$set": update_data}
        )
    except Exception as e:
        return {"success": False, "message": f"Failed to update dose: {str(e)}"}
    
    if result.matched_count == 0:
        return {"success": False, "message": "Medication not found or not owned by you"}
    
    # === LOG TO DOSE HISTORY ===
    # Log this action to permanent history for adherence tracking
    try:
        from .dose_history_service import log_dose_event
        await log_dose_event(
            user_id=user_id,
            medication_id=medication_id,
            medication_name=current_med.get("name", "Unknown"),
            date=today,
            time_slot=time_slot,
            status="taken" if taken else "missed",
            actual_time=datetime.now() if taken else None
        )
    except Exception:
        # Don't fail the main operation if history logging fails
        pass
    # === END HISTORY LOGGING ===
    
    # Fetch and return updated medication
    updated = await get_medication(user_id, medication_id)
    if updated["success"]:
        updated["message"] = f"Dose at {time_slot} marked as {'taken' if taken else 'not taken'}"
    return updated

