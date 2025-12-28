from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.core.database import connect_to_mongo, close_mongo_connection
from app.core.redis import connect_to_redis, close_redis_connection
from app.core.cloudinary_config import configure_cloudinary
from app.core.config import settings
from app.routers import user, doctor, admin, chatbot, chatbot_doctor, chatbot_admin, medication, healthmate_assist, dose, auth
from app.services.chatbot_service import init_chatbot_service
from app.healthmate_assist.chatbot_manager import initialize_assist


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events."""
    # Startup
    await connect_to_mongo()
    await connect_to_redis()
    configure_cloudinary()
    
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
    
    print(f"Server started on PORT:{settings.PORT}")
    yield
    # Shutdown
    await close_mongo_connection()
    await close_redis_connection()


app = FastAPI(
    title="Appointy API",
    description="Doctor Appointment Booking System API",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router)  # Authentication endpoints (real-time validation)
app.include_router(user.router)
app.include_router(doctor.router)
app.include_router(admin.router)
app.include_router(chatbot.router)  # MediGenius medical chatbot (User-only)
app.include_router(chatbot_doctor.router)  # MediGenius chatbot for Doctors
app.include_router(chatbot_admin.router)  # MediGenius chatbot for Admin
app.include_router(medication.router)  # Medication management
app.include_router(healthmate_assist.router)  # HealthMate Assist chatbot
app.include_router(dose.router)  # Dose scheduling and tracking


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
