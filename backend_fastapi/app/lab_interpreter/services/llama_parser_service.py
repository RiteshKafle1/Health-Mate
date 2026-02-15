"""
Llama Parser Service for Lab Report Extraction
================================================
Uses LlamaParse (by LlamaIndex) to extract structured markdown
from lab report images and PDFs.

This replaces Gemini Vision for the extraction step.
The markdown output is then parsed by markdown_parser.py
into structured JSON for the Qwen interpreter.

Usage:
    from app.lab_interpreter.services.llama_parser_service import get_llama_parser_service

    service = get_llama_parser_service()
    markdown = await service.extract(image_data, mime_type)
"""

import os
import logging
import tempfile
from typing import Optional
from pathlib import Path

logger = logging.getLogger(__name__)

# Lazy-loaded LlamaParse instance
_llama_parser = None


def _get_parser():
    """Lazy-load LlamaParse client (requires LLAMA_API_KEY)."""
    global _llama_parser
    if _llama_parser is None:
        try:
            from llama_parse import LlamaParse

            api_key = os.getenv("LLAMA_API_KEY", "")
            if not api_key:
                from app.core.config import settings
                api_key = getattr(settings, "LLAMA_API_KEY", "")

            if not api_key:
                raise ValueError(
                    "LLAMA_API_KEY not found in environment or settings. "
                    "Get one at https://cloud.llamaindex.ai/"
                )

            _llama_parser = LlamaParse(
                api_key=api_key,
                result_type="markdown",
                parsing_instruction=(
                    "This is a medical lab report. Extract ALL tables containing "
                    "test results. Each table row should contain: Test Name, "
                    "Result Value, Unit, and Reference Range. Preserve the exact "
                    "numeric values and units. Also extract patient information "
                    "(name, age, sex, date) from the report header if present."
                ),
                verbose=False,
            )
            logger.info("✅ LlamaParse client initialized successfully")

        except ImportError:
            raise ImportError(
                "llama-parse is not installed. "
                "Install it with: pip install llama-parse"
            )

    return _llama_parser


class LlamaParserService:
    """Service for extracting structured markdown from lab report images/PDFs."""

    def __init__(self):
        self._parser = None

    @property
    def parser(self):
        if self._parser is None:
            self._parser = _get_parser()
        return self._parser

    async def extract(self, image_data: bytes, mime_type: str) -> str:
        """
        Extract markdown from a lab report image or PDF.

        Args:
            image_data: Raw bytes of the image/PDF
            mime_type: MIME type (e.g., 'image/jpeg', 'image/png', 'application/pdf')

        Returns:
            Extracted markdown text with tables
        """
        # Determine file extension from MIME type
        ext_map = {
            "image/jpeg": ".jpg",
            "image/jpg": ".jpg",
            "image/png": ".png",
            "application/pdf": ".pdf",
            "image/webp": ".webp",
            "image/tiff": ".tiff",
        }
        ext = ext_map.get(mime_type, ".png")

        # LlamaParse requires a file path, so write to temp file
        tmp_path = None
        try:
            with tempfile.NamedTemporaryFile(
                suffix=ext, delete=False, prefix="lab_report_"
            ) as tmp:
                tmp.write(image_data)
                tmp_path = tmp.name

            logger.info(f"Sending lab report to LlamaParse ({len(image_data)} bytes, {mime_type})")

            # Parse the document
            documents = await self.parser.aload_data(tmp_path)

            if not documents:
                logger.warning("LlamaParse returned no documents")
                return ""

            # Combine all document text (multi-page reports)
            markdown = "\n\n".join(doc.text for doc in documents if doc.text)

            logger.info(
                f"✅ LlamaParse extraction complete: {len(markdown)} chars, "
                f"{len(documents)} page(s)"
            )
            return markdown

        except Exception as e:
            logger.error(f"LlamaParse extraction failed: {e}")
            raise RuntimeError(f"Failed to extract lab report: {str(e)}")

        finally:
            # Clean up temp file
            if tmp_path and os.path.exists(tmp_path):
                try:
                    os.unlink(tmp_path)
                except OSError:
                    pass

    async def extract_from_url(self, url: str) -> str:
        """
        Extract markdown from a lab report at a URL (e.g., Cloudinary).

        Args:
            url: URL of the lab report image/PDF

        Returns:
            Extracted markdown text
        """
        import httpx

        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.get(url)
            response.raise_for_status()

            # Determine MIME type from response headers or URL
            content_type = response.headers.get("content-type", "")
            if "pdf" in content_type or url.lower().endswith(".pdf"):
                mime_type = "application/pdf"
            elif "png" in content_type or url.lower().endswith(".png"):
                mime_type = "image/png"
            else:
                mime_type = "image/jpeg"

            return await self.extract(response.content, mime_type)

    @property
    def is_configured(self) -> bool:
        """Check if the service is properly configured."""
        try:
            _ = self.parser
            return True
        except (ValueError, ImportError):
            return False


# Singleton instance
_service_instance: Optional[LlamaParserService] = None


def get_llama_parser_service() -> LlamaParserService:
    """Get or create the singleton LlamaParserService instance."""
    global _service_instance
    if _service_instance is None:
        _service_instance = LlamaParserService()
    return _service_instance
