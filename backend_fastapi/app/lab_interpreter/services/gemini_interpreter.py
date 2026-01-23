"""
Gemini Lab Interpreter
======================
Main service for interpreting lab reports using Gemini Vision API.
"""

import json
import time
import httpx
import base64
from typing import Optional, Dict, Any, List
import google.generativeai as genai
from google.generativeai.types import HarmCategory, HarmBlockThreshold

from ..models.interpretation import (
    PatientContext,
    ExtractedValue,
    InterpretationResult,
    ValueStatus
)
from ..models.biomarker import Biomarker
from .reference_loader import (
    get_reference_data,
    get_biomarker_by_id,
    get_biomarker_id_for_name,
    find_biomarker_by_synonym
)
from .unit_converter import get_unit_converter
from .validator_agent import get_validator
from .verification_agent import get_verifier


# Gemini prompt for lab report interpretation
INTERPRETATION_PROMPT = """You are a Clinical Laboratory Specialist AI. Analyze the lab report image and extract all biomarker values.

PATIENT CONTEXT:
- Sex: {sex}
- Age: {age}
- Fasting: {fasting}

REFERENCE DATABASE (for matching biomarker names):
{reference_summary}

CRITICAL INSTRUCTIONS:
1. Extract ALL visible biomarker values from the report
2. For each value, extract:
   - Exact biomarker name as shown on report
   - Numeric value
   - Unit exactly as shown (e.g., "mg/dL", "mmol/L")
   - Unit exactly as shown (e.g., "mg/dL", "mmol/L")
3. Try to match each name to our reference database IDs
4. Extract patient demographics (age, sex) if visible

OUTPUT FORMAT (strict JSON):
{{
  "lab_name": "Name of laboratory or null",
  "report_date": "YYYY-MM-DD or null",
  "patient_info": {{
    "sex": "male|female|unknown",
    "age": 45 (integer or null),
    "is_fasting": true|false|null (infer from 'Fasting Glucose' etc if needed)
  }},
  "extracted_values": [
    {{
      "biomarker_name": "exact name from report",
      "matched_id": "ID from reference database or null if unknown",
      "value": 14.2,
      "unit": "g/dL"
    }}
  ],
  "notes": "Any additional observations"
}}

IMPORTANT: 
- Return ONLY valid JSON, no markdown or explanation
- Use null for missing/unknown values
- Include ALL values visible on the report
"""


class LabInterpreter:
    """
    Main service for interpreting lab reports using Gemini Vision.
    
    Flow:
    1. Fetch image from Cloudinary URL
    2. Call Gemini Vision to extract values
    3. Convert units to reference standard
    4. Calculate status (normal/low/high)
    5. Generate interpretation
    """
    
    def __init__(self, api_key: str):
        self.api_key = api_key
        genai.configure(api_key=api_key)
        self.model = genai.GenerativeModel('gemini-2.5-flash')
        self.unit_converter = get_unit_converter()
        self._reference_data = None
    
    @property
    def reference_data(self):
        """Lazy load reference data."""
        if self._reference_data is None:
            self._reference_data = get_reference_data()
        return self._reference_data
    
    async def interpret_report(
        self,
        report_url: str,
        patient_context: PatientContext,
        report_id: str
    ) -> InterpretationResult:
        """
        Interpret a lab report from Cloudinary URL.
        
        Args:
            report_url: Cloudinary secure URL of the report image/PDF
            patient_context: Patient context for personalized interpretation
            report_id: MongoDB report ID for tracking
            
        Returns:
            InterpretationResult with all extracted and analyzed values
        """
        start_time = time.time()
        
        # Step 1: Fetch image from Cloudinary
        image_data, mime_type = await self._fetch_image(report_url)
        
        # Step 1.5: Verify image is potential lab report
        verifier = get_verifier(self.api_key)
        verification = await verifier.verify(image_data, mime_type)
        
        if not verification.is_valid:
            raise ValueError(f"Invalid lab report: {verification.rejection_reason or 'Image does not appear to be a medical lab report'}")
            
        # Step 2: Build prompt with reference summary
        prompt = self._build_prompt(patient_context)
        
        # Step 3: Call Gemini Vision API
        raw_response = await self._call_gemini(prompt, image_data, mime_type)
        
        # Step 4: Parse response
        extracted = self._parse_gemini_response(raw_response)
        
        # Step 4.5: Update patient context with extracted info
        extracted_info = extracted.get("patient_info", {})
        
        # Merge extracted info into context (extracted takes precedence if request context is empty/unknown)
        effective_context = patient_context.copy()
        
        if extracted_info.get("sex") and (effective_context.sex == "unknown" or not effective_context.sex):
            effective_context.sex = extracted_info.get("sex").lower()
            
        if extracted_info.get("age") and not effective_context.age:
            try:
                effective_context.age = int(extracted_info.get("age"))
            except:
                pass
                
        if extracted_info.get("is_fasting") is not None and not effective_context.is_fasting:
            effective_context.is_fasting = bool(extracted_info.get("is_fasting"))

        # Step 5: Process each value - convert units and calculate status
        processed_values = self._process_extracted_values(
            extracted.get("extracted_values", []),
            effective_context
        )
        
        # Step 6: Validate interpretation
        validator = get_validator(self.api_key)
        validation_report = await validator.validate(processed_values, patient_context)
        
        # Step 7: Generate summary
        abnormal = [v for v in processed_values if v.status != ValueStatus.NORMAL and v.status != ValueStatus.UNKNOWN]
        critical = [v for v in processed_values if v.status in [ValueStatus.CRITICAL_LOW, ValueStatus.CRITICAL_HIGH]]
        
        summary = self._generate_summary(processed_values, abnormal, critical)
        critical_flags = [f"{v.biomarker_name}: {v.status.value}" for v in critical]
        
        processing_time = int((time.time() - start_time) * 1000)
        
        # Convert validation issues to dicts for serialization
        validation_issues = [
            {
                "biomarker": issue.biomarker_name,
                "type": issue.issue_type,
                "severity": issue.severity,
                "message": issue.message
            }
            for issue in validation_report.issues
        ]
        
        return InterpretationResult(
            report_id=report_id,
            patient_context=effective_context,
            lab_name=extracted.get("lab_name"),
            report_date=extracted.get("report_date"),
            extracted_values=processed_values,
            summary=summary,
            abnormal_count=len(abnormal),
            critical_flags=critical_flags,
            processing_time_ms=processing_time,
            validation_passed=validation_report.is_valid,
            validation_confidence=validation_report.confidence,
            validation_issues=validation_issues,
            validation_notes=validation_report.validation_notes
        )
    
    async def _fetch_image(self, url: str) -> tuple[bytes, str]:
        """
        Fetch image from Cloudinary URL.
        
        Returns:
            Tuple of (image_bytes, mime_type)
        """
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(url)
            response.raise_for_status()
        
        content_type = response.headers.get("content-type", "image/jpeg")
        
        # Map content type to Gemini-compatible mime type
        mime_type = content_type.split(";")[0].strip()
        if mime_type == "application/pdf":
            mime_type = "application/pdf"
        elif not mime_type.startswith("image/"):
            mime_type = "image/jpeg"
        
        return response.content, mime_type
    
    def _build_prompt(self, context: PatientContext) -> str:
        """Build the interpretation prompt."""
        # Create a summary of reference biomarkers for matching
        reference_summary = []
        for biomarker in self.reference_data.biomarkers[:50]:  # Limit to avoid token overflow
            synonyms = ", ".join(biomarker.synonyms[:3])
            reference_summary.append(f"- {biomarker.id}: {biomarker.canonical_name} (also: {synonyms})")
        
        return INTERPRETATION_PROMPT.format(
            sex="Extract from report",
            age="Extract from report",
            fasting="Extract from report",
            reference_summary="\n".join(reference_summary)
        )
    
    async def _call_gemini(self, prompt: str, image_data: bytes, mime_type: str) -> str:
        """
        Call Gemini Vision API with the lab report image.
        
        Returns:
            Raw text response from Gemini
        """
        # Create content with image
        image_part = {
            "mime_type": mime_type,
            "data": base64.b64encode(image_data).decode("utf-8")
        }
        
        # Configure safety settings to allow medical content
        safety_settings = {
            HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT: HarmBlockThreshold.BLOCK_NONE,
            HarmCategory.HARM_CATEGORY_HARASSMENT: HarmBlockThreshold.BLOCK_NONE,
            HarmCategory.HARM_CATEGORY_HATE_SPEECH: HarmBlockThreshold.BLOCK_NONE,
            HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT: HarmBlockThreshold.BLOCK_NONE,
        }
        
        try:
            response = self.model.generate_content(
                [prompt, {"inline_data": image_part}],
                safety_settings=safety_settings,
                generation_config={
                    "temperature": 0.1,  # Low temperature for accuracy
                    "top_p": 0.95,
                    "max_output_tokens": 4096,
                }
            )
            return response.text
        except Exception as e:
            print(f"Gemini API error: {e}")
            raise RuntimeError(f"Failed to analyze lab report: {str(e)}")
    
    def _parse_gemini_response(self, response_text: str) -> Dict[str, Any]:
        """Parse JSON response from Gemini."""
        # Clean up response - remove markdown code blocks if present
        cleaned = response_text.strip()
        if cleaned.startswith("```json"):
            cleaned = cleaned[7:]
        if cleaned.startswith("```"):
            cleaned = cleaned[3:]
        if cleaned.endswith("```"):
            cleaned = cleaned[:-3]
        cleaned = cleaned.strip()
        
        try:
            return json.loads(cleaned)
        except json.JSONDecodeError as e:
            print(f"Failed to parse Gemini response: {e}")
            print(f"Response was: {response_text[:500]}")
            return {
                "lab_name": None,
                "report_date": None,
                "patient_info": {},
                "extracted_values": [],
                "notes": f"Parse error: {str(e)}"
            }
    
    def _process_extracted_values(
        self,
        raw_values: List[Dict[str, Any]],
        context: PatientContext
    ) -> List[ExtractedValue]:
        """
        Process raw extracted values - convert units and calculate status.
        """
        processed = []
        
        for raw in raw_values:
            try:
                biomarker_name = raw.get("biomarker_name", "Unknown")
                matched_id = raw.get("matched_id")
                value = raw.get("value")
                unit = raw.get("unit", "")
                
                # Skip if no value
                if value is None:
                    continue
                
                # Try to find biomarker if not matched
                if not matched_id:
                    matched_id = get_biomarker_id_for_name(biomarker_name)
                
                # Get biomarker data
                biomarker = get_biomarker_by_id(matched_id) if matched_id else None
                
                # Convert units if needed
                converted_value = value
                reference_unit = unit
                was_converted = False
                
                if biomarker and matched_id:
                    converted_value, reference_unit, was_converted = \
                        self.unit_converter.convert_to_reference_unit(
                            matched_id, value, unit
                        )
                
                # Calculate status
                status = ValueStatus.UNKNOWN
                reference_range_str = None
                interpretation = None
                
                if biomarker:
                    status, reference_range_str, interpretation = \
                        self._calculate_status(biomarker, converted_value, context)
                
                processed.append(ExtractedValue(
                    biomarker_name=biomarker_name,
                    matched_id=matched_id,
                    original_value=value,
                    original_unit=unit,
                    converted_value=converted_value if was_converted else None,
                    reference_unit=reference_unit if was_converted else None,
                    reference_range=reference_range_str,
                    status=status,
                    interpretation=interpretation,
                    confidence=1.0 if matched_id else 0.5
                ))
                
            except Exception as e:
                print(f"Error processing value {raw}: {e}")
                continue
        
        return processed
    
    def _calculate_status(
        self,
        biomarker: Biomarker,
        value: float,
        context: PatientContext
    ) -> tuple[ValueStatus, Optional[str], Optional[str]]:
        """
        Calculate status for a value compared to reference range.
        
        Returns:
            Tuple of (status, reference_range_string, interpretation)
        """
        # Find applicable reference range
        context_dict = {
            "sex": context.sex if context.sex != "unknown" else None,
            "age": context.age,
            "state": "fasting" if context.is_fasting else None
        }
        # Remove None values
        context_dict = {k: v for k, v in context_dict.items() if v is not None}
        
        ref_range = biomarker.get_range_for_context(context_dict)
        
        if not ref_range:
            return ValueStatus.UNKNOWN, None, None
        
        # Build reference range string
        low = ref_range.low
        high = ref_range.high
        range_str = None
        if low is not None and high is not None:
            range_str = f"{low}-{high}"
        elif low is not None:
            range_str = f">{low}"
        elif high is not None:
            range_str = f"<{high}"
        
        # Check critical values first
        critical = biomarker.critical_values
        if critical:
            if critical.critical_low and value < critical.critical_low:
                interp = ref_range.interpretation.low if ref_range.interpretation and ref_range.interpretation.low else "Critically low - immediate attention required"
                return ValueStatus.CRITICAL_LOW, range_str, interp
            if critical.critical_high and value > critical.critical_high:
                interp = ref_range.interpretation.high if ref_range.interpretation and ref_range.interpretation.high else "Critically high - immediate attention required"
                return ValueStatus.CRITICAL_HIGH, range_str, interp
        
        # Check normal range
        if low is not None and value < low:
            interp = ref_range.interpretation.low if ref_range.interpretation and ref_range.interpretation.low else "Below normal range"
            return ValueStatus.LOW, range_str, interp
        
        if high is not None and value > high:
            interp = ref_range.interpretation.high if ref_range.interpretation and ref_range.interpretation.high else "Above normal range"
            return ValueStatus.HIGH, range_str, interp
        
        return ValueStatus.NORMAL, range_str, "Within normal limits"
    
    def _generate_summary(
        self,
        all_values: List[ExtractedValue],
        abnormal: List[ExtractedValue],
        critical: List[ExtractedValue]
    ) -> str:
        """Generate a summary of the interpretation."""
        total = len(all_values)
        normal_count = total - len(abnormal)
        
        if not all_values:
            return "No biomarker values could be extracted from the report."
        
        if critical:
            critical_names = ", ".join([v.biomarker_name for v in critical])
            return f"⚠️ CRITICAL: {len(critical)} value(s) require immediate attention ({critical_names}). {len(abnormal)} total abnormal out of {total} tests."
        
        if abnormal:
            abnormal_names = ", ".join([v.biomarker_name for v in abnormal[:3]])
            more = f" and {len(abnormal) - 3} more" if len(abnormal) > 3 else ""
            return f"{len(abnormal)} abnormal value(s) found ({abnormal_names}{more}). {normal_count} of {total} tests within normal limits."
        
        return f"All {total} extracted values are within normal limits. No concerning findings."


# Singleton instance
_interpreter: Optional[LabInterpreter] = None


def get_lab_interpreter(api_key: str) -> LabInterpreter:
    """Get or create the LabInterpreter instance."""
    global _interpreter
    if _interpreter is None:
        _interpreter = LabInterpreter(api_key)
    return _interpreter
