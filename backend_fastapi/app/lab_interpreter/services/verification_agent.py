"""
Lab Report Verification Agent
=============================
An agent that screens uploaded images to ensure they are valid medical lab reports.

This agent prevents processing of:
1. Non-medical images (selfies, scenery, etc.)
2. Medical images that aren't reports (X-rays, MRI scans)
3. Hand-written notes or prescriptions (unless part of a printed report)
"""

import json
import logging
import base64
from typing import Dict, Any, Tuple
from dataclasses import dataclass

import google.generativeai as genai
from google.generativeai.types import HarmCategory, HarmBlockThreshold

logger = logging.getLogger(__name__)

VERIFICATION_PROMPT = """You are a Medical Document Screener.
Analyze this image to determine if it is a valid medical laboratory report (blood test, urinalysis, pathology, etc.).

VALID documents include:
- Digital or scanned lab result tables
- Blood test reports (CBC, Lipid Panel, etc.)
- Pathology or microbiology reports
- Clinical test summaries with numeric values
- Photos of printed lab reports

INVALID documents include:
- Selfies, portraits, or group photos
- Scenery, objects, or random photos
- X-rays, MRI, CT scans, or ultrasounds (we only interpret text reports)
- Hand-written prescriptions or notes (unless accompanied by a printed report)
- Insurance cards or ID cards
- Blank pages

Analyze thoroughly. If the image contains a lab report but is blurry or rotated, it is still VALID.

Return STRICT JSON format:
{
    "is_valid": true/false,
    "rejection_reason": "string (null if valid)",
    "confidence": 0.0-1.0
}
"""


@dataclass
class VerificationResult:
    """Result of the verification process."""
    is_valid: bool
    rejection_reason: str = None
    confidence: float = 0.0


class VerificationAgent:
    """
    Agent for verifying if an image is a valid medical lab report.
    """
    
    def __init__(self, api_key: str):
        """
        Initialize the verification agent.
        
        Args:
            api_key: Gemini API key
        """
        if api_key:
            genai.configure(api_key=api_key)
            self.model = genai.GenerativeModel(
                'gemini-2.5-flash',
                safety_settings={
                    HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT: HarmBlockThreshold.BLOCK_NONE,
                    HarmCategory.HARM_CATEGORY_HARASSMENT: HarmBlockThreshold.BLOCK_NONE,
                    HarmCategory.HARM_CATEGORY_HATE_SPEECH: HarmBlockThreshold.BLOCK_NONE,
                    HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT: HarmBlockThreshold.BLOCK_NONE,
                }
            )
        else:
            self.model = None
            logger.warning("VerificationAgent initialized without API key. Verification will be skipped.")
    
    async def verify(self, image_data: bytes, mime_type: str) -> VerificationResult:
        """
        Verify if the provided image is a valid lab report.
        
        Args:
            image_data: Raw image bytes
            mime_type: Mime type of the image
            
        Returns:
            VerificationResult
        """
        if not self.model:
            # Skip verification if not configured
            return VerificationResult(is_valid=True, confidence=0.0)
            
        try:
            # Create content with image
            image_part = {
                "mime_type": mime_type,
                "data": base64.b64encode(image_data).decode("utf-8")
            }
            
            response = self.model.generate_content(
                [VERIFICATION_PROMPT, {"inline_data": image_part}],
                generation_config={
                    "temperature": 0.0,  # Zero temperature for determinstic classification
                    "response_mime_type": "application/json"
                }
            )
            
            # Parse response
            text = response.text.strip()
            # Clean up potentially markdown formatted JSON
            if text.startswith("```"):
                text = text.split("```")[1]
                if text.startswith("json"):
                    text = text[4:]
            
            result = json.loads(text.strip())
            
            return VerificationResult(
                is_valid=result.get("is_valid", False),
                rejection_reason=result.get("rejection_reason"),
                confidence=result.get("confidence", 0.0)
            )
            
        except Exception as e:
            logger.error(f"Verification failed: {e}")
            # Fail closed or open? For now, fail open to avoid blocking valid users on error,
            # but log the error.
            return VerificationResult(
                is_valid=True, 
                rejection_reason=f"Verification failed: {str(e)}",
                confidence=0.0
            )


# Singleton instance
_verifier: VerificationAgent = None


def get_verifier(api_key: str = None) -> VerificationAgent:
    """Get or create the verification agent singleton."""
    global _verifier
    
    if _verifier is None:
        from ...core.config import settings
        key = api_key or settings.GEMINI_API_KEY
        _verifier = VerificationAgent(api_key=key)
    
    return _verifier
