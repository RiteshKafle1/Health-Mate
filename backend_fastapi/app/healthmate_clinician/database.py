"""SQLite database management for chat sessions and messages."""
import os
import sqlite3
from typing import List, Dict, Any, Optional

# Default database path
DEFAULT_DB_PATH = './chat_db/medigenius_chats.db'


class ChatDatabase:
    """Manages SQLite database for chat persistence."""
    
    def __init__(self, db_path: str = DEFAULT_DB_PATH):
        self.db_path = db_path
        self._init_db()
    
    def _init_db(self):
        """Initialize SQLite database with required tables."""
        os.makedirs(os.path.dirname(self.db_path), exist_ok=True)
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        # Create sessions table with user_id
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS sessions (
                session_id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        # Create messages table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT NOT NULL,
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                source TEXT,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (session_id) REFERENCES sessions (session_id)
            )
        ''')
        
        # Create index on user_id for faster queries
        cursor.execute('''
            CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions (user_id)
        ''')
        
        conn.commit()
        conn.close()
    
    def save_message(self, session_id: str, user_id: str, role: str, content: str, source: Optional[str] = None):
        """Save a message to the database."""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        # Ensure session exists
        cursor.execute('''
            INSERT OR IGNORE INTO sessions (session_id, user_id) VALUES (?, ?)
        ''', (session_id, user_id))
        
        # Update last active time
        cursor.execute('''
            UPDATE sessions SET last_active = CURRENT_TIMESTAMP WHERE session_id = ?
        ''', (session_id,))
        
        # Insert message
        cursor.execute('''
            INSERT INTO messages (session_id, role, content, source)
            VALUES (?, ?, ?, ?)
        ''', (session_id, role, content, source))
        
        conn.commit()
        conn.close()
    
    def get_chat_history(self, session_id: str) -> List[Dict[str, Any]]:
        """Retrieve chat history for a session."""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT role, content, source, timestamp
            FROM messages
            WHERE session_id = ?
            ORDER BY timestamp ASC
        ''', (session_id,))
        
        messages = []
        for row in cursor.fetchall():
            messages.append({
                'role': row[0],
                'content': row[1],
                'source': row[2],
                'timestamp': row[3]
            })
        
        conn.close()
        return messages
    
    def get_user_sessions(self, user_id: str) -> List[Dict[str, Any]]:
        """Get all chat sessions for a user."""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT s.session_id, s.created_at, s.last_active, 
                   (SELECT content FROM messages WHERE session_id = s.session_id 
                    AND role = 'user' ORDER BY timestamp ASC LIMIT 1) as first_message
            FROM sessions s
            WHERE s.user_id = ?
            ORDER BY s.last_active DESC
        ''', (user_id,))
        
        sessions = []
        for row in cursor.fetchall():
            sessions.append({
                'session_id': row[0],
                'created_at': row[1],
                'last_active': row[2],
                'preview': row[3][:50] + '...' if row[3] and len(row[3]) > 50 else row[3]
            })
        
        conn.close()
        return sessions
    
    def create_session(self, session_id: str, user_id: str):
        """Create a new chat session."""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute('''
            INSERT OR REPLACE INTO sessions (session_id, user_id) VALUES (?, ?)
        ''', (session_id, user_id))
        
        conn.commit()
        conn.close()
    
    def delete_session(self, session_id: str, user_id: str) -> bool:
        """Delete a chat session and its messages. Only allows deletion by owner."""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        # Verify ownership
        cursor.execute('SELECT user_id FROM sessions WHERE session_id = ?', (session_id,))
        row = cursor.fetchone()
        
        if not row or row[0] != user_id:
            conn.close()
            return False
        
        cursor.execute('DELETE FROM messages WHERE session_id = ?', (session_id,))
        cursor.execute('DELETE FROM sessions WHERE session_id = ?', (session_id,))
        
        conn.commit()
        conn.close()
        return True
    
    def get_session_owner(self, session_id: str) -> Optional[str]:
        """Get the owner user_id of a session."""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute('SELECT user_id FROM sessions WHERE session_id = ?', (session_id,))
        row = cursor.fetchone()
        
        conn.close()
        return row[0] if row else None
