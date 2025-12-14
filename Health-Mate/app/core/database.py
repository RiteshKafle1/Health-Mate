from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
import os
import logging

load_dotenv()

#database connection

MONGO_URI = os.getenv("MONGO_URI")

client: AsyncIOMotorClient = None
db = None


async def connect_to_mongo():
    global client, db
    try:
        client = AsyncIOMotorClient(
            MONGO_URI,
            serverSelectionTimeoutMS=5000  # fail fast
        )

        db = client["health_mate_db"]
        logging.info("✅ MongoDB connected successfully")

    except Exception as e:
        logging.error("❌ MongoDB connection failed")
        raise e


async def close_mongo_connection():
    if client:
        client.close()
        logging.info("🛑 MongoDB connection closed")
