"""
Background Task Scheduler using APScheduler
Handles recurring notification checks for:
- Profile completion reminders (every hour)
- Medication dose reminders (every 30 minutes)
- Appointment reminders (daily at 9 AM)
- Low stock alerts (daily at 10 AM)
- Health check-ins (daily at 8 AM, if enabled)
"""
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger
from datetime import datetime, timedelta
from typing import List
from bson import ObjectId
from ..core.database import get_users_collection, get_medications_collection, get_appointments_collection
from . import notification_service

# Global scheduler instance
scheduler: AsyncIOScheduler = None


# ==================== SCHEDULED JOBS ====================

async def check_profile_reminders():
    """
    Hourly job to check all users for profile completion reminders.
    Sends reminder if:
    - Profile is incomplete (< 100%)
    - 15 hours have passed since last reminder
    - User has profile_reminders enabled
    """
    print(f"[Scheduler] Checking profile reminders at {datetime.now()}")
    
    try:
        users = get_users_collection()
        cursor = users.find({})
        
        reminders_sent = 0
        async for user in cursor:
            user_id = str(user["_id"])
            
            # Check if should send reminder
            if notification_service.should_send_profile_reminder(user):
                try:
                    await notification_service.send_profile_completion_reminder(user_id)
                    reminders_sent += 1
                except Exception as e:
                    print(f"[Scheduler] Error sending profile reminder to {user_id}: {e}")
        
        print(f"[Scheduler] Sent {reminders_sent} profile reminders")
    except Exception as e:
        print(f"❌ [Scheduler] Critical error in check_profile_reminders: {e}")


async def check_medication_reminders():
    """
    Every 30 minutes job to check for upcoming medication doses.
    Sends reminder 15 minutes before scheduled dose time.
    """
    print(f"[Scheduler] Checking medication reminders at {datetime.now()}")
    
    try:
        users = get_users_collection()
        cursor = users.find({})
        
        total_reminders = 0
        async for user in cursor:
            user_id = str(user["_id"])
            
            try:
                notifications = await notification_service.check_upcoming_doses(user_id)
                total_reminders += len(notifications)
            except Exception as e:
                print(f"[Scheduler] Error checking medication doses for {user_id}: {e}")
        
        print(f"[Scheduler] Sent {total_reminders} medication reminders")
    except Exception as e:
         print(f"❌ [Scheduler] Critical error in check_medication_reminders: {e}")


async def check_appointment_reminders():
    """
    Daily job at 9 AM to send 24-hour appointment reminders.
    Checks all appointments for tomorrow and sends reminders.
    """
    print(f"[Scheduler] Checking appointment reminders at {datetime.now()}")
    
    try:
        appointments = get_appointments_collection()
        users = get_users_collection()
        
        # Calculate tomorrow's date
        tomorrow = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
        tomorrow_underscore = tomorrow.replace("-", "_")
        
        # Find appointments for tomorrow
        cursor = appointments.find({
            "$or": [
                {"slotDate": tomorrow},
                {"slotDate": tomorrow_underscore}
            ],
            "cancelled": False,
            "isCompleted": False
        })
        
        reminders_sent = 0
        async for appt in cursor:
            user_id = appt.get("userId")
            
            # Check if user has appointment reminders enabled
            user = await users.find_one({"_id": ObjectId(user_id)})
            if not user:
                continue
            
            prefs = user.get("notification_preferences", notification_service.DEFAULT_NOTIFICATION_PREFERENCES)
            if not prefs.get("appointment_reminders", True):
                continue
            
            try:
                doctor_data = appt.get("docData", {})
                doctor_name = doctor_data.get("name", "your doctor")
                
                await notification_service.send_appointment_reminder(
                    user_id=user_id,
                    appointment_id=str(appt["_id"]),
                    doctor_name=doctor_name,
                    slot_date=appt.get("slotDate"),
                    slot_time=appt.get("slotTime")
                )
                reminders_sent += 1
            except Exception as e:
                print(f"[Scheduler] Error sending appointment reminder: {e}")
        
        print(f"[Scheduler] Sent {reminders_sent} appointment reminders")
    except Exception as e:
        print(f"❌ [Scheduler] Critical error in check_appointment_reminders: {e}")


async def check_low_stock_medications():
    """
    Daily job at 10 AM to check all users' medications for low stock.
    Sends alerts if days_remaining <= 7.
    """
    print(f"[Scheduler] Checking low stock medications at {datetime.now()}")
    
    try:
        users = get_users_collection()
        medications = get_medications_collection()
        cursor = users.find({})
        
        alerts_sent = 0
        async for user in cursor:
            user_id = str(user["_id"])
            
            # Check if user has low stock alerts enabled
            prefs = user.get("notification_preferences", notification_service.DEFAULT_NOTIFICATION_PREFERENCES)
            if not prefs.get("low_stock_alerts", True):
                continue
            
            # Find medications with low stock
            med_cursor = medications.find({"user_id": user_id, "is_active": True})
            
            async for med in med_cursor:
                current_stock = med.get("current_stock")
                frequency = med.get("frequency", 1)
                dose_per_intake = med.get("dose_per_intake", 1)
                
                if current_stock is not None and frequency:
                    days_remaining = current_stock // (frequency * dose_per_intake)
                    
                    # Send alert if low stock (≤ 7 days)
                    if days_remaining <= 7:
                        try:
                            await notification_service.send_low_stock_alert(
                                user_id=user_id,
                                medication_id=str(med["_id"]),
                                medication_name=med.get("name", "medication"),
                                days_remaining=days_remaining
                            )
                            alerts_sent += 1
                        except Exception as e:
                            print(f"[Scheduler] Error sending low stock alert: {e}")
        
        print(f"[Scheduler] Sent {alerts_sent} low stock alerts")
    except Exception as e:
        print(f"❌ [Scheduler] Critical error in check_low_stock_medications: {e}")


async def check_health_checkins():
    """
    Daily job at 8 AM to send health check-in notifications.
    Only sends if user has health_checkins enabled.
    Future: Track last check-in date and send based on interval.
    """
    print(f"[Scheduler] Checking health check-ins at {datetime.now()}")
    
    try:
        users = get_users_collection()
        cursor = users.find({})
        
        checkins_sent = 0
        async for user in cursor:
            user_id = str(user["_id"])
            
            # Check if user has health check-ins enabled
            prefs = user.get("notification_preferences", notification_service.DEFAULT_NOTIFICATION_PREFERENCES)
            if not prefs.get("health_checkins", False):
                continue
            
            # Future: Add logic to check last_checkin_date and interval
            # For now, send to all users with it enabled
            
            try:
                await notification_service.send_health_checkin(user_id)
                checkins_sent += 1
            except Exception as e:
                print(f"[Scheduler] Error sending health check-in: {e}")
        
        print(f"[Scheduler] Sent {checkins_sent} health check-ins")
    except Exception as e:
        print(f"❌ [Scheduler] Critical error in check_health_checkins: {e}")


# ==================== SCHEDULER MANAGEMENT ====================

def start_scheduler():
    """
    Initialize and start the APScheduler.
    Registers all scheduled jobs with their respective triggers.
    """
    global scheduler
    
    try:
        if scheduler is not None:
            print("[Scheduler] Already running")
            return
        
        scheduler = AsyncIOScheduler()
        
        # Profile completion reminders - every hour
        scheduler.add_job(
            check_profile_reminders,
            trigger=IntervalTrigger(hours=1),
            id="profile_reminders",
            name="Check profile completion reminders",
            replace_existing=True
        )
        
        # Medication reminders - every 30 minutes
        scheduler.add_job(
            check_medication_reminders,
            trigger=IntervalTrigger(minutes=30),
            id="medication_reminders",
            name="Check medication dose reminders",
            replace_existing=True
        )
        
        # Appointment reminders - daily at 9 AM
        scheduler.add_job(
            check_appointment_reminders,
            trigger=CronTrigger(hour=9, minute=0),
            id="appointment_reminders",
            name="Check appointment reminders",
            replace_existing=True
        )
        
        # Low stock alerts - daily at 10 AM
        scheduler.add_job(
            check_low_stock_medications,
            trigger=CronTrigger(hour=10, minute=0),
            id="low_stock_alerts",
            name="Check low stock medications",
            replace_existing=True
        )
        
        # Health check-ins - daily at 8 AM
        scheduler.add_job(
            check_health_checkins,
            trigger=CronTrigger(hour=8, minute=0),
            id="health_checkins",
            name="Send health check-ins",
            replace_existing=True
        )
        
        scheduler.start()
        print("✓ Notification scheduler started")
        print("  - Profile reminders: Every hour")
        print("  - Medication reminders: Every 30 minutes")
        print("  - Appointment reminders: Daily at 9 AM")
        print("  - Low stock alerts: Daily at 10 AM")
        print("  - Health check-ins: Daily at 8 AM")
        
    except Exception as e:
        print(f"❌ [Scheduler] Error starting scheduler: {e}")
        # Reset scheduler variable if start failed
        if scheduler and not scheduler.running:
            scheduler = None
        raise e  # Re-raise to be caught by main.py

def stop_scheduler():
    """Gracefully stop the scheduler."""
    global scheduler
    
    if scheduler is not None:
        scheduler.shutdown()
        scheduler = None
        print("[Scheduler] Stopped")


def add_custom_job(func, trigger, job_id, name):
    """
    Add a custom job to the scheduler.
    Extensible for future notification types.
    
    Args:
        func: Async function to run
        trigger: APScheduler trigger (IntervalTrigger, CronTrigger, etc.)
        job_id: Unique job identifier
        name: Human-readable job name
    """
    global scheduler
    
    if scheduler is None:
        print("[Scheduler] Not started yet")
        return False
    
    scheduler.add_job(
        func,
        trigger=trigger,
        id=job_id,
        name=name,
        replace_existing=True
    )
    
    print(f"[Scheduler] Added custom job: {name}")
    return True
