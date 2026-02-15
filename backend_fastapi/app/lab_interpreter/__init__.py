"""
Lab Interpreter Module
======================
AI-powered lab report interpretation using Llama Parser + fine-tuned Qwen.

This module provides:
- OCR and value extraction from lab report images/PDFs (Llama Parser)
- Unit conversion to standard reference units  
- Comparison against ABIM reference ranges
- Clinical interpretation via fine-tuned Qwen model
"""

from .routers.interpret_router import router as lab_router
from .routers.enrichment_router import router as enrich_router
from .routers.ocr_router import router as ocr_router

__all__ = ["lab_router", "enrich_router", "ocr_router"]

