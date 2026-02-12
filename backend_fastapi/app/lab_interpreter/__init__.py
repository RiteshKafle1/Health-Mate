"""
Lab Interpreter Module
======================
AI-powered lab report interpretation using Gemini Vision.

This module provides:
- OCR and value extraction from lab report images/PDFs (EasyOCR)
- Unit conversion to standard reference units  
- Comparison against ABIM reference ranges
- Clinical interpretation and flagging of abnormal values
"""

from .routers.interpret_router import router as lab_router
from .routers.enrichment_router import router as enrich_router
from .routers.ocr_router import router as ocr_router

__all__ = ["lab_router", "enrich_router", "ocr_router"]

