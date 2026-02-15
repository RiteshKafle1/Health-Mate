"""Routers package for lab interpreter."""

from .interpret_router import router
from .ocr_router import router as ocr_router

__all__ = ["router", "ocr_router"]

