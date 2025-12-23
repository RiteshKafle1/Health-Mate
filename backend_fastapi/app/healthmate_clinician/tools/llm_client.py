"""LLM client using Groq API - optimized for low latency."""
import os
from dotenv import load_dotenv
from langchain_groq import ChatGroq

load_dotenv()

# Global LLM instances
_llm_fast = None  # For response generation
_llm_routing = None  # For planner (if needed, but we use keyword routing now)


def get_llm():
    """Get the fast Groq LLM instance for response generation."""
    global _llm_fast
    if _llm_fast is None:
        api_key = os.getenv("GROQ_API_KEY")
        if not api_key:
            print("Warning: GROQ_API_KEY not found in environment variables")
            return None
        
        # Using llama-3.1-8b-instant for fastest response times
        # Groq's 8B model is 3-5x faster than 70B with good quality
        _llm_fast = ChatGroq(
            api_key=api_key,
            model_name="openai/gpt-oss-120b",
            temperature=0.3,
            max_tokens=1024,  # Reduced from 2048 for faster responses
        )
    return _llm_fast


def get_llm_large():
    """Get the larger LLM for complex tasks (optional fallback)."""
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        return None
    
    return ChatGroq(
        api_key=api_key,
        model_name="llama-3.3-70b-versatile",
        temperature=0.3,
        max_tokens=1024,
    )
