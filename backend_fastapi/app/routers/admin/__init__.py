"""Admin routes package."""
from .routes import router as admin_router
from .chatbot import router as admin_chatbot_router

__all__ = ["admin_router", "admin_chatbot_router"]
