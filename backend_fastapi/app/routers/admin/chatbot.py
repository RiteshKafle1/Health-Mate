"""Chatbot router for Admin-only access to MediGenius medical chatbot."""
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from typing import Optional, List, Dict, Any

from ...dependencies.auth import get_current_admin
from ...services import chatbot_service

router = APIRouter(prefix="/api/admin/chatbot", tags=["Admin Chatbot"])

# Admin ID constant (since admin auth returns bool, not id)
ADMIN_USER_ID = "admin"


# Pydantic Models
class ChatRequest(BaseModel):
    """Request model for chat messages."""
    message: str
    session_id: Optional[str] = None


class ChatResponse(BaseModel):
    """Response model for chat messages."""
    response: str
    source: str
    timestamp: str
    success: bool
    session_id: str


class SessionResponse(BaseModel):
    """Response model for session info."""
    session_id: str
    created_at: Optional[str] = None
    last_active: Optional[str] = None
    preview: Optional[str] = None


class SessionListResponse(BaseModel):
    """Response model for list of sessions."""
    sessions: List[SessionResponse]
    success: bool


class HistoryResponse(BaseModel):
    """Response model for chat history."""
    messages: List[Dict[str, Any]]
    success: bool


class GenericResponse(BaseModel):
    """Generic response model."""
    message: str
    success: bool
    session_id: Optional[str] = None


# In-memory session tracking for admin
_admin_active_session: Optional[str] = None


def get_or_create_session(provided_session_id: Optional[str] = None) -> str:
    """Get the active session for admin or create a new one."""
    global _admin_active_session
    
    if provided_session_id:
        return provided_session_id
    
    if _admin_active_session:
        return _admin_active_session
    
    # Create new session
    from ...healthmate_clinician.chatbot_manager import get_chatbot_manager
    manager = get_chatbot_manager()
    session_id = manager.create_new_session(ADMIN_USER_ID)
    _admin_active_session = session_id
    return session_id


@router.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest, is_admin: bool = Depends(get_current_admin)):
    """
    Send a message to the medical chatbot and get a response.
    
    Requires admin authentication via 'atoken' header.
    """
    session_id = get_or_create_session(request.session_id)
    
    if not request.message or not request.message.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"success": False, "message": "Message cannot be empty"}
        )
    
    try:
        result = await chatbot_service.process_chat_message(
            user_id=ADMIN_USER_ID,
            session_id=session_id,
            message=request.message.strip()
        )
        
        return ChatResponse(
            response=result['response'],
            source=result['source'],
            timestamp=result['timestamp'],
            success=result['success'],
            session_id=session_id
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"success": False, "message": f"Chat processing error: {str(e)}"}
        )


@router.get("/history", response_model=HistoryResponse)
async def get_history(
    session_id: Optional[str] = None,
    is_admin: bool = Depends(get_current_admin)
):
    """
    Get chat history for the current or specified session.
    
    Requires admin authentication via 'atoken' header.
    """
    global _admin_active_session
    
    if not session_id and _admin_active_session:
        session_id = _admin_active_session
    
    if not session_id:
        return HistoryResponse(messages=[], success=True)
    
    messages = await chatbot_service.get_chat_history(ADMIN_USER_ID, session_id)
    return HistoryResponse(messages=messages, success=True)


@router.get("/sessions", response_model=SessionListResponse)
async def get_sessions(is_admin: bool = Depends(get_current_admin)):
    """
    Get all chat sessions for the admin.
    
    Requires admin authentication via 'atoken' header.
    """
    sessions = await chatbot_service.get_user_sessions(ADMIN_USER_ID)
    return SessionListResponse(
        sessions=[SessionResponse(**s) for s in sessions],
        success=True
    )


@router.get("/sessions/{session_id}")
async def load_session(session_id: str, is_admin: bool = Depends(get_current_admin)):
    """
    Load a specific chat session.
    
    Requires admin authentication via 'atoken' header.
    """
    global _admin_active_session
    
    messages = await chatbot_service.get_chat_history(ADMIN_USER_ID, session_id)
    
    # Update active session
    _admin_active_session = session_id
    
    return {
        'messages': messages,
        'session_id': session_id,
        'success': True
    }


@router.delete("/sessions/{session_id}", response_model=GenericResponse)
async def delete_chat_session(session_id: str, is_admin: bool = Depends(get_current_admin)):
    """
    Delete a chat session.
    
    Requires admin authentication via 'atoken' header.
    """
    global _admin_active_session
    
    success = await chatbot_service.delete_session(ADMIN_USER_ID, session_id)
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"success": False, "message": "Session not found"}
        )
    
    # If deleted session was active, clear it
    if _admin_active_session == session_id:
        _admin_active_session = None
    
    return GenericResponse(message='Session deleted', success=True)


@router.post("/new", response_model=GenericResponse)
async def new_chat(is_admin: bool = Depends(get_current_admin)):
    """
    Create a new chat session.
    
    Requires admin authentication via 'atoken' header.
    """
    global _admin_active_session
    
    session_id = await chatbot_service.create_new_session(ADMIN_USER_ID)
    _admin_active_session = session_id
    
    return GenericResponse(
        message='New chat created',
        session_id=session_id,
        success=True
    )


@router.post("/clear", response_model=GenericResponse)
async def clear(is_admin: bool = Depends(get_current_admin)):
    """
    Clear current conversation memory (doesn't delete from database).
    
    Requires admin authentication via 'atoken' header.
    """
    global _admin_active_session
    
    if _admin_active_session:
        await chatbot_service.clear_session_memory(ADMIN_USER_ID, _admin_active_session)
    
    return GenericResponse(message='Conversation cleared', success=True)


@router.get("/health")
async def health(is_admin: bool = Depends(get_current_admin)):
    """
    Check chatbot service health.
    
    Requires admin authentication via 'atoken' header.
    """
    return await chatbot_service.get_chatbot_health()
