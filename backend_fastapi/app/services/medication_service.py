"""Medication service - CRUD operations for medications with stock tracking."""
from bson import ObjectId
from datetime import datetime, timedelta
from typing import List, Optional
import re
from ..core.database import get_medications_collection


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


def enrich_medication(med: dict) -> dict:
    """Add calculated fields to medication record."""
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
    is_active: bool = True
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
        med["_id"] = str(med["_id"])
        if isinstance(med.get("created_at"), datetime):
            med["created_at"] = med["created_at"].isoformat()
        if isinstance(med.get("updated_at"), datetime):
            med["updated_at"] = med["updated_at"].isoformat()
        
        # Enrich with calculated fields
        med = enrich_medication(med)
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
    is_active: Optional[bool] = None
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
