"""
OCR Router for Lab Report Text Extraction
==========================================
API endpoints for extracting text and biomarker data from lab report images.
"""

import os
import tempfile
import logging
from typing import Optional
from fastapi import APIRouter, UploadFile, File, HTTPException, Query
from pydantic import BaseModel
from typing import List, Dict, Any

from ..services.ocr_service import get_ocr_service, OCRExtractionResult, ExtractedBiomarker

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ocr", tags=["Lab Report OCR"])


# ============================================================================
# Response Models
# ============================================================================

class BiomarkerResponse(BaseModel):
    """Biomarker data extracted from OCR"""
    name: str
    value: float
    unit: str
    confidence: float
    raw_text: str
    reference_range: Optional[str] = None


class OCRResponse(BaseModel):
    """OCR extraction response"""
    success: bool
    biomarkers: List[BiomarkerResponse]
    biomarker_count: int
    raw_text: str
    processing_time_ms: float
    error_message: Optional[str] = None


class OCRStatusResponse(BaseModel):
    """OCR service status"""
    status: str
    easyocr_available: bool
    models_loaded: bool
    supported_formats: List[str]


# ============================================================================
# Endpoints
# ============================================================================

@router.get("/status", response_model=OCRStatusResponse)
async def get_ocr_status():
    """
    Check OCR service status and availability.
    
    Returns whether EasyOCR is available and models are loaded.
    """
    try:
        # Check if easyocr is importable
        import easyocr
        easyocr_available = True
    except ImportError:
        easyocr_available = False
    
    # Check if models are loaded (lazy loading)
    from ..services.ocr_service import _easyocr_reader
    models_loaded = _easyocr_reader is not None
    
    return OCRStatusResponse(
        status="ready" if easyocr_available else "unavailable",
        easyocr_available=easyocr_available,
        models_loaded=models_loaded,
        supported_formats=["jpg", "jpeg", "png", "bmp", "tiff", "webp"]
    )


@router.post("/extract", response_model=OCRResponse)
async def extract_from_image(
    file: UploadFile = File(..., description="Lab report image file (JPG, PNG, etc.)"),
    detail_level: int = Query(1, ge=0, le=2, description="Detail level: 0=text, 1=paragraph, 2=word")
):
    """
    Extract biomarker data from a lab report image.
    
    Uploads an image file and extracts:
    - Biomarker names (e.g., "Glucose", "Hemoglobin")
    - Values (e.g., 95.5, 14.2)
    - Units (e.g., "mg/dL", "g/dL")
    - Reference ranges if visible
    
    **Supported formats:** JPG, PNG, BMP, TIFF, WebP
    
    **Detail levels:**
    - 0: Text only (fastest)
    - 1: Paragraph mode (balanced)
    - 2: Word-level (most detailed)
    """
    # Validate file type
    allowed_extensions = {".jpg", ".jpeg", ".png", ".bmp", ".tiff", ".webp"}
    file_ext = os.path.splitext(file.filename or "")[1].lower()
    
    if file_ext not in allowed_extensions:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {file_ext}. Allowed: {', '.join(allowed_extensions)}"
        )
    
    # Save uploaded file to temp location
    try:
        with tempfile.NamedTemporaryFile(
            suffix=file_ext, 
            delete=False
        ) as tmp:
            content = await file.read()
            tmp.write(content)
            tmp_path = tmp.name
        
        logger.info(f"Processing uploaded file: {file.filename} ({len(content)} bytes)")
        
        # Run OCR extraction
        ocr_service = get_ocr_service()
        result = await ocr_service.extract_from_image(tmp_path, detail_level)
        
        # Clean up temp file
        os.unlink(tmp_path)
        
        # Convert to response
        return OCRResponse(
            success=result.success,
            biomarkers=[
                BiomarkerResponse(
                    name=bm.name,
                    value=bm.value,
                    unit=bm.unit,
                    confidence=bm.confidence,
                    raw_text=bm.raw_text,
                    reference_range=bm.reference_range
                )
                for bm in result.biomarkers
            ],
            biomarker_count=len(result.biomarkers),
            raw_text=result.raw_text,
            processing_time_ms=result.processing_time_ms,
            error_message=result.error_message
        )
        
    except Exception as e:
        logger.exception(f"OCR extraction failed: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"OCR extraction failed: {str(e)}"
        )


@router.post("/extract-text-only")
async def extract_text_only(
    file: UploadFile = File(..., description="Lab report image file")
) -> Dict[str, Any]:
    """
    Extract raw text from a lab report image (no biomarker parsing).
    
    Faster than full extraction, useful for:
    - Debugging OCR quality
    - Custom text processing
    - Previewing what OCR sees
    """
    allowed_extensions = {".jpg", ".jpeg", ".png", ".bmp", ".tiff", ".webp"}
    file_ext = os.path.splitext(file.filename or "")[1].lower()
    
    if file_ext not in allowed_extensions:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {file_ext}"
        )
    
    try:
        with tempfile.NamedTemporaryFile(suffix=file_ext, delete=False) as tmp:
            content = await file.read()
            tmp.write(content)
            tmp_path = tmp.name
        
        # Run OCR with detail_level=0 for raw text
        ocr_service = get_ocr_service()
        result = await ocr_service.extract_from_image(tmp_path, detail_level=0)
        
        os.unlink(tmp_path)
        
        return {
            "success": result.success,
            "text": result.raw_text,
            "processing_time_ms": result.processing_time_ms,
            "error_message": result.error_message
        }
        
    except Exception as e:
        logger.exception(f"Text extraction failed: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Text extraction failed: {str(e)}"
        )


@router.post("/warmup")
async def warmup_ocr_models() -> Dict[str, str]:
    """
    Pre-load OCR models to reduce first-request latency.
    
    Call this endpoint at application startup or before first OCR request
    to avoid the initial model download/load delay (~10-30 seconds).
    """
    try:
        from ..services.ocr_service import _get_reader
        _get_reader()  # This triggers lazy loading
        return {"status": "ready", "message": "OCR models loaded successfully"}
    except Exception as e:
        logger.exception(f"OCR warmup failed: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"OCR warmup failed: {str(e)}"
        )
