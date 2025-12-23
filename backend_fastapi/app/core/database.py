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
