"""
Qwen Lab Interpreter Service
==============================
Bridges extracted lab values → Qwen inference → parsed clinical interpretations.

This is the core service that:
1. Takes extracted biomarker JSON (from Llama Parser + markdown_parser)
2. Matches each biomarker to reference data (biomarkers.json)
3. Builds Qwen-compatible prompts in the exact training format
4. Calls qwen_inference for local interpretation
5. Parses structured responses into ExtractedValue objects

Usage:
    from app.lab_interpreter.services.qwen_interpreter import QwenLabInterpreter

    interpreter = QwenLabInterpreter()
    results = await interpreter.interpret(
        extracted_values=[{"name": "Hemoglobin", "value": 10.2, "unit": "g/dL"}],
        patient_context=PatientContext(sex="male", age=55)
    )
"""

import re
import asyncio
import logging
import time
from typing import List, Dict, Any, Optional, Tuple

from ..models.interpretation import (
    ExtractedValue,
    ValueStatus,
    PatientContext,
    InterpretationResult,
    StructuredInterpretation,
)
from .reference_loader import find_biomarker_by_synonym, get_biomarker_by_id
from .unit_converter import UnitConverter
from .qwen_inference import get_qwen_service

logger = logging.getLogger(__name__)

# Initialize unit converter
_unit_converter = None


def _get_converter():
    global _unit_converter
    if _unit_converter is None:
        _unit_converter = UnitConverter()
    return _unit_converter


class QwenLabInterpreter:
    """Interprets extracted lab values using the fine-tuned Qwen model."""

    def __init__(self):
        self.qwen = get_qwen_service()

    async def interpret(
        self,
        extracted_values: List[Dict[str, Any]],
        patient_context: PatientContext,
        report_id: str = "",
    ) -> InterpretationResult:
        """
        Interpret all extracted biomarker values.

        Args:
            extracted_values: List of {name, value, unit} dicts from markdown parser
            patient_context: Patient demographics (sex, age, fasting, etc.)
            report_id: Lab report ID for tracking

        Returns:
            InterpretationResult with all interpreted values + summary
        """
        start_time = time.time()
        interpreted: List[ExtractedValue] = []
        critical_flags: List[str] = []
        abnormal_count = 0

        for raw_val in extracted_values:
            try:
                # Run synchronous Qwen inference in a thread pool
                # to avoid blocking the event loop (GGUF is CPU-bound)
                result = await asyncio.to_thread(
                    self._interpret_single, raw_val, patient_context
                )
                if result:
                    interpreted.append(result)

                    # Track abnormals and criticals
                    if result.status in (ValueStatus.HIGH, ValueStatus.LOW):
                        abnormal_count += 1
                    elif result.status in (
                        ValueStatus.CRITICAL_HIGH,
                        ValueStatus.CRITICAL_LOW,
                    ):
                        abnormal_count += 1
                        critical_flags.append(
                            f"{result.biomarker_name}: {result.status.value}"
                        )

            except Exception as e:
                logger.warning(
                    f"Failed to interpret {raw_val.get('name', '?')}: {e}"
                )
                # Still include it with unknown status
                interpreted.append(
                    ExtractedValue(
                        biomarker_name=raw_val.get("name", "Unknown"),
                        original_value=raw_val.get("value", 0),
                        original_unit=raw_val.get("unit", ""),
                        status=ValueStatus.UNKNOWN,
                        interpretation="Interpretation unavailable",
                        confidence=0.0,
                    )
                )

        # Generate summary
        summary = self._generate_summary(interpreted, patient_context)

        elapsed_ms = int((time.time() - start_time) * 1000)
        logger.info(
            f"Interpreted {len(interpreted)} biomarkers in {elapsed_ms}ms "
            f"({abnormal_count} abnormal, {len(critical_flags)} critical)"
        )

        return InterpretationResult(
            report_id=report_id,
            patient_context=patient_context,
            extracted_values=interpreted,
            summary=summary,
            abnormal_count=abnormal_count,
            critical_flags=critical_flags,
            processing_time_ms=elapsed_ms,
        )

    def _interpret_single(
        self,
        raw_val: Dict[str, Any],
        patient_context: PatientContext,
    ) -> Optional[ExtractedValue]:
        """Interpret a single biomarker value using Qwen."""
        name = raw_val.get("name", "").strip()
        value = raw_val.get("value")
        unit = raw_val.get("unit", "").strip()

        if not name or value is None:
            return None

        # ─── Step 1: Match to biomarkers.json ─────────────────────────────
        biomarker = find_biomarker_by_synonym(name)
        matched_id = biomarker.id if biomarker else None

        # ─── Step 2: Get reference range (PRIORITY: report > ABIM) ────────
        ref_range_str = ""
        crit_str = ""
        reference_unit = unit
        converted_value = value
        range_source = None  # Track where the range came from

        # 2a. Check for report-provided reference range
        report_ref = raw_val.get("reference_range")  # Structured dict from markdown_parser
        if report_ref and isinstance(report_ref, dict):
            low = report_ref.get("low")
            high = report_ref.get("high")
            ref_unit = report_ref.get("unit", "")

            if low is not None and high is not None:
                ref_range_str = f"{low}-{high}"
                if ref_unit:
                    ref_range_str += f" {ref_unit}"
                elif unit:
                    ref_range_str += f" {unit}"
                range_source = "report"
            elif high is not None:
                ref_range_str = f"<{high}"
                if ref_unit:
                    ref_range_str += f" {ref_unit}"
                range_source = "report"
            elif low is not None:
                ref_range_str = f">{low}"
                if ref_unit:
                    ref_range_str += f" {ref_unit}"
                range_source = "report"

            logger.info(
                f"Using REPORT reference range for {name}: {ref_range_str}"
            )

        # 2b. Fallback to biomarkers.json ABIM ranges
        if not ref_range_str and biomarker:
            reference_unit = biomarker.reference_unit

            # Convert units if needed
            if unit and unit != biomarker.reference_unit:
                try:
                    converter = _get_converter()
                    converted = converter.convert(
                        value, unit, biomarker.reference_unit, biomarker.id
                    )
                    if converted is not None:
                        converted_value = converted
                except Exception:
                    converted_value = value

            # Get sex/age-specific reference range
            context_dict = {
                "sex": patient_context.sex,
                "age": patient_context.age,
            }
            ref_range = biomarker.get_range_for_context(context_dict)

            if ref_range:
                # Build range string matching training format
                if hasattr(ref_range, "low") and hasattr(ref_range, "high"):
                    if ref_range.low is not None and ref_range.high is not None:
                        ref_range_str = (
                            f"{ref_range.low}-{ref_range.high} "
                            f"{biomarker.reference_unit}"
                        )
                    elif ref_range.high is not None:
                        ref_range_str = (
                            f"<{ref_range.high} {biomarker.reference_unit}"
                        )
                    elif ref_range.low is not None:
                        ref_range_str = (
                            f">{ref_range.low} {biomarker.reference_unit}"
                        )

                if ref_range_str:
                    range_source = "abim"
                    logger.info(
                        f"Using ABIM fallback reference range for {name}: {ref_range_str}"
                    )

        # 2c. Critical thresholds always come from biomarkers.json (safety)
        if biomarker and biomarker.critical_values:
            crit_parts = []
            cv = biomarker.critical_values
            if hasattr(cv, "low") and cv.low is not None:
                crit_parts.append(
                    f"Critical Low: {cv.low}"
                )
            if hasattr(cv, "high") and cv.high is not None:
                crit_parts.append(
                    f"Critical High: {cv.high}"
                )
            if crit_parts:
                crit_str = (
                    " | ".join(crit_parts)
                    + f" {biomarker.reference_unit if biomarker else unit}"
                )

        # ─── Step 3: Build Qwen prompt ────────────────────────────────────
        patient_str = self._build_patient_str(patient_context)
        test_name = biomarker.canonical_name if biomarker else name
        test_id = matched_id or name.lower().replace(" ", "_")

        prompt_lines = [
            f"Patient: {patient_str}.",
            f"Test: {test_name} ({test_id})",
            f"Result: {converted_value} {reference_unit}",
        ]
        if ref_range_str:
            prompt_lines.append(f"Reference Range: {ref_range_str}")
        if crit_str:
            prompt_lines.append(f"Critical Thresholds: {crit_str}")

        prompt = "\n".join(prompt_lines)

        # ─── Step 4: Call Qwen ────────────────────────────────────────────
        response = self.qwen.generate(prompt)

        # ─── Step 5: Parse response ───────────────────────────────────────
        status = self._parse_status(response)
        interpretation = self._parse_interpretation(response)
        structured = self._parse_structured(response)

        return ExtractedValue(
            biomarker_name=name,
            matched_id=matched_id,
            original_value=value,
            original_unit=unit,
            converted_value=converted_value if converted_value != value else None,
            reference_unit=reference_unit,
            reference_range=ref_range_str or None,
            reference_range_source=range_source,
            status=status,
            interpretation=interpretation,
            structured=structured,
            confidence=0.95 if biomarker else 0.7,
        )

    @staticmethod
    def _build_patient_str(ctx: PatientContext) -> str:
        """Build patient descriptor matching training format."""
        parts = []
        if ctx.sex and ctx.sex != "unknown":
            parts.append(ctx.sex.capitalize())
        if ctx.age:
            parts.append(f"{ctx.age} years old")
        if ctx.is_fasting:
            parts.append("Fasting")
        if ctx.is_pregnant:
            parts.append("Pregnant")
        return ", ".join(parts) if parts else "Unknown patient"

    @staticmethod
    def _parse_status(response: str) -> ValueStatus:
        """
        Parse the status from Qwen's response.
        Matches the training format: **Status:** Normal/Low/High/Critical Low/Critical High
        """
        resp_lower = response.lower()

        # Check for critical first (most specific)
        if any(
            phrase in resp_lower
            for phrase in [
                "critical high", "critically high", "critically elevated",
                "dangerously high",
            ]
        ):
            return ValueStatus.CRITICAL_HIGH

        if any(
            phrase in resp_lower
            for phrase in [
                "critical low", "critically low", "critically decreased",
                "dangerously low", "severely low",
            ]
        ):
            return ValueStatus.CRITICAL_LOW

        # Look for explicit **Status:** line
        status_match = re.search(
            r"\*\*Status:\*\*\s*(.+?)(?:\n|$)", response, re.IGNORECASE
        )
        if status_match:
            status_text = status_match.group(1).strip().lower()
            if "critical high" in status_text:
                return ValueStatus.CRITICAL_HIGH
            if "critical low" in status_text:
                return ValueStatus.CRITICAL_LOW
            if "high" in status_text or "elevated" in status_text:
                return ValueStatus.HIGH
            if "low" in status_text or "decreased" in status_text or "deficient" in status_text:
                return ValueStatus.LOW
            if "normal" in status_text or "within" in status_text:
                return ValueStatus.NORMAL

        # Fallback: check for keywords anywhere
        if any(w in resp_lower for w in ["elevated", "above normal", "above the normal", "is high", "exceeds"]):
            return ValueStatus.HIGH
        if any(w in resp_lower for w in ["below normal", "below the normal", "is low", "decreased", "deficient"]):
            return ValueStatus.LOW
        if any(w in resp_lower for w in ["normal", "within normal", "within the normal", "within the reference"]):
            return ValueStatus.NORMAL

        return ValueStatus.UNKNOWN

    @staticmethod
    def _parse_interpretation(response: str) -> str:
        """
        Parse the full interpretation text from Qwen's response.
        Returns the complete response cleaned up for display.
        """
        if not response:
            return "No interpretation available"

        # The full response IS the interpretation — clean it up
        cleaned = response.strip()

        # Ensure it's not too long for display
        if len(cleaned) > 1500:
            cleaned = cleaned[:1500] + "..."

        return cleaned

    @staticmethod
    def _parse_structured(response: str) -> Optional[StructuredInterpretation]:
        """
        Parse Qwen response into structured fields using Regex.
        
        Expected Format:
        **Analysis:** ...
        **Comparison:** ... (optional)
        **Interpretation:** ...
        **Recommendations:**
        - Rec 1
        - Rec 2
        **Conclusion:** ...
        """
        if not response:
            return None
        
        from ..models.interpretation import StructuredInterpretation
            
        try:
            # Helper to clean text (remove markdown bolding like **text**)
            def clean_text(text: str) -> str:
                if not text:
                    return ""
                # Remove ** **
                text = re.sub(r'\*\*(.*?)\*\*', r'\1', text)
                # Remove __ __
                text = re.sub(r'__(.*?)__', r'\1', text)
                # Remove leading/trailing markers
                text = re.sub(r'^\s*-\s*', '', text)
                return text.strip()

            # Helper to extract content between headers
            def extract_section(header_pattern: str, next_headers: List[str]) -> Optional[str]:
                # Pattern looks for:
                # 1. Start of line or newline
                # 2. **Header** or ## Header or Header:
                # 3. Content until next double-asterisk/hash header or end of string
                
                # Flexible header matching: **Header:**, **Header**, ## Header, Header:
                header_regex = f"(?:\\*\\*|##|\\b){header_pattern}(?:\\*\\*|:|\\s)*"
                
                # Match content until next double asterisk/hash or end
                # Lookahead for next header start or end of string
                # We use a non-greedy match (.*?)
                
                pattern = f"(?:^|\\n)\\s*{header_regex}\\s*(.*?)(?=\\n\\s*(?:\\*\\*|##)|$)"
                
                match = re.search(pattern, response, re.IGNORECASE | re.DOTALL)
                if match:
                    content = match.group(1).strip()
                    # Clean up common prefixes in content if it was a list item
                    if content.startswith("- "):
                        content = content[2:]
                    return clean_text(content)
                return None

            # 1. Analysis
            analysis = extract_section("Analysis", ["Result", "Reference Range", "Status", "Comparison"])
            
            # If Analysis contains "Result:" lines, strip them out to keep it clean
            if analysis:
                # Remove lines starting with "Result:", "Reference Range:", "Status:"
                analysis_lines = [
                    line for line in analysis.split('\n') 
                    if not any(k in line for k in ["Result:", "Reference Range:", "Status:"])
                ]
                analysis = "\n".join(analysis_lines).strip()
            
            # 2. Comparison (often merged with status or distinct)
            comparison = extract_section("Comparison", ["Status", "Interpretation"])
            if not comparison:
                # Try to extract from Status line if it has extra info
                status_match = re.search(r"\*\*Status:\*\*\s*.*?(?=\*\*|$)", response, re.IGNORECASE)
                if status_match:
                    # If status line is long, treat it as comparison
                    status_line = status_match.group(0)
                    if len(status_line) > 30:
                        comparison = clean_text(status_line.replace("**Status:**", "").strip())

            # 3. Main Interpretation
            main_interp = extract_section("Interpretation", ["Recommendations", "Conclusion"])
            
            # 4. Recommendations (List)
            recommendations = []
            recs_text = extract_section("Recommendations", ["Conclusion"])
            if recs_text:
                # Split by newline or bullet points
                lines = [line.strip() for line in recs_text.split('\n')]
                for line in lines:
                    line = clean_text(line)
                    if line.startswith("-") or line.startswith("*") or line.startswith("•"):
                        cleaned_line = line.lstrip("-*• ").strip()
                        if cleaned_line:
                            recommendations.append(cleaned_line)
                    elif line and len(line) > 5: # Valid text line
                         recommendations.append(line)

            # 5. Conclusion
            conclusion = extract_section("Conclusion", [])

            return StructuredInterpretation(
                analysis=analysis,
                comparison=comparison,
                main_interpretation=main_interp,
                recommendations=recommendations,
                conclusion=conclusion
            )

        except Exception as e:
            logger.error(f"Failed to parse structured interpretation: {e}")
            return None

    def _generate_summary(
        self,
        values: List[ExtractedValue],
        ctx: PatientContext,
    ) -> str:
        """Generate an overall summary of all interpreted values."""
        if not values:
            return "No biomarkers were extracted from the lab report."

        normal = sum(1 for v in values if v.status == ValueStatus.NORMAL)
        low = sum(1 for v in values if v.status == ValueStatus.LOW)
        high = sum(1 for v in values if v.status == ValueStatus.HIGH)
        crit_low = sum(1 for v in values if v.status == ValueStatus.CRITICAL_LOW)
        crit_high = sum(1 for v in values if v.status == ValueStatus.CRITICAL_HIGH)
        unknown = sum(1 for v in values if v.status == ValueStatus.UNKNOWN)
        total = len(values)

        lines = [f"Analyzed {total} biomarker(s)."]

        if normal > 0:
            lines.append(f"✅ {normal} within normal range.")
        if low > 0:
            low_names = [v.biomarker_name for v in values if v.status == ValueStatus.LOW]
            lines.append(f"⬇️ {low} below normal: {', '.join(low_names)}.")
        if high > 0:
            high_names = [v.biomarker_name for v in values if v.status == ValueStatus.HIGH]
            lines.append(f"⬆️ {high} above normal: {', '.join(high_names)}.")
        if crit_low > 0:
            names = [v.biomarker_name for v in values if v.status == ValueStatus.CRITICAL_LOW]
            lines.append(f"🔴 {crit_low} CRITICALLY LOW: {', '.join(names)}.")
        if crit_high > 0:
            names = [v.biomarker_name for v in values if v.status == ValueStatus.CRITICAL_HIGH]
            lines.append(f"🔴 {crit_high} CRITICALLY HIGH: {', '.join(names)}.")
        if unknown > 0:
            lines.append(f"❓ {unknown} could not be classified.")

        return " ".join(lines)
