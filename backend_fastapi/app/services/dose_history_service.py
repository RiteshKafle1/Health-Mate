"""
Dose History Service - Permanent logging of all medication dose events for adherence analytics.

This service provides:
- Logging of all dose events (taken, missed, late)
- Adherence statistics (weekly, monthly)
- Missed doses tracking
- Streak calculation
"""
from datetime import datetime, timedelta
from bson import ObjectId
from typing import Optional, List, Dict
from ..core.database import get_dose_history_collection


async def log_dose_event(
    user_id: str,
    medication_id: str,
    medication_name: str,
    date: str,
    time_slot: str,
    status: str,  # "taken", "missed", "skipped"
    actual_time: Optional[datetime] = None,
    notes: Optional[str] = None
) -> dict:
    """
    Log a dose event to permanent history.
    
    Called when:
    - User marks a dose as taken
    - End-of-day processing marks untaken doses as missed
    - User explicitly skips a dose
    
    Uses upsert to prevent duplicate entries for same medication/date/time_slot.
    """
    history = get_dose_history_collection()
    
    # Calculate if dose was late (taken >30 min after scheduled)
    was_late = False
    if status == "taken" and actual_time:
        try:
            scheduled_time = datetime.strptime(f"{date} {time_slot}", "%Y-%m-%d %H:%M")
            late_threshold = scheduled_time + timedelta(minutes=30)
            was_late = actual_time > late_threshold
        except ValueError:
            pass  # Invalid time format, assume not late
    
    record = {
        "user_id": user_id,
        "medication_id": medication_id,
        "medication_name": medication_name,
        "date": date,
        "time_slot": time_slot,
        "status": status,
        "actual_time": actual_time,
        "was_late": was_late,
        "notes": notes,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    
    # Add scheduled_at timestamp for easier querying
    try:
        record["scheduled_at"] = datetime.strptime(f"{date} {time_slot}", "%Y-%m-%d %H:%M")
    except ValueError:
        record["scheduled_at"] = None
    
    # Upsert: Update if exists for same med/date/time, else insert
    result = await history.update_one(
        {
            "medication_id": medication_id,
            "date": date,
            "time_slot": time_slot
        },
        {"$set": record},
        upsert=True
    )
    
    return {
        "success": True,
        "was_late": was_late,
        "upserted": result.upserted_id is not None
    }


async def get_adherence_stats(
    user_id: str,
    period: str = "week",  # "week", "month", "all"
    medication_id: Optional[str] = None
) -> dict:
    """
    Calculate adherence statistics for a user.
    
    Returns:
    - Overall adherence percentage
    - Breakdown by status (taken, missed, late)
    - Per-medication breakdown
    """
    history = get_dose_history_collection()
    
    # Calculate date range
    today = datetime.now().date()
    if period == "week":
        start_date = today - timedelta(days=7)
    elif period == "month":
        start_date = today - timedelta(days=30)
    else:
        start_date = today - timedelta(days=365)  # Last year
    
    query = {
        "user_id": user_id,
        "date": {"$gte": start_date.strftime("%Y-%m-%d")}
    }
    
    if medication_id:
        query["medication_id"] = medication_id
    
    cursor = history.find(query)
    
    total = 0
    taken = 0
    missed = 0
    late = 0
    skipped = 0
    by_medication: Dict[str, Dict] = {}
    by_date: Dict[str, Dict] = {}
    
    async for record in cursor:
        total += 1
        med_name = record.get("medication_name", "Unknown")
        record_date = record.get("date", "Unknown")
        
        # Initialize medication stats if not exists
        if med_name not in by_medication:
            by_medication[med_name] = {
                "medication_id": record.get("medication_id"),
                "taken": 0,
                "missed": 0,
                "late": 0,
                "skipped": 0,
                "total": 0
            }
        
        # Initialize date stats if not exists
        if record_date not in by_date:
            by_date[record_date] = {"taken": 0, "missed": 0, "total": 0}
        
        by_medication[med_name]["total"] += 1
        by_date[record_date]["total"] += 1
        
        status = record.get("status")
        if status == "taken":
            taken += 1
            by_medication[med_name]["taken"] += 1
            by_date[record_date]["taken"] += 1
            if record.get("was_late"):
                late += 1
                by_medication[med_name]["late"] += 1
        elif status == "missed":
            missed += 1
            by_medication[med_name]["missed"] += 1
            by_date[record_date]["missed"] += 1
        elif status == "skipped":
            skipped += 1
            by_medication[med_name]["skipped"] += 1
    
    # Calculate percentages
    adherence_percentage = (taken / total * 100) if total > 0 else 100
    
    # Calculate per-medication adherence
    for med_name in by_medication:
        med_stats = by_medication[med_name]
        med_stats["adherence_percentage"] = round(
            (med_stats["taken"] / med_stats["total"] * 100) if med_stats["total"] > 0 else 100,
            1
        )
    
    return {
        "success": True,
        "period": period,
        "start_date": start_date.strftime("%Y-%m-%d"),
        "end_date": today.strftime("%Y-%m-%d"),
        "summary": {
            "total_doses": total,
            "taken": taken,
            "missed": missed,
            "late": late,
            "skipped": skipped,
            "adherence_percentage": round(adherence_percentage, 1),
            "on_time_percentage": round(((taken - late) / total * 100) if total > 0 else 100, 1)
        },
        "by_medication": by_medication,
        "by_date": by_date
    }


async def get_missed_doses(
    user_id: str,
    limit: int = 20,
    medication_id: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
) -> dict:
    """
    Get list of missed doses for a user.
    
    Returns most recent missed doses, optionally filtered by medication or date range.
    """
    history = get_dose_history_collection()
    
    query = {
        "user_id": user_id,
        "status": "missed"
    }
    
    if medication_id:
        query["medication_id"] = medication_id
    
    if start_date or end_date:
        query["date"] = {}
        if start_date:
            query["date"]["$gte"] = start_date
        if end_date:
            query["date"]["$lte"] = end_date
    
    cursor = history.find(query).sort("scheduled_at", -1).limit(limit)
    
    missed_list = []
    async for record in cursor:
        missed_list.append({
            "medication_id": record.get("medication_id"),
            "medication_name": record.get("medication_name"),
            "date": record.get("date"),
            "time_slot": record.get("time_slot"),
            "scheduled_at": record.get("scheduled_at").isoformat() if record.get("scheduled_at") else None
        })
    
    return {
        "success": True,
        "missed_doses": missed_list,
        "count": len(missed_list)
    }


async def calculate_streak(user_id: str) -> dict:
    """
    Calculate current streak of consecutive days with 100% adherence.
    
    A day counts towards the streak if:
    - All scheduled doses were taken
    - No doses were missed
    
    Returns:
    - Current streak length
    - Best streak ever
    - Last broken date (if any)
    """
    history = get_dose_history_collection()
    
    # Get all dates with dose records, sorted descending
    pipeline = [
        {"$match": {"user_id": user_id}},
        {"$group": {
            "_id": "$date",
            "total": {"$sum": 1},
            "taken": {"$sum": {"$cond": [{"$eq": ["$status", "taken"]}, 1, 0]}},
            "missed": {"$sum": {"$cond": [{"$eq": ["$status", "missed"]}, 1, 0]}}
        }},
        {"$sort": {"_id": -1}}
    ]
    
    daily_stats = []
    async for doc in history.aggregate(pipeline):
        daily_stats.append({
            "date": doc["_id"],
            "total": doc["total"],
            "taken": doc["taken"],
            "missed": doc["missed"],
            "is_perfect": doc["missed"] == 0 and doc["taken"] > 0
        })
    
    # Calculate current streak (consecutive perfect days from most recent)
    current_streak = 0
    last_broken_date = None
    today = datetime.now().strftime("%Y-%m-%d")
    
    for i, day in enumerate(daily_stats):
        # Skip today if it's still ongoing
        if day["date"] == today and i == 0:
            continue
        
        if day["is_perfect"]:
            current_streak += 1
        else:
            last_broken_date = day["date"]
            break
    
    # Calculate best streak ever
    best_streak = 0
    temp_streak = 0
    
    for day in daily_stats:
        if day["is_perfect"]:
            temp_streak += 1
            best_streak = max(best_streak, temp_streak)
        else:
            temp_streak = 0
    
    return {
        "success": True,
        "current_streak": current_streak,
        "best_streak": best_streak,
        "last_broken_date": last_broken_date,
        "is_perfect_today": daily_stats[0]["is_perfect"] if daily_stats and daily_stats[0]["date"] == today else None
    }


async def get_dose_history(
    user_id: str,
    medication_id: Optional[str] = None,
    limit: int = 50,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
) -> dict:
    """
    Get detailed dose history for a user.
    
    Returns chronological list of all dose events.
    """
    history = get_dose_history_collection()
    
    query = {"user_id": user_id}
    
    if medication_id:
        query["medication_id"] = medication_id
    
    if start_date or end_date:
        query["date"] = {}
        if start_date:
            query["date"]["$gte"] = start_date
        if end_date:
            query["date"]["$lte"] = end_date
    
    cursor = history.find(query).sort("scheduled_at", -1).limit(limit)
    
    history_list = []
    async for record in cursor:
        history_list.append({
            "id": str(record.get("_id")),
            "medication_id": record.get("medication_id"),
            "medication_name": record.get("medication_name"),
            "date": record.get("date"),
            "time_slot": record.get("time_slot"),
            "status": record.get("status"),
            "was_late": record.get("was_late", False),
            "actual_time": record.get("actual_time").isoformat() if record.get("actual_time") else None,
            "scheduled_at": record.get("scheduled_at").isoformat() if record.get("scheduled_at") else None,
            "notes": record.get("notes")
        })
    
    return {
        "success": True,
        "history": history_list,
        "count": len(history_list)
    }


async def get_time_of_day_analysis(user_id: str, period: str = "week") -> dict:
    """
    Analyze dose adherence by time of day.
    
    Groups doses into time periods:
    - Morning: 06:00 - 11:59
    - Afternoon: 12:00 - 17:59
    - Evening: 18:00 - 23:59
    - Night: 00:00 - 05:59
    
    Returns percentage of missed doses per time period.
    """
    history = get_dose_history_collection()
    
    today = datetime.now().date()
    if period == "week":
        start_date = today - timedelta(days=7)
    elif period == "month":
        start_date = today - timedelta(days=30)
    else:
        start_date = today - timedelta(days=365)
    
    query = {
        "user_id": user_id,
        "date": {"$gte": start_date.strftime("%Y-%m-%d")}
    }
    
    cursor = history.find(query)
    
    # Initialize time period stats
    time_periods = {
        "morning": {"label": "Morning (6AM-12PM)", "total": 0, "taken": 0, "missed": 0, "start": 6, "end": 12},
        "afternoon": {"label": "Afternoon (12PM-6PM)", "total": 0, "taken": 0, "missed": 0, "start": 12, "end": 18},
        "evening": {"label": "Evening (6PM-12AM)", "total": 0, "taken": 0, "missed": 0, "start": 18, "end": 24},
        "night": {"label": "Night (12AM-6AM)", "total": 0, "taken": 0, "missed": 0, "start": 0, "end": 6}
    }
    
    async for record in cursor:
        time_slot = record.get("time_slot", "12:00")
        try:
            hour = int(time_slot.split(":")[0])
        except (ValueError, IndexError):
            hour = 12  # Default to afternoon
        
        # Determine time period
        if 6 <= hour < 12:
            period_key = "morning"
        elif 12 <= hour < 18:
            period_key = "afternoon"
        elif 18 <= hour < 24:
            period_key = "evening"
        else:
            period_key = "night"
        
        time_periods[period_key]["total"] += 1
        if record.get("status") == "taken":
            time_periods[period_key]["taken"] += 1
        elif record.get("status") == "missed":
            time_periods[period_key]["missed"] += 1
    
    # Calculate percentages and find problem times
    results = []
    worst_period = None
    worst_miss_rate = 0
    
    for key, data in time_periods.items():
        if data["total"] > 0:
            adherence = round((data["taken"] / data["total"]) * 100, 1)
            miss_rate = round((data["missed"] / data["total"]) * 100, 1)
            
            if miss_rate > worst_miss_rate:
                worst_miss_rate = miss_rate
                worst_period = key
            
            results.append({
                "period": key,
                "label": data["label"],
                "total": data["total"],
                "taken": data["taken"],
                "missed": data["missed"],
                "adherence_percentage": adherence,
                "miss_percentage": miss_rate
            })
    
    return {
        "success": True,
        "period": period,
        "time_analysis": results,
        "worst_period": worst_period,
        "worst_miss_rate": worst_miss_rate,
        "insight": f"You tend to miss doses most in the {worst_period} ({worst_miss_rate}% miss rate)" if worst_period and worst_miss_rate > 0 else "Great job! No clear problem times."
    }


async def get_comparison_stats(user_id: str) -> dict:
    """
    Compare current week's adherence with previous week.
    
    Returns:
    - This week's stats
    - Last week's stats
    - Delta (improvement/decline)
    """
    history = get_dose_history_collection()
    
    today = datetime.now().date()
    
    # Current week: last 7 days
    current_start = today - timedelta(days=7)
    current_end = today
    
    # Previous week: 8-14 days ago
    previous_start = today - timedelta(days=14)
    previous_end = today - timedelta(days=7)
    
    async def get_period_stats(start: datetime.date, end: datetime.date) -> dict:
        cursor = history.find({
            "user_id": user_id,
            "date": {
                "$gte": start.strftime("%Y-%m-%d"),
                "$lt": end.strftime("%Y-%m-%d")
            }
        })
        
        total = 0
        taken = 0
        missed = 0
        
        async for record in cursor:
            total += 1
            if record.get("status") == "taken":
                taken += 1
            elif record.get("status") == "missed":
                missed += 1
        
        adherence = round((taken / total) * 100, 1) if total > 0 else 0
        
        return {
            "start_date": start.strftime("%Y-%m-%d"),
            "end_date": end.strftime("%Y-%m-%d"),
            "total": total,
            "taken": taken,
            "missed": missed,
            "adherence_percentage": adherence
        }
    
    current_stats = await get_period_stats(current_start, current_end)
    previous_stats = await get_period_stats(previous_start, previous_end)
    
    # Calculate delta
    if previous_stats["adherence_percentage"] > 0:
        delta = round(current_stats["adherence_percentage"] - previous_stats["adherence_percentage"], 1)
    else:
        delta = 0
    
    # Generate insight
    if delta > 5:
        trend = "improving"
        message = f"Great progress! You're up {delta}% from last week."
    elif delta < -5:
        trend = "declining"
        message = f"Your adherence dropped {abs(delta)}% from last week. Let's get back on track!"
    else:
        trend = "stable"
        message = "You're maintaining steady adherence. Keep it up!"
    
    return {
        "success": True,
        "current_week": current_stats,
        "previous_week": previous_stats,
        "delta": delta,
        "trend": trend,
        "insight": message
    }

