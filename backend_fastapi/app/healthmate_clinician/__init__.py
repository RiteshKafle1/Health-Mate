"""
MediGenius Medical Chatbot Module

This module provides AI-powered medical chat functionality using:
- LangGraph multi-agent workflow
- ChromaDB vector store for RAG
- Groq LLM for inference
"""

from .chatbot_manager import ChatbotManager

__all__ = ["ChatbotManager"]
