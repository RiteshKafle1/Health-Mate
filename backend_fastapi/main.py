from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.database import connect_to_mongo, close_mongo_connection
from app.core.redis import connect_to_redis, close_redis_connection
from app.core.cloudinary_config import configure_cloudinary
from app.core.config import settings

# Import routers from new domain-based structure
from app.routers.shared import auth_router
from app.routers.admin import admin_router, admin_chatbot_router
from app.routers.doctor import doctor_router, doctor_chatbot_router
from app.routers.user import (
    user_router,
    user_chatbot_router,
    medication_router,
    dose_router,
    healthmate_assist_router
)

from app.services.shared.chatbot_service import init_chatbot_service
from app.healthmate_assist.chatbot_manager import initialize_assist
from app.services import scheduler_service


app = FastAPI(
    title="Appointy API",
    description="Doctor Appointment Booking System API",
    version="1.0.0",
)

@app.on_event("startup")
async def startup_event():
    """Connect to external services on startup."""
    await connect_to_mongo()
    configure_cloudinary()
    await connect_to_redis()
    
    # Initialize MediGenius chatbot (lazy loading)
    try:
        await init_chatbot_service()
        print("MediGenius Chatbot initialized")
    except Exception as e:
        print(f"Warning: Chatbot initialization deferred: {e}")
    
    # Initialize HealthMate Assist
    try:
        initialize_assist()
    except Exception as e:
        print(f"Warning: HealthMate Assist initialization deferred: {e}")
    
    # Start notification scheduler
    try:
        scheduler_service.start_scheduler()
    except Exception as e:
        print(f"❌ Failed to start notification scheduler: {e}")
        # Continue startup even if scheduler fails
    
    print(f"Server started on PORT:{settings.PORT}")


@app.on_event("shutdown")
async def shutdown_event():
    """Close connections on shutdown."""
    # Stop notification scheduler
    scheduler_service.stop_scheduler()
    
    await close_mongo_connection()
    await close_redis_connection()


# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers - Shared
app.include_router(auth_router)  # Authentication endpoints (real-time validation)

# Include routers - Admin
app.include_router(admin_router)  # Admin management
app.include_router(admin_chatbot_router)  # MediGenius chatbot for Admin

# Include routers - Doctor
app.include_router(doctor_router)  # Doctor management
app.include_router(doctor_chatbot_router)  # MediGenius chatbot for Doctors

# Include routers - User
app.include_router(user_router)  # User management
app.include_router(user_chatbot_router)  # MediGenius chatbot for Users
app.include_router(medication_router)  # Medication management
app.include_router(dose_router)  # Dose scheduling and tracking
app.include_router(healthmate_assist_router)  # HealthMate Assist chatbot


@app.get("/")
async def root():
    """Health check endpoint."""
    return "API Working"


@app.get("/test-db")
async def test_db():
    """Test database connection."""
    from app.core.database import client
    try:
        await client.admin.command('ping')
        return "Database is connected"
    except Exception:
        return {"error": "Database is NOT connected"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=settings.PORT, reload=True)
