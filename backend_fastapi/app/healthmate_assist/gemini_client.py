"""Gemini client - Integration with Google Gemini 2.0 Flash API."""
import google.generativeai as genai
from typing import Optional, List, Dict, Any
import os


class GeminiClient:
    """Client for interacting with Gemini 2.0 Flash API."""
    
    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.getenv("GEMINI_API_KEY")
        self._configured = False
        self._model = None
    
    def configure(self):
        """Configure the Gemini API."""
        if self._configured:
            return
        
        if not self.api_key:
            raise ValueError("GEMINI_API_KEY not found. Please set it in your .env file.")
        
        genai.configure(api_key=self.api_key)
        self._model = genai.GenerativeModel('gemini-2.5-flash')
        self._configured = True
    
    def generate_response(
        self,
        prompt: str,
        system_instruction: Optional[str] = None,
        chat_history: Optional[List[Dict[str, str]]] = None
    ) -> str:
        """Generate a response from Gemini."""
        self.configure()
        
        # Build the full prompt with system instruction
        full_prompt = ""
        if system_instruction:
            full_prompt += f"System: {system_instruction}\n\n"
        
        # Add chat history context
        if chat_history:
            for msg in chat_history[-10:]:  # Last 10 messages for context
                role = "User" if msg.get("role") == "user" else "Assistant"
                full_prompt += f"{role}: {msg.get('content', '')}\n"
            full_prompt += "\n"
        
        full_prompt += f"User: {prompt}\n\nAssistant:"
        
        try:
            response = self._model.generate_content(full_prompt)
            return response.text.strip()
        except Exception as e:
            return f"I apologize, but I'm having trouble processing your request. Error: {str(e)}"


# Global client instance
_gemini_client: Optional[GeminiClient] = None


def get_gemini_client() -> GeminiClient:
    """Get or create the global Gemini client."""
    global _gemini_client
    if _gemini_client is None:
        _gemini_client = GeminiClient()
    return _gemini_client
