"""Doctor routes package."""
from .routes import router as doctor_router
from .chatbot import router as doctor_chatbot_router

__all__ = ["doctor_router", "doctor_chatbot_router"]
