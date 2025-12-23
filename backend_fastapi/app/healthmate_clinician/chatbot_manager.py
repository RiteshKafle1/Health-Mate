"""Chatbot manager - main entry point for the chatbot functionality."""
import os
import uuid
from datetime import datetime
from typing import Dict, Any, Optional, List

from .core.langgraph_workflow import create_workflow
from .core.state import initialize_conversation_state, reset_query_state
from .tools.pdf_loader import process_pdf
from .tools.vector_store import get_or_create_vectorstore
from .database import ChatDatabase


class ChatbotManager:
    """Manages the MediGenius chatbot workflow and state."""
    
    def __init__(self, db_path: str = './chat_db/medigenius_chats.db',
                 vector_dir: str = './medical_db/',
                 pdf_path: str = './data/medical_book.pdf'):
        self.db_path = db_path
        self.vector_dir = vector_dir
        self.pdf_path = pdf_path
        self.workflow_app = None
        self.conversation_states: Dict[str, Dict[str, Any]] = {}
        self.database = ChatDatabase(db_path)
        self._initialized = False
    
    def initialize(self):
        """Initialize the chatbot system (vector store and workflow)."""
        if self._initialized:
            return
        
        print("Initializing MediGenius Chatbot System...")
        
        # Try to load existing database
        existing_db = get_or_create_vectorstore(persist_dir=self.vector_dir)
        
        if not existing_db and os.path.exists(self.pdf_path):
            print("Creating vector database from PDF...")
            doc_splits = process_pdf(self.pdf_path)
            get_or_create_vectorstore(documents=doc_splits, persist_dir=self.vector_dir)
        elif not existing_db:
            print("No vector database and no PDF found - RAG features will be limited")
        
        self.workflow_app = create_workflow()
        self._initialized = True
        print("MediGenius Chatbot Ready!")
    
    def _get_user_session_key(self, user_id: str, session_id: str) -> str:
        """Get the unique key for user+session combination."""
        return f"{user_id}:{session_id}"
    
    def process_chat(self, user_id: str, session_id: str, message: str) -> Dict[str, Any]:
        """Process a chat message and return the response."""
        if not self._initialized:
            self.initialize()
        
        if not self.workflow_app:
            return {
                'response': 'Chatbot service is not available.',
                'source': 'System Error',
                'timestamp': datetime.now().strftime("%I:%M %p"),
                'success': False
            }
        
        # Save user message to database
        self.database.save_message(session_id, user_id, 'user', message)
        
        # Initialize or get conversation state
        state_key = self._get_user_session_key(user_id, session_id)
        if state_key not in self.conversation_states:
            self.conversation_states[state_key] = initialize_conversation_state()
        
        conversation_state = self.conversation_states[state_key]
        conversation_state = reset_query_state(conversation_state)
        conversation_state["question"] = message
        
        # Process query through workflow
        result = self.workflow_app.invoke(conversation_state)
        self.conversation_states[state_key].update(result)
        
        # Get current timestamp
        timestamp = datetime.now().strftime("%I:%M %p")
        
        # Extract response and source
        response = result.get('generation', 'Unable to generate response.')
        source = result.get('source', 'Unknown')
        
        # Save assistant response to database
        self.database.save_message(session_id, user_id, 'assistant', response, source)
        
        return {
            'response': response,
            'source': source,
            'timestamp': timestamp,
            'success': bool(result.get('generation'))
        }
    
    def get_chat_history(self, user_id: str, session_id: str) -> List[Dict[str, Any]]:
        """Get chat history for a session. Only returns if user owns the session."""
        owner = self.database.get_session_owner(session_id)
        if owner and owner != user_id:
            return []  # Not the owner
        return self.database.get_chat_history(session_id)
    
    def get_user_sessions(self, user_id: str) -> List[Dict[str, Any]]:
        """Get all chat sessions for a user."""
        return self.database.get_user_sessions(user_id)
    
    def create_new_session(self, user_id: str) -> str:
        """Create a new chat session for a user."""
        session_id = str(uuid.uuid4())
        self.database.create_session(session_id, user_id)
        return session_id
    
    def delete_session(self, user_id: str, session_id: str) -> bool:
        """Delete a chat session. Only allows deletion by owner."""
        # Also clear in-memory state
        state_key = self._get_user_session_key(user_id, session_id)
        if state_key in self.conversation_states:
            del self.conversation_states[state_key]
        
        return self.database.delete_session(session_id, user_id)
    
    def clear_memory(self, user_id: str, session_id: str):
        """Clear in-memory conversation state (doesn't delete DB history)."""
        state_key = self._get_user_session_key(user_id, session_id)
        if state_key in self.conversation_states:
            self.conversation_states[state_key] = initialize_conversation_state()
    
    def is_healthy(self) -> bool:
        """Check if the chatbot service is healthy."""
        return self._initialized and self.workflow_app is not None


# Global chatbot manager instance
_chatbot_manager: Optional[ChatbotManager] = None


def get_chatbot_manager() -> ChatbotManager:
    """Get or create the global chatbot manager instance."""
    global _chatbot_manager
    if _chatbot_manager is None:
        _chatbot_manager = ChatbotManager()
    return _chatbot_manager


def initialize_chatbot():
    """Initialize the chatbot on startup."""
    manager = get_chatbot_manager()
    manager.initialize()
