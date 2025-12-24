"""HealthMate Assist router - Chatbot API endpoints."""
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from typing import Optional, List, Dict, Any

from ..dependencies.auth import get_current_user
from ..healthmate_assist.chatbot_manager import get_assist_manager

router = APIRouter(prefix="/api/user/healthmate-assist", tags=["HealthMate Assist"])


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
    is_medication_flow: bool = False


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


# In-memory session tracking per user
_user_active_sessions: Dict[str, str] = {}


def get_or_create_session(user_id: str, provided_session_id: Optional[str] = None) -> str:
    """Get the active session for a user or create a new one."""
    if provided_session_id:
        return provided_session_id
    
    if user_id in _user_active_sessions:
        return _user_active_sessions[user_id]
    
    manager = get_assist_manager()
    session_id = manager.create_new_session(user_id)
    _user_active_sessions[user_id] = session_id
    return session_id


@router.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest, user_id: str = Depends(get_current_user)):
    """
    Send a message to HealthMate Assist and get a response.
    
    Requires user authentication via 'token' header.
    """
    session_id = get_or_create_session(user_id, request.session_id)
    
    if not request.message or not request.message.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"success": False, "message": "Message cannot be empty"}
        )
    
    try:
        manager = get_assist_manager()
        result = await manager.process_chat(
            user_id=user_id,
            session_id=session_id,
            message=request.message.strip()
        )
        
        return ChatResponse(
            response=result['response'],
            source=result['source'],
            timestamp=result['timestamp'],
            success=result['success'],
            session_id=session_id,
            is_medication_flow=result.get('is_medication_flow', False)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"success": False, "message": f"Chat processing error: {str(e)}"}
        )


@router.get("/history", response_model=HistoryResponse)
async def get_history(
    session_id: Optional[str] = None,
    user_id: str = Depends(get_current_user)
):
    """
    Get chat history for the current or specified session.
    
    Requires user authentication via 'token' header.
    """
    if not session_id and user_id in _user_active_sessions:
        session_id = _user_active_sessions[user_id]
    
    if not session_id:
        return HistoryResponse(messages=[], success=True)
    
    manager = get_assist_manager()
    messages = manager.get_chat_history(session_id)
    return HistoryResponse(messages=messages, success=True)


@router.get("/sessions", response_model=SessionListResponse)
async def get_sessions(user_id: str = Depends(get_current_user)):
    """
    Get all chat sessions for the authenticated user.
    
    Requires user authentication via 'token' header.
    """
    manager = get_assist_manager()
    sessions = manager.get_user_sessions(user_id)
    return SessionListResponse(
        sessions=[SessionResponse(**s) for s in sessions],
        success=True
    )


@router.get("/sessions/{session_id}")
async def load_session(session_id: str, user_id: str = Depends(get_current_user)):
    """
    Load a specific chat session.
    
    Requires user authentication via 'token' header.
    """
    manager = get_assist_manager()
    messages = manager.get_chat_history(session_id)
    
    # Update active session for this user
    _user_active_sessions[user_id] = session_id
    
    return {
        'messages': messages,
        'session_id': session_id,
        'success': True
    }


@router.delete("/sessions/{session_id}", response_model=GenericResponse)
async def delete_chat_session(session_id: str, user_id: str = Depends(get_current_user)):
    """
    Delete a chat session.
    
    Requires user authentication via 'token' header.
    """
    manager = get_assist_manager()
    success = manager.delete_session(user_id, session_id)
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"success": False, "message": "Session not found or not owned by you"}
        )
    
    # If deleted session was active, remove it
    if _user_active_sessions.get(user_id) == session_id:
        del _user_active_sessions[user_id]
    
    return GenericResponse(message='Session deleted', success=True)


@router.post("/new", response_model=GenericResponse)
async def new_chat(user_id: str = Depends(get_current_user)):
    """
    Create a new chat session.
    
    Requires user authentication via 'token' header.
    """
    manager = get_assist_manager()
    session_id = manager.create_new_session(user_id)
    _user_active_sessions[user_id] = session_id
    
    return GenericResponse(
        message='New chat created',
        session_id=session_id,
        success=True
    )


@router.get("/health")
async def health(user_id: str = Depends(get_current_user)):
    """
    Check HealthMate Assist service health.
    
    Requires user authentication via 'token' header.
    """
    manager = get_assist_manager()
    return {
        'status': 'healthy' if manager.is_healthy() else 'initializing',
        'service': 'HealthMate Assist'
    }
