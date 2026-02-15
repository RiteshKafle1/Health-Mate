"""
OCR Service for Lab Report Extraction
======================================
Extracts biomarker names and values from lab report images using EasyOCR.

Features:
- Offline text extraction (no internet required)
- Table and structured data parsing
- Biomarker pattern recognition
- Multi-line value extraction

Usage:
    from app.lab_interpreter.services.ocr_service import get_ocr_service
    
    ocr = get_ocr_service()
    biomarkers = await ocr.extract_from_image("/path/to/lab_report.jpg")
"""

import re
import os
import logging
from typing import List, Optional, Tuple, Dict, Any
from dataclasses import dataclass, field
from pathlib import Path

logger = logging.getLogger(__name__)

# Lazy load EasyOCR to avoid startup delay
_easyocr_reader = None


def _get_reader():
    """Lazy-load EasyOCR reader (downloads models on first use)"""
    global _easyocr_reader
    if _easyocr_reader is None:
        import easyocr
        logger.info("Initializing EasyOCR reader (first load may download models)...")
        _easyocr_reader = easyocr.Reader(
            ['en'],
            gpu=False,  # Use CPU for M1 Mac compatibility
            verbose=False
        )
        logger.info("EasyOCR reader initialized successfully")
    return _easyocr_reader


@dataclass
class ExtractedBiomarker:
    """Represents a biomarker extracted from OCR"""
    name: str
    value: float
    unit: str
    confidence: float
    raw_text: str
    reference_range: Optional[str] = None
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "value": self.value,
            "unit": self.unit,
            "confidence": self.confidence,
            "raw_text": self.raw_text,
            "reference_range": self.reference_range
        }


@dataclass
class OCRExtractionResult:
    """Result of OCR extraction from a lab report"""
    biomarkers: List[ExtractedBiomarker] = field(default_factory=list)
    raw_text: str = ""
    image_path: str = ""
    success: bool = True
    error_message: Optional[str] = None
    processing_time_ms: float = 0
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "biomarkers": [b.to_dict() for b in self.biomarkers],
            "raw_text": self.raw_text,
            "success": self.success,
            "error_message": self.error_message,
            "biomarker_count": len(self.biomarkers),
            "processing_time_ms": self.processing_time_ms
        }


class OCRService:
    """
    Extract structured biomarker data from lab report images.
    
    Uses EasyOCR for text extraction and regex patterns for parsing
    biomarker names, values, and units.
    """
    
    # Common biomarker name patterns (case-insensitive)
    BIOMARKER_NAMES = [
        # Blood Sugar
        "glucose", "fasting glucose", "random glucose", "hba1c", "hemoglobin a1c",
        # Lipid Panel
        "cholesterol", "total cholesterol", "ldl", "ldl cholesterol", "hdl", "hdl cholesterol",
        "triglycerides", "vldl",
        # Complete Blood Count
        "hemoglobin", "hgb", "hematocrit", "hct", "rbc", "rbc count", "red blood cell",
        "wbc", "wbc count", "white blood cell", "platelet", "platelet count", "plt", 
        "mcv", "mch", "mchc", "rdw", "red cell distribution width",
        "packed cell volume", "pcv", "total leukocyte count", "tlc",
        "neutrophils", "segmented neutrophils", "lymphocytes", "monocytes", 
        "eosinophils", "basophils",
        # Kidney Function
        "creatinine", "bun", "urea", "egfr", "gfr", "uric acid",
        # Liver Function
        "alt", "sgpt", "ast", "sgot", "alp", "alkaline phosphatase",
        "bilirubin", "total bilirubin", "direct bilirubin", "albumin",
        "total protein", "globulin", "ggt", "gamma gt",
        # Electrolytes
        "sodium", "potassium", "chloride", "calcium", "magnesium", "phosphorus",
        # Thyroid
        "tsh", "t3", "t4", "free t3", "free t4", "ft3", "ft4",
        # Cardiac
        "troponin", "ck-mb", "bnp", "nt-probnp",
        # Iron
        "iron", "ferritin", "tibc", "transferrin",
        # Inflammation
        "crp", "c-reactive protein", "esr", "sed rate",
        # Vitamins
        "vitamin d", "vitamin b12", "folate", "folic acid",
    ]
    
    # Common units in lab reports
    UNITS = [
        r"mg/dL", r"mg/dl", r"g/dL", r"g/dl", r"gm/dL", r"gm/dl",
        r"mmol/L", r"mmol/l", r"mEq/L", r"meq/L", 
        r"U/L", r"u/L", r"IU/L", r"iu/L",
        r"ng/mL", r"ng/ml", r"pg/mL", r"pg/ml", r"mcg/dL", r"μg/dL",
        r"mIU/L", r"miu/L", r"uIU/mL", r"μIU/mL",
        r"cells/mcL", r"cells/uL", r"x10\^9/L", r"x10\^12/L",
        r"mil/mcL", r"mil/uL", r"mill/mm3", r"mill/cumm",
        r"thou/mcL", r"thou/uL", r"thou/mm3", r"thou/cumm",
        r"million/mm3", r"million/cumm", r"lacs/cumm",
        r"%", r"fL", r"fl", r"pg", r"g/L", r"sec", r"seconds",
        r"mm/hr", r"mm/hour", r"ratio", r"L", r"cumm", r"mm3"
    ]
    
    def __init__(self):
        """Initialize OCR service (reader is lazy-loaded)"""
        self._compile_patterns()
        logger.info("OCR Service initialized")
    
    def _compile_patterns(self):
        """Pre-compile regex patterns for efficiency"""
        # Pattern for biomarker + value + unit
        # Examples: "Glucose 95.5 mg/dL", "HbA1c: 6.2 %"
        biomarker_pattern = "|".join(
            re.escape(name) for name in self.BIOMARKER_NAMES
        )
        unit_pattern = "|".join(self.UNITS)
        
        self.value_pattern = re.compile(
            rf"({biomarker_pattern})\s*[:\-]?\s*(\d+\.?\d*)\s*({unit_pattern})",
            re.IGNORECASE
        )
        
        # Pattern for reference ranges like "70-100" or "(70 - 100)"
        self.range_pattern = re.compile(
            r"[\(\[]?\s*(\d+\.?\d*)\s*[-–]\s*(\d+\.?\d*)\s*[\)\]]?"
        )
    
    async def extract_from_image(
        self, 
        image_path: str,
        detail_level: int = 1
    ) -> OCRExtractionResult:
        """
        Extract biomarkers from a lab report image.
        
        Args:
            image_path: Path to the image file (JPG, PNG, PDF first page)
            detail_level: 0=text only, 1=paragraph, 2=word-level
            
        Returns:
            OCRExtractionResult with extracted biomarkers and metadata
        """
        import time
        start_time = time.time()
        
        result = OCRExtractionResult(image_path=image_path)
        
        # Validate file exists
        if not os.path.exists(image_path):
            result.success = False
            result.error_message = f"Image file not found: {image_path}"
            logger.error(result.error_message)
            return result
        
        try:
            # Get EasyOCR reader (lazy-loaded)
            reader = _get_reader()
            
            # Run OCR
            logger.info(f"Running OCR on: {image_path}")
            ocr_results = reader.readtext(
                image_path,
                detail=detail_level,
                paragraph=True
            )
            
            # Combine all text - handle variable return formats
            if detail_level == 0:
                result.raw_text = " ".join(ocr_results)
            else:
                text_parts = []
                for item in ocr_results:
                    if isinstance(item, str):
                        text_parts.append(item)
                    elif isinstance(item, (list, tuple)):
                        # Could be (bbox, text) or (bbox, text, confidence)
                        if len(item) >= 2:
                            text_parts.append(str(item[1]))
                        elif len(item) == 1:
                            text_parts.append(str(item[0]))
                result.raw_text = " ".join(text_parts)
            
            # Parse biomarkers from text
            result.biomarkers = self._parse_biomarkers(ocr_results, detail_level)
            
            # Calculate processing time
            result.processing_time_ms = (time.time() - start_time) * 1000
            
            logger.info(
                f"OCR complete: {len(result.biomarkers)} biomarkers found "
                f"in {result.processing_time_ms:.0f}ms"
            )
            
        except Exception as e:
            result.success = False
            result.error_message = f"OCR extraction failed: {str(e)}"
            logger.exception(result.error_message)
        
        return result
    
    def _parse_biomarkers(
        self, 
        ocr_results: List,
        detail_level: int
    ) -> List[ExtractedBiomarker]:
        """Parse OCR results into structured biomarker data"""
        biomarkers = []
        
        if detail_level == 0:
            # Simple text list
            full_text = " ".join(ocr_results)
            return self._extract_from_text(full_text, confidence=0.8)
        
        # Collect all text first
        all_text = []
        
        # Process each detected text region
        for item in ocr_results:
            text = ""
            confidence = 0.8
            
            if isinstance(item, str):
                text = item
            elif isinstance(item, (list, tuple)):
                if len(item) >= 3:
                    # (bbox, text, confidence)
                    text = str(item[1])
                    try:
                        confidence = float(item[2])
                    except (ValueError, TypeError):
                        confidence = 0.8
                elif len(item) >= 2:
                    # (bbox, text)
                    text = str(item[1])
                elif len(item) == 1:
                    text = str(item[0])
            
            if text:
                all_text.append(text)
                # Try to extract biomarker from this text region
                extracted = self._extract_from_text(text, confidence)
                biomarkers.extend(extracted)
        
        # Also try to extract from combined text (for multi-line values)
        combined_text = " ".join(all_text)
        combined_extracted = self._extract_from_text(combined_text, confidence=0.75)
        biomarkers.extend(combined_extracted)
        
        # Remove duplicates (same biomarker extracted multiple times)
        seen = set()
        unique_biomarkers = []
        for bm in biomarkers:
            key = (bm.name.lower(), bm.value)
            if key not in seen:
                seen.add(key)
                unique_biomarkers.append(bm)
        
        return unique_biomarkers
    
    def _extract_from_text(
        self, 
        text: str, 
        confidence: float
    ) -> List[ExtractedBiomarker]:
        """Extract biomarker data from a text string"""
        biomarkers = []
        
        # Method 1: Try strict pattern matching (biomarker + value + unit together)
        matches = self.value_pattern.finditer(text)
        for match in matches:
            name = match.group(1).strip()
            try:
                value = float(match.group(2))
            except ValueError:
                continue
            unit = match.group(3).strip()
            
            # Look for reference range nearby
            remaining_text = text[match.end():]
            range_match = self.range_pattern.search(remaining_text[:50])
            ref_range = None
            if range_match:
                ref_range = f"{range_match.group(1)}-{range_match.group(2)}"
            
            biomarkers.append(ExtractedBiomarker(
                name=self._normalize_name(name),
                value=value,
                unit=self._normalize_unit(unit),
                confidence=confidence,
                raw_text=match.group(0),
                reference_range=ref_range
            ))
        
        # Method 2: Try flexible extraction for tabular CBC reports
        # Look for known biomarker names followed by numeric values anywhere in text
        if not biomarkers:
            biomarkers.extend(self._extract_tabular_format(text, confidence))
        
        return biomarkers
    
    def _extract_tabular_format(self, text: str, confidence: float) -> List[ExtractedBiomarker]:
        """
        Extract biomarkers from tabular CBC-style reports using intelligent parsing.
        
        Strategy: OCR reads tabular data left-to-right, so names appear first,
        then all values in sequence. We find both lists and match by order.
        """
        biomarkers = []
        
        # CBC biomarker definitions - (pattern, canonical_name, unit, min, max)
        cbc_definitions = [
            (r'[Hh]em\s*o?globin(?!\s*[aA]1)', 'Hemoglobin', 'g/dL', 5, 25),
            (r'[Pp]acked\s*[Cc]ell\s*[Vv]olume', 'PCV', '%', 20, 70),
            (r'RBC\s*[Cc]ount', 'RBC Count', 'mill/mm3', 1, 10),
            (r'Mcv(?:\s|$)|MCV(?:\s|$)', 'MCV', 'fL', 50, 120),
            (r'Mch(?:\s|$)|MCH(?!\s*C)', 'MCH', 'pg', 15, 40),
            (r'MCHC', 'MCHC', 'g/dL', 25, 40),
            (r'RDW|[Rr]ed\s*[Cc]ell\s*[Dd]istribution', 'RDW', '%', 8, 25),
            (r'[Tt]otal\s*[Ll]euk[^\d]*[Cc]ount|TLC', 'TLC', 'thou/mm3', 1, 20),
            # Differential count items
            (r'[Ss]egmented\s*[Nn]eutrophil', 'Neutrophils', '%', 0, 100),
            (r'[Ll]ymphocyte(?!s\s+[Cc]ount)', 'Lymphocytes', '%', 0, 100),
            (r'[Mm]onocyte(?!s\s+[Cc]ount)', 'Monocytes', '%', 0, 100),
            (r'[Ee]osinophil(?!s\s+[Cc]ount)', 'Eosinophils', '%', 0, 100),
            (r'[Bb]asoph[il]+(?!s\s+[Cc]ount)', 'Basophils', '%', 0, 100),
            (r'[Pp]latelet\s*[Cc]?\s*ount', 'Platelet Count', 'thou/mm3', 50, 800),
        ]
        
        # Phase 1: Find all biomarker names and their positions in text
        found_markers = []
        for pattern, name, unit, min_v, max_v in cbc_definitions:
            matches = list(re.finditer(pattern, text, re.IGNORECASE))
            for m in matches:
                found_markers.append({
                    'name': name,
                    'unit': unit,
                    'min': min_v,
                    'max': max_v,
                    'pos': m.start(),
                    'match': m.group(0)
                })
        
        if not found_markers:
            return biomarkers
        
        # Sort by position
        found_markers.sort(key=lambda x: x['pos'])
        
        # Remove duplicates (keep first occurrence of each biomarker)
        seen_names = set()
        unique_markers = []
        for m in found_markers:
            if m['name'] not in seen_names:
                seen_names.add(m['name'])
                unique_markers.append(m)
        
        found_markers = unique_markers
        
        # Phase 2: Find all numeric values in the text
        # Look for values after the biomarker names section
        # The values typically start appearing after the last biomarker name
        last_marker_pos = max(m['pos'] for m in found_markers)
        values_section = text[last_marker_pos:]
        
        # Extract all decimal numbers from values section
        value_matches = re.findall(r'(\d+\.?\d*)', values_section)
        potential_values = []
        for v in value_matches:
            try:
                val = float(v)
                if val > 0:  # Skip zeros
                    potential_values.append(val)
            except ValueError:
                continue
        
        # Phase 3: Try to match values to biomarkers
        # The first values in the list should correspond to the first biomarkers
        value_idx = 0
        for marker in found_markers:
            # Find a value that fits this biomarker's expected range
            for i in range(value_idx, min(value_idx + 5, len(potential_values))):
                val = potential_values[i]
                if marker['min'] <= val <= marker['max']:
                    biomarkers.append(ExtractedBiomarker(
                        name=marker['name'],
                        value=val,
                        unit=marker['unit'],
                        confidence=confidence * 0.8,
                        raw_text=f"{marker['match']} {val}",
                        reference_range=None
                    ))
                    value_idx = i + 1  # Move past this value
                    break
        
        return biomarkers
    
    def _normalize_name(self, name: str) -> str:
        """Normalize biomarker name to canonical form"""
        name = name.strip().lower()
        
        # Common abbreviation mappings
        mappings = {
            "hgb": "Hemoglobin",
            "hct": "Hematocrit",
            "wbc": "WBC Count",
            "rbc": "RBC Count",
            "plt": "Platelet Count",
            "sgpt": "ALT",
            "sgot": "AST",
            "hba1c": "HbA1c",
            "hemoglobin a1c": "HbA1c",
            "ldl": "LDL Cholesterol",
            "hdl": "HDL Cholesterol",
            "tsh": "TSH",
            "t3": "T3 Total",
            "t4": "T4 Total",
            "ft3": "T3 Free",
            "ft4": "T4 Free",
            "crp": "C-Reactive Protein",
            "esr": "ESR",
            "sed rate": "ESR",
            "bun": "BUN",
            "gfr": "eGFR",
            "egfr": "eGFR",
            "alp": "Alkaline Phosphatase",
            "ggt": "GGT",
            "gamma gt": "GGT",
            "ck-mb": "CK-MB",
            "bnp": "BNP",
        }
        
        if name in mappings:
            return mappings[name]
        
        # Title case for others
        return name.title()
    
    def _normalize_unit(self, unit: str) -> str:
        """Normalize unit to standard form"""
        unit = unit.strip()
        
        # Common unit normalizations
        mappings = {
            "mg/dl": "mg/dL",
            "g/dl": "g/dL",
            "mmol/l": "mmol/L",
            "u/l": "U/L",
            "iu/l": "IU/L",
            "meq/l": "mEq/L",
            "ng/ml": "ng/mL",
            "pg/ml": "pg/mL",
            "miu/l": "mIU/L",
            "fl": "fL",
        }
        
        return mappings.get(unit.lower(), unit)
    
    async def extract_from_pdf(self, pdf_path: str) -> OCRExtractionResult:
        """
        Extract biomarkers from a PDF lab report.
        
        Converts first page to image and runs OCR.
        """
        import tempfile
        from pdf2image import convert_from_path
        
        try:
            # Convert first page to image
            images = convert_from_path(pdf_path, first_page=1, last_page=1)
            if not images:
                return OCRExtractionResult(
                    image_path=pdf_path,
                    success=False,
                    error_message="Could not convert PDF to image"
                )
            
            # Save to temp file
            with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as tmp:
                images[0].save(tmp.name, "JPEG")
                result = await self.extract_from_image(tmp.name)
                result.image_path = pdf_path
            
            # Clean up temp file
            os.unlink(tmp.name)
            return result
            
        except ImportError:
            return OCRExtractionResult(
                image_path=pdf_path,
                success=False,
                error_message="pdf2image not installed. Run: pip install pdf2image"
            )
        except Exception as e:
            return OCRExtractionResult(
                image_path=pdf_path,
                success=False,
                error_message=f"PDF extraction failed: {str(e)}"
            )


# Singleton instance
_ocr_service: Optional[OCRService] = None


def get_ocr_service() -> OCRService:
    """Get singleton OCR service instance"""
    global _ocr_service
    if _ocr_service is None:
        _ocr_service = OCRService()
    return _ocr_service


# ============================================================================
# CLI Testing
# ============================================================================

if __name__ == "__main__":
    import asyncio
    import sys
    
    async def test_ocr(image_path: str):
        """Test OCR extraction on an image"""
        print(f"\n🔍 Testing OCR on: {image_path}")
        print("=" * 50)
        
        service = get_ocr_service()
        result = await service.extract_from_image(image_path)
        
        if result.success:
            print(f"✅ Extraction successful!")
            print(f"⏱️  Processing time: {result.processing_time_ms:.0f}ms")
            print(f"📊 Biomarkers found: {len(result.biomarkers)}")
            print()
            
            for bm in result.biomarkers:
                print(f"  • {bm.name}: {bm.value} {bm.unit}")
                if bm.reference_range:
                    print(f"    Reference: {bm.reference_range}")
            
            print()
            print("📝 Raw text preview:")
            print(result.raw_text[:500] + "..." if len(result.raw_text) > 500 else result.raw_text)
        else:
            print(f"❌ Extraction failed: {result.error_message}")
    
    if len(sys.argv) > 1:
        asyncio.run(test_ocr(sys.argv[1]))
    else:
        print("Usage: python ocr_service.py <image_path>")
        print("Example: python ocr_service.py /path/to/lab_report.jpg")
