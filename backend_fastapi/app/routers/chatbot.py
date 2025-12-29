"""Chatbot router for User-only access to MediGenius medical chatbot."""
import json
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional, List, Dict, Any

from ..dependencies.auth import get_current_user
from ..services import chatbot_service

router = APIRouter(prefix="/api/user/chatbot", tags=["Chatbot"])


# Pydantic Models
class ChatRequest(BaseModel):
    """Request model for chat messages."""
    message: str
    session_id: Optional[str] = None
    symptom_checker_mode: Optional[bool] = False
    selected_option: Optional[str] = None


class ChatResponse(BaseModel):
    """Response model for chat messages."""
    response: str
    source: str
    timestamp: str
    success: bool
    session_id: str
    # Symptom Checker Mode fields
    is_follow_up: bool = False
    options: Optional[List[str]] = None
    symptom_step: Optional[int] = None
    total_steps: Optional[int] = None


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
    
    # Create new session synchronously is fine for getting UUID
    from ..healthmate_clinician.chatbot_manager import get_chatbot_manager
    manager = get_chatbot_manager()
    session_id = manager.create_new_session(user_id)
    _user_active_sessions[user_id] = session_id
    return session_id


@router.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest, user_id: str = Depends(get_current_user)):
    """
    Send a message to the medical chatbot and get a response.
    
    Requires user authentication via 'token' header.
    Supports symptom_checker_mode for guided symptom collection.
    """
    session_id = get_or_create_session(user_id, request.session_id)
    
    # For symptom checker mode, allow empty messages when selecting options
    if not request.symptom_checker_mode:
        if not request.message or not request.message.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"success": False, "message": "Message cannot be empty"}
            )
    
    try:
        result = await chatbot_service.process_chat_message(
            user_id=user_id,
            session_id=session_id,
            message=request.message.strip() if request.message else "",
            symptom_checker_mode=request.symptom_checker_mode or False,
            selected_option=request.selected_option
        )
        
        return ChatResponse(
            response=result['response'],
            source=result['source'],
            timestamp=result['timestamp'],
            success=result['success'],
            session_id=session_id,
            is_follow_up=result.get('is_follow_up', False),
            options=result.get('options'),
            symptom_step=result.get('symptom_step'),
            total_steps=result.get('total_steps')
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"success": False, "message": f"Chat processing error: {str(e)}"}
        )


@router.post("/chat/stream")
async def chat_stream(request: ChatRequest, user_id: str = Depends(get_current_user)):
    """
    Stream chat responses using Server-Sent Events (SSE).
    
    Returns tokens as they are generated for real-time display.
    Uses text/event-stream content type.
    """
    from ..healthmate_clinician.chatbot_manager import get_chatbot_manager
    from ..healthmate_clinician.tools.llm_client import stream_llm_response
    from ..healthmate_clinician.tools.vector_store import get_vectorstore_instance
    
    session_id = get_or_create_session(user_id, request.session_id)
    
    if not request.message or not request.message.strip():
        async def error_stream():
            yield f"data: {json.dumps({'error': 'Message cannot be empty'})}\n\n"
            yield "data: [DONE]\n\n"
        return StreamingResponse(error_stream(), media_type="text/event-stream")
    
    message = request.message.strip()
    
    async def generate_stream():
        """Generate SSE stream of LLM response tokens."""
        manager = get_chatbot_manager()
        
        # First, send session info
        yield f"data: {json.dumps({'type': 'session', 'session_id': session_id})}\n\n"
        
        # Save user message
        manager.database.save_message(session_id, user_id, 'user', message)
        
        # Try to get context from RAG
        context = ""
        source = "AI Knowledge"
        
        try:
            vectorstore = get_vectorstore_instance()
            if vectorstore:
                results = vectorstore.similarity_search_with_score(message, k=3)
                relevant_docs = []
                for doc, distance in results:
                    similarity = 1 - distance if distance <= 1 else 0
                    if similarity >= 0.55:
                        relevant_docs.append(doc)
                
                if relevant_docs:
                    context = "\n\n".join([doc.page_content[:1000] for doc in relevant_docs[:2]])
                    source = "Medical Database"
        except Exception as e:
            print(f"RAG error in streaming: {e}")
        
        # Send source info
        yield f"data: {json.dumps({'type': 'source', 'source': source})}\n\n"
        
        # Build prompt - matches ExecutorAgent's MEDICAL_PROMPT_TEMPLATE with follow-up question strategy
        prompt = f"""You are HealthMate Clinician, a medical Q&A assistant using the Follow-up Question Strategy.

BEHAVIOR RULES:

1. CLARIFICATION (if needed):
   - If the question is ambiguous, ask up to TWO targeted follow-up questions
   - Each question should clarify the user's intent
   - Do not ask more than two questions at once

2. ANSWERING:
   - After clarification (or if question is clear), provide a concise, evidence-based answer
   - Use the ANSWER format below
   - Include safety caveats and when to seek urgent care
   - Encourage consulting healthcare professionals for diagnosis/treatment

3. SAFETY AND TONE:
   - Use non-judgmental, empathetic language
   - Do not diagnose - present differential considerations where relevant
   - Include red flags that require urgent care

4. FORMATTING:
   - Present content clearly without special characters like asterisks
   - Use clean structure with consistent layout
   - Reference the source: {source}

---

ANSWER FORMAT (use when providing final answer):

SUMMARY
[1-3 sentences describing the main point]

WHAT TO DO NOW
[Practical steps: when to seek care, home care tips, what to monitor]

RED FLAGS
[Urgent warning signs and actions - call emergency if present]

POSSIBLE CONSIDERATIONS
[Likely possibilities to discuss with your doctor - NOT a diagnosis]

---

PATIENT'S CURRENT QUESTION: {message}

REFERENCE INFORMATION:
{context if context else "No specific reference available."}

YOUR RESPONSE (follow the rules above):"""
        
        # Stream the response
        full_response = ""
        async for token in stream_llm_response(prompt):
            full_response += token
            yield f"data: {json.dumps({'type': 'token', 'content': token})}\n\n"
        
        # Save assistant response
        manager.database.save_message(session_id, user_id, 'assistant', full_response, source)
        
        # Send completion signal
        yield f"data: {json.dumps({'type': 'done', 'source': source})}\n\n"
        yield "data: [DONE]\n\n"
    
    return StreamingResponse(
        generate_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
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
    
    messages = await chatbot_service.get_chat_history(user_id, session_id)
    return HistoryResponse(messages=messages, success=True)


@router.get("/sessions", response_model=SessionListResponse)
async def get_sessions(user_id: str = Depends(get_current_user)):
    """
    Get all chat sessions for the authenticated user.
    
    Requires user authentication via 'token' header.
    """
    sessions = await chatbot_service.get_user_sessions(user_id)
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
    messages = await chatbot_service.get_chat_history(user_id, session_id)
    
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
    Only the session owner can delete their session.
    """
    success = await chatbot_service.delete_session(user_id, session_id)
    
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
    session_id = await chatbot_service.create_new_session(user_id)
    _user_active_sessions[user_id] = session_id
    
    return GenericResponse(
        message='New chat created',
        session_id=session_id,
        success=True
    )


@router.post("/clear", response_model=GenericResponse)
async def clear(user_id: str = Depends(get_current_user)):
    """
    Clear current conversation memory (doesn't delete from database).
    
    Requires user authentication via 'token' header.
    """
    session_id = _user_active_sessions.get(user_id)
    if session_id:
        await chatbot_service.clear_session_memory(user_id, session_id)
    
    return GenericResponse(message='Conversation cleared', success=True)


@router.get("/health")
async def health(user_id: str = Depends(get_current_user)):
    """
    Check chatbot service health.
    
    Requires user authentication via 'token' header.
    """
    return await chatbot_service.get_chatbot_health()
