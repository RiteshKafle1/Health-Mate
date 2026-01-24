from motor.motor_asyncio import AsyncIOMotorClient
from .config import settings

# MongoDB client
client: AsyncIOMotorClient = None
db = None


async def connect_to_mongo():
    """Connect to MongoDB on startup."""
    global client, db
    try:
        # Fix the connection string if it has encoding issues
        mongo_uri = settings.MONGO_URI.replace(">", "")
        client = AsyncIOMotorClient(mongo_uri)
        db = client.appointy
        # Verify connection
        await client.admin.command('ping')
        print("Database Connected")
    except Exception as e:
        print(f"Database connection error: {e}")
        raise e


async def close_mongo_connection():
    """Close MongoDB connection on shutdown."""
    global client
    if client:
        client.close()
        print("Database connection closed")


def get_database():
    """Get the database instance."""
    return db


# Collection helpers
def get_users_collection():
    return db.users


def get_doctors_collection():
    return db.doctors


def get_appointments_collection():
    return db.appointments


def get_medications_collection():
    """Get medications collection."""
    return db.medications


def get_dose_schedules_collection():
    """Get dose schedules collection."""
    return db.dose_schedules


def get_dose_logs_collection():
    """Get dose logs collection."""
    return db.dose_logs


def get_reports_collection():
    """Get user reports collection."""
    return db.reports


def get_report_access_requests_collection():
    """Get report access requests collection."""
    return db.report_access_requests


def get_notifications_collection():
    """Get notifications collection."""
    return db.notifications


def get_dose_history_collection():
    """Get dose history collection for medication adherence tracking."""
    return db.dose_history


def get_ai_insights_cache_collection():
    """Get AI insights cache collection for storing generated insights."""
    return db.ai_insights_cache
