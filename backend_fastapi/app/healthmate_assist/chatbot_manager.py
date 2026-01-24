"""HealthMate Assist Chatbot Manager - Main entry point."""
import uuid
from datetime import datetime
from typing import Dict, Any, Optional, List
import sqlite3
import os

from .context_provider import ContextProvider
from .gemini_client import get_gemini_client
from .conversation_flow import (
    get_flow_manager,
    ConversationIntent,
    MedicationFlowState
)
# Note: medication_service imported lazily inside methods to avoid circular import


class HealthMateAssistManager:
    """Manages the HealthMate Assist chatbot - context-aware personal assistant."""
    
    SYSTEM_PROMPT = """You are HealthMate Assist, a friendly and helpful personal health assistant. 
You help users manage their health information including medications, appointments, and general health queries.

Key behaviors:
1. Be conversational, warm, and supportive
2. Use the user's context (profile, medications, appointments) to provide personalized responses
3. When asked about medications or appointments, refer to their actual data
4. For general health questions, provide helpful but general advice and recommend consulting a doctor for specific concerns
5. Keep responses concise but informative
6. Use markdown formatting for better readability

IMPORTANT: You are NOT a medical diagnosis tool. For symptom checking and medical diagnoses, users should use HealthMate Clinician instead.

Current User Context:
{context}

Respond naturally to the user's message."""
    
    def __init__(self, db_path: str = './chat_db/healthmate_assist.db'):
        self.db_path = db_path
        self._initialized = False
        self._ensure_db()
    
    def _ensure_db(self):
        """Ensure the chat database exists."""
        os.makedirs(os.path.dirname(self.db_path), exist_ok=True)
        
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS sessions (
                session_id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                created_at TEXT NOT NULL,
                last_active TEXT NOT NULL
            )
        ''')
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT NOT NULL,
                user_id TEXT NOT NULL,
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                timestamp TEXT NOT NULL,
                FOREIGN KEY (session_id) REFERENCES sessions(session_id)
            )
        ''')
        
        conn.commit()
        conn.close()
        self._initialized = True
    
    async def process_chat(
        self,
        user_id: str,
        session_id: str,
        message: str
    ) -> Dict[str, Any]:
        """Process a chat message and return the response."""
        timestamp = datetime.now().strftime("%I:%M %p")
        
        # Get conversation flow manager
        flow_manager = get_flow_manager()
        user_state = flow_manager.get_user_state(user_id)
        
        # Check if we're in the middle of a medication flow
        if user_state["flow_state"] != MedicationFlowState.IDLE:
            return await self._handle_medication_flow(
                user_id, session_id, message, user_state, timestamp
            )
        
        # Detect intent
        intent = flow_manager.detect_intent(message)
        
        # Handle different intents
        if intent == ConversationIntent.ADD_MEDICATION:
            return await self._start_add_medication_flow(
                user_id, session_id, message, user_state, timestamp
            )
        
        elif intent == ConversationIntent.LIST_MEDICATIONS:
            return await self._handle_list_medications(
                user_id, session_id, message, timestamp
            )
        
        elif intent == ConversationIntent.DELETE_MEDICATION:
            return await self._handle_delete_intent(
                user_id, session_id, message, timestamp
            )
        
        else:
            # General query - use Gemini with context
            return await self._handle_general_query(
                user_id, session_id, message, timestamp
            )
    
    async def _start_add_medication_flow(
        self,
        user_id: str,
        session_id: str,
        message: str,
        user_state: Dict[str, Any],
        timestamp: str
    ) -> Dict[str, Any]:
        """Start the add medication conversation flow."""
        flow_manager = get_flow_manager()
        
        # Set state to awaiting name
        user_state["flow_state"] = MedicationFlowState.AWAITING_NAME
        user_state["current_medication"] = {}
        
        response = "I'll help you add a new medication. What's the **name** of the medication?"
        
        # Save messages
        self._save_message(session_id, user_id, "user", message)
        self._save_message(session_id, user_id, "assistant", response)
        
        return {
            "response": response,
            "source": "HealthMate Assist",
            "timestamp": timestamp,
            "success": True,
            "is_medication_flow": True
        }
    
    async def _handle_medication_flow(
        self,
        user_id: str,
        session_id: str,
        message: str,
        user_state: Dict[str, Any],
        timestamp: str
    ) -> Dict[str, Any]:
        """Handle ongoing medication addition flow."""
        flow_manager = get_flow_manager()
        
        response, is_complete, medication_data = flow_manager.process_add_response(
            user_id, message, user_state
        )
        
        # Save user message
        self._save_message(session_id, user_id, "user", message)
        
        if is_complete:
            # Lazy import to avoid circular dependency
            from ..services.user import medication_service
            
            # Create the medication
            result = await medication_service.create_medication(
                user_id=user_id,
                name=medication_data.get("name", "Unknown"),
                frequency=medication_data.get("frequency", 1),
                duration=medication_data.get("duration", "As needed"),
                timing=medication_data.get("timing", "As directed"),
                description=medication_data.get("description", "")
            )
            
            if result["success"]:
                response = flow_manager.format_medication_confirmation(medication_data)
            else:
                response = f"❌ Sorry, I couldn't save the medication: {result.get('message', 'Unknown error')}"
            
            # Reset state
            flow_manager.reset_user_state(user_id)
        
        # Save assistant response
        self._save_message(session_id, user_id, "assistant", response)
        
        return {
            "response": response,
            "source": "HealthMate Assist",
            "timestamp": timestamp,
            "success": True,
            "is_medication_flow": not is_complete
        }
    
    async def _handle_list_medications(
        self,
        user_id: str,
        session_id: str,
        message: str,
        timestamp: str
    ) -> Dict[str, Any]:
        """Handle request to list medications."""
        # Lazy import to avoid circular dependency
        from ..services.user import medication_service
        
        result = await medication_service.get_user_medications(user_id)
        
        if not result["success"] or not result["medications"]:
            response = "You don't have any medications recorded yet. Would you like to add one?"
        else:
            meds = result["medications"]
            response = f"📋 **Your Medications** ({len(meds)} total):\n\n"
            
            for i, med in enumerate(meds, 1):
                freq = med.get('frequency', 1)
                times_word = "time" if freq == 1 else "times"
                response += f"**{i}. {med.get('name', 'Unknown')}**\n"
                response += f"   • {freq} {times_word} daily for {med.get('duration', 'N/A')}\n"
                response += f"   • Timing: {med.get('timing', 'N/A')}\n"
                if med.get('description'):
                    response += f"   • Notes: {med.get('description')}\n"
                response += "\n"
            
            response += "Would you like to add, update, or remove a medication?"
        
        self._save_message(session_id, user_id, "user", message)
        self._save_message(session_id, user_id, "assistant", response)
        
        return {
            "response": response,
            "source": "HealthMate Assist",
            "timestamp": timestamp,
            "success": True
        }
    
    async def _handle_delete_intent(
        self,
        user_id: str,
        session_id: str,
        message: str,
        timestamp: str
    ) -> Dict[str, Any]:
        """Handle request to delete medication."""
        # Lazy import to avoid circular dependency
        from ..services.user import medication_service
        
        # For now, direct to manual deletion
        result = await medication_service.get_user_medications(user_id)
        
        if not result["success"] or not result["medications"]:
            response = "You don't have any medications to remove."
        else:
            response = "To delete a medication, please use the Medications page where you can see all your medications and remove them individually. Would you like help with anything else?"
        
        self._save_message(session_id, user_id, "user", message)
        self._save_message(session_id, user_id, "assistant", response)
        
        return {
            "response": response,
            "source": "HealthMate Assist",
            "timestamp": timestamp,
            "success": True
        }
    
    async def _handle_general_query(
        self,
        user_id: str,
        session_id: str,
        message: str,
        timestamp: str
    ) -> Dict[str, Any]:
        """Handle general queries using Gemini with context."""
        # Get user context
        context = await ContextProvider.get_context_summary(user_id)
        
        # Get chat history
        history = self.get_chat_history(session_id)
        
        # Build system prompt with context
        system_prompt = self.SYSTEM_PROMPT.format(context=context)
        
        # Get Gemini response
        gemini = get_gemini_client()
        try:
            response = gemini.generate_response(
                prompt=message,
                system_instruction=system_prompt,
                chat_history=history
            )
        except Exception as e:
            response = f"I apologize, but I'm having trouble right now. Please try again later. (Error: {str(e)})"
        
        # Save messages
        self._save_message(session_id, user_id, "user", message)
        self._save_message(session_id, user_id, "assistant", response)
        
        return {
            "response": response,
            "source": "HealthMate Assist",
            "timestamp": timestamp,
            "success": True
        }
    
    def _save_message(
        self,
        session_id: str,
        user_id: str,
        role: str,
        content: str
    ):
        """Save a message to the database."""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        timestamp = datetime.now().isoformat()
        
        # Ensure session exists
        cursor.execute(
            'INSERT OR IGNORE INTO sessions (session_id, user_id, created_at, last_active) VALUES (?, ?, ?, ?)',
            (session_id, user_id, timestamp, timestamp)
        )
        
        # Update last_active
        cursor.execute(
            'UPDATE sessions SET last_active = ? WHERE session_id = ?',
            (timestamp, session_id)
        )
        
        # Insert message
        cursor.execute(
            'INSERT INTO messages (session_id, user_id, role, content, timestamp) VALUES (?, ?, ?, ?, ?)',
            (session_id, user_id, role, content, timestamp)
        )
        
        conn.commit()
        conn.close()
    
    def get_chat_history(self, session_id: str) -> List[Dict[str, Any]]:
        """Get chat history for a session."""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute(
            'SELECT role, content, timestamp FROM messages WHERE session_id = ? ORDER BY id ASC',
            (session_id,)
        )
        
        messages = []
        for row in cursor.fetchall():
            messages.append({
                "role": row[0],
                "content": row[1],
                "timestamp": row[2]
            })
        
        conn.close()
        return messages
    
    def get_user_sessions(self, user_id: str) -> List[Dict[str, Any]]:
        """Get all chat sessions for a user."""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute(
            '''SELECT s.session_id, s.created_at, s.last_active, 
                      (SELECT content FROM messages WHERE session_id = s.session_id ORDER BY id ASC LIMIT 1) as preview
               FROM sessions s WHERE s.user_id = ? ORDER BY s.last_active DESC''',
            (user_id,)
        )
        
        sessions = []
        for row in cursor.fetchall():
            sessions.append({
                "session_id": row[0],
                "created_at": row[1],
                "last_active": row[2],
                "preview": (row[3] or "")[:50] + "..." if row[3] and len(row[3]) > 50 else row[3]
            })
        
        conn.close()
        return sessions
    
    def create_new_session(self, user_id: str) -> str:
        """Create a new chat session."""
        session_id = str(uuid.uuid4())
        
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        timestamp = datetime.now().isoformat()
        cursor.execute(
            'INSERT INTO sessions (session_id, user_id, created_at, last_active) VALUES (?, ?, ?, ?)',
            (session_id, user_id, timestamp, timestamp)
        )
        
        conn.commit()
        conn.close()
        
        return session_id
    
    def delete_session(self, user_id: str, session_id: str) -> bool:
        """Delete a chat session."""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        # Verify ownership
        cursor.execute(
            'SELECT user_id FROM sessions WHERE session_id = ?',
            (session_id,)
        )
        result = cursor.fetchone()
        
        if not result or result[0] != user_id:
            conn.close()
            return False
        
        # Delete messages
        cursor.execute('DELETE FROM messages WHERE session_id = ?', (session_id,))
        
        # Delete session
        cursor.execute('DELETE FROM sessions WHERE session_id = ?', (session_id,))
        
        conn.commit()
        conn.close()
        return True
    
    def is_healthy(self) -> bool:
        """Check if the service is healthy."""
        return self._initialized


# Global manager instance
_assist_manager: Optional[HealthMateAssistManager] = None


def get_assist_manager() -> HealthMateAssistManager:
    """Get or create the global HealthMate Assist manager."""
    global _assist_manager
    if _assist_manager is None:
        _assist_manager = HealthMateAssistManager()
    return _assist_manager


def initialize_assist():
    """Initialize HealthMate Assist on startup."""
    manager = get_assist_manager()
    print("HealthMate Assist initialized!")
