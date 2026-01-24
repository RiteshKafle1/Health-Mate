"""Chatbot router for Doctor-only access to MediGenius medical chatbot."""
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from typing import Optional, List, Dict, Any

from ...dependencies.auth import get_current_doctor
from ...services import chatbot_service

router = APIRouter(prefix="/api/doctor/chatbot", tags=["Doctor Chatbot"])


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


# In-memory session tracking per doctor
_doctor_active_sessions: Dict[str, str] = {}


def get_or_create_session(doctor_id: str, provided_session_id: Optional[str] = None) -> str:
    """Get the active session for a doctor or create a new one."""
    if provided_session_id:
        return provided_session_id
    
    if doctor_id in _doctor_active_sessions:
        return _doctor_active_sessions[doctor_id]
    
    # Create new session
    from ...healthmate_clinician.chatbot_manager import get_chatbot_manager
    manager = get_chatbot_manager()
    session_id = manager.create_new_session(doctor_id)
    _doctor_active_sessions[doctor_id] = session_id
    return session_id


@router.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest, doctor_id: str = Depends(get_current_doctor)):
    """
    Send a message to the medical chatbot and get a response.
    
    Requires doctor authentication via 'dtoken' or 'authorization' header.
    """
    session_id = get_or_create_session(doctor_id, request.session_id)
    
    if not request.message or not request.message.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"success": False, "message": "Message cannot be empty"}
        )
    
    try:
        result = await chatbot_service.process_chat_message(
            user_id=doctor_id,
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
    doctor_id: str = Depends(get_current_doctor)
):
    """
    Get chat history for the current or specified session.
    
    Requires doctor authentication via 'dtoken' or 'authorization' header.
    """
    if not session_id and doctor_id in _doctor_active_sessions:
        session_id = _doctor_active_sessions[doctor_id]
    
    if not session_id:
        return HistoryResponse(messages=[], success=True)
    
    messages = await chatbot_service.get_chat_history(doctor_id, session_id)
    return HistoryResponse(messages=messages, success=True)


@router.get("/sessions", response_model=SessionListResponse)
async def get_sessions(doctor_id: str = Depends(get_current_doctor)):
    """
    Get all chat sessions for the authenticated doctor.
    
    Requires doctor authentication via 'dtoken' or 'authorization' header.
    """
    sessions = await chatbot_service.get_user_sessions(doctor_id)
    return SessionListResponse(
        sessions=[SessionResponse(**s) for s in sessions],
        success=True
    )


@router.get("/sessions/{session_id}")
async def load_session(session_id: str, doctor_id: str = Depends(get_current_doctor)):
    """
    Load a specific chat session.
    
    Requires doctor authentication via 'dtoken' or 'authorization' header.
    """
    messages = await chatbot_service.get_chat_history(doctor_id, session_id)
    
    # Update active session for this doctor
    _doctor_active_sessions[doctor_id] = session_id
    
    return {
        'messages': messages,
        'session_id': session_id,
        'success': True
    }


@router.delete("/sessions/{session_id}", response_model=GenericResponse)
async def delete_chat_session(session_id: str, doctor_id: str = Depends(get_current_doctor)):
    """
    Delete a chat session.
    
    Requires doctor authentication via 'dtoken' or 'authorization' header.
    Only the session owner can delete their session.
    """
    success = await chatbot_service.delete_session(doctor_id, session_id)
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"success": False, "message": "Session not found or not owned by you"}
        )
    
    # If deleted session was active, remove it
    if _doctor_active_sessions.get(doctor_id) == session_id:
        del _doctor_active_sessions[doctor_id]
    
    return GenericResponse(message='Session deleted', success=True)


@router.post("/new", response_model=GenericResponse)
async def new_chat(doctor_id: str = Depends(get_current_doctor)):
    """
    Create a new chat session.
    
    Requires doctor authentication via 'dtoken' or 'authorization' header.
    """
    session_id = await chatbot_service.create_new_session(doctor_id)
    _doctor_active_sessions[doctor_id] = session_id
    
    return GenericResponse(
        message='New chat created',
        session_id=session_id,
        success=True
    )


@router.post("/clear", response_model=GenericResponse)
async def clear(doctor_id: str = Depends(get_current_doctor)):
    """
    Clear current conversation memory (doesn't delete from database).
    
    Requires doctor authentication via 'dtoken' or 'authorization' header.
    """
    session_id = _doctor_active_sessions.get(doctor_id)
    if session_id:
        await chatbot_service.clear_session_memory(doctor_id, session_id)
    
    return GenericResponse(message='Conversation cleared', success=True)


@router.get("/health")
async def health(doctor_id: str = Depends(get_current_doctor)):
    """
    Check chatbot service health.
    
    Requires doctor authentication via 'dtoken' or 'authorization' header.
    """
    return await chatbot_service.get_chatbot_health()
