"""Chatbot service layer for the MediGenius integration."""
from typing import Dict, Any, List
from ..healthmate_clinician.chatbot_manager import get_chatbot_manager, initialize_chatbot


async def init_chatbot_service():
    """Initialize the chatbot service during app startup."""
    initialize_chatbot()


async def process_chat_message(user_id: str, session_id: str, message: str) -> Dict[str, Any]:
    """Process a chat message and return the AI response."""
    manager = get_chatbot_manager()
    return manager.process_chat(user_id, session_id, message)


async def get_chat_history(user_id: str, session_id: str) -> List[Dict[str, Any]]:
    """Get chat history for a session."""
    manager = get_chatbot_manager()
    return manager.get_chat_history(user_id, session_id)


async def get_user_sessions(user_id: str) -> List[Dict[str, Any]]:
    """Get all chat sessions for a user."""
    manager = get_chatbot_manager()
    return manager.get_user_sessions(user_id)


async def create_new_session(user_id: str) -> str:
    """Create a new chat session for a user."""
    manager = get_chatbot_manager()
    return manager.create_new_session(user_id)


async def delete_session(user_id: str, session_id: str) -> bool:
    """Delete a chat session."""
    manager = get_chatbot_manager()
    return manager.delete_session(user_id, session_id)


async def clear_session_memory(user_id: str, session_id: str):
    """Clear in-memory conversation state for a session."""
    manager = get_chatbot_manager()
    manager.clear_memory(user_id, session_id)


async def get_chatbot_health() -> Dict[str, Any]:
    """Check chatbot service health."""
    manager = get_chatbot_manager()
    return {
        'status': 'healthy' if manager.is_healthy() else 'initializing',
        'service': 'MediGenius'
    }
