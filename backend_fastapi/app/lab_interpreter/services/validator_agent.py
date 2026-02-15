"""
Lab Interpretation Validator Agent
===================================
A second-pass validation agent that verifies the accuracy of lab interpretations.

This agent performs:
1. Value Plausibility - Are extracted values physiologically possible?
2. Unit Consistency - Do units match what's expected?
3. Range Logic - Is the calculated status correct?
4. Clinical Coherence - Do related values make sense together?
"""

import json
import logging
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass, field
from enum import Enum

from ..models.interpretation import ExtractedValue, ValueStatus, PatientContext

logger = logging.getLogger(__name__)


class ValidationResult(Enum):
    """Validation outcome categories."""
    VALID = "valid"
    CORRECTED = "corrected"
    FLAGGED = "flagged"
    INVALID = "invalid"


@dataclass
class ValidationIssue:
    """A single validation issue found."""
    biomarker_name: str
    issue_type: str  # plausibility, unit, range, coherence
    severity: str  # low, medium, high, critical
    message: str
    original_value: Any
    suggested_correction: Optional[Any] = None


@dataclass
class ValidationReport:
    """Complete validation report for an interpretation."""
    is_valid: bool
    confidence: float
    issues: List[ValidationIssue] = field(default_factory=list)
    corrected_values: Dict[str, Any] = field(default_factory=dict)
    validation_notes: str = ""


# Physiological limits - values outside these are impossible
PLAUSIBILITY_LIMITS = {
    "hemoglobin": {"min": 1.0, "max": 25.0, "unit": "g/dL"},
    "hematocrit": {"min": 5.0, "max": 70.0, "unit": "%"},
    "glucose": {"min": 10.0, "max": 1500.0, "unit": "mg/dL"},
    "sodium": {"min": 100.0, "max": 180.0, "unit": "mEq/L"},
    "potassium": {"min": 1.0, "max": 10.0, "unit": "mEq/L"},
    "creatinine": {"min": 0.1, "max": 30.0, "unit": "mg/dL"},
    "bun": {"min": 1.0, "max": 200.0, "unit": "mg/dL"},
    "calcium": {"min": 4.0, "max": 18.0, "unit": "mg/dL"},
    "phosphorus": {"min": 0.5, "max": 15.0, "unit": "mg/dL"},
    "magnesium": {"min": 0.5, "max": 6.0, "unit": "mg/dL"},
    "ast": {"min": 0, "max": 10000, "unit": "U/L"},
    "alt": {"min": 0, "max": 10000, "unit": "U/L"},
    "bilirubin_total": {"min": 0, "max": 50.0, "unit": "mg/dL"},
    "cholesterol_total": {"min": 50, "max": 1000, "unit": "mg/dL"},
    "triglycerides": {"min": 10, "max": 10000, "unit": "mg/dL"},
    "wbc_count": {"min": 0.5, "max": 500.0, "unit": "×10³/μL"},
    "platelet_count": {"min": 5.0, "max": 2000.0, "unit": "×10³/μL"},
    "tsh": {"min": 0.0, "max": 150.0, "unit": "μU/mL"},
}

# Related biomarker groups for coherence checking
COHERENCE_GROUPS = {
    "renal_function": ["bun", "creatinine", "egfr"],
    "liver_function": ["ast", "alt", "alp", "bilirubin_total", "ggt", "albumin"],
    "lipid_panel": ["cholesterol_total", "hdl", "ldl", "triglycerides", "vldl"],
    "cbc": ["hemoglobin", "hematocrit", "rbc_count", "wbc_count", "platelet_count"],
    "electrolytes": ["sodium", "potassium", "chloride", "bicarbonate", "calcium"],
    "thyroid": ["tsh", "t4_free", "t3_free", "t4_total", "t3_total"],
    "iron_studies": ["iron", "ferritin", "tibc"],
}


class ValidatorAgent:
    """
    Validates lab interpretation results using rule-based checks.
    All validation is deterministic — no LLM calls.
    """
    
    def __init__(self):
        """
        Initialize the validator agent.
        Rule-based only — no external API dependencies.
        """
        self.use_llm_validation = False
    
    async def validate(
        self,
        extracted_values: List[ExtractedValue],
        patient_context: Optional[PatientContext] = None
    ) -> ValidationReport:
        """
        Validate a list of extracted values.
        
        Args:
            extracted_values: List of extracted biomarker values
            patient_context: Optional patient context for context-aware validation
            
        Returns:
            ValidationReport with issues and confidence score
        """
        all_issues: List[ValidationIssue] = []
        corrected_values: Dict[str, Any] = {}
        
        # Step 1: Rule-based validation (fast)
        for value in extracted_values:
            issues = self._validate_single_value(value)
            all_issues.extend(issues)
        
        # Step 2: Coherence validation across related values
        coherence_issues = self._check_coherence(extracted_values)
        all_issues.extend(coherence_issues)
        
        # Step 3: LLM validation removed — Qwen handles interpretation directly
        
        # Calculate confidence score
        confidence = self._calculate_confidence(extracted_values, all_issues)
        
        # Determine overall validity
        critical_issues = [i for i in all_issues if i.severity == "critical"]
        high_issues = [i for i in all_issues if i.severity == "high"]
        
        is_valid = len(critical_issues) == 0 and len(high_issues) <= 2
        
        return ValidationReport(
            is_valid=is_valid,
            confidence=confidence,
            issues=all_issues,
            corrected_values=corrected_values,
            validation_notes=self._generate_notes(all_issues)
        )
    
    def _validate_single_value(self, value: ExtractedValue) -> List[ValidationIssue]:
        """Validate a single extracted value with rule-based checks."""
        issues = []
        
        # 1. Plausibility check
        plausibility_issue = self._check_plausibility(value)
        if plausibility_issue:
            issues.append(plausibility_issue)
        
        # 2. Range logic check
        range_issue = self._check_range_logic(value)
        if range_issue:
            issues.append(range_issue)
        
        # 3. Unit sanity check
        unit_issue = self._check_unit_sanity(value)
        if unit_issue:
            issues.append(unit_issue)
        
        return issues
    
    def _check_plausibility(self, value: ExtractedValue) -> Optional[ValidationIssue]:
        """Check if the value is physiologically plausible."""
        if not value.matched_id or value.matched_id not in PLAUSIBILITY_LIMITS:
            return None
        
        limits = PLAUSIBILITY_LIMITS[value.matched_id]
        actual_value = value.converted_value or value.original_value
        
        if actual_value < limits["min"]:
            return ValidationIssue(
                biomarker_name=value.biomarker_name,
                issue_type="plausibility",
                severity="critical",
                message=f"Value {actual_value} is below physiological minimum ({limits['min']} {limits['unit']})",
                original_value=actual_value,
                suggested_correction=None
            )
        
        if actual_value > limits["max"]:
            return ValidationIssue(
                biomarker_name=value.biomarker_name,
                issue_type="plausibility",
                severity="critical",
                message=f"Value {actual_value} exceeds physiological maximum ({limits['max']} {limits['unit']})",
                original_value=actual_value,
                suggested_correction=None
            )
        
        return None
    
    def _check_range_logic(self, value: ExtractedValue) -> Optional[ValidationIssue]:
        """Check if the status matches the value relative to reference range."""
        if not value.reference_range or value.status == ValueStatus.UNKNOWN:
            return None
        
        try:
            # Parse reference range (format: "low-high")
            range_str = value.reference_range.replace(" ", "")
            if "-" not in range_str:
                return None
            
            parts = range_str.split("-")
            ref_low = float(parts[0]) if parts[0] else None
            ref_high = float(parts[1]) if parts[1] else None
            
            actual_value = value.converted_value or value.original_value
            
            # Verify status matches value position
            expected_status = None
            if ref_low and actual_value < ref_low:
                expected_status = "low"
            elif ref_high and actual_value > ref_high:
                expected_status = "high"
            else:
                expected_status = "normal"
            
            actual_status = value.status.value if hasattr(value.status, 'value') else str(value.status)
            
            # Check for mismatch (ignore critical variants)
            if expected_status == "normal" and actual_status != "normal":
                return ValidationIssue(
                    biomarker_name=value.biomarker_name,
                    issue_type="range",
                    severity="high",
                    message=f"Status '{actual_status}' but value {actual_value} is within range {value.reference_range}",
                    original_value=actual_status,
                    suggested_correction="normal"
                )
            
            if expected_status != "normal" and actual_status == "normal":
                return ValidationIssue(
                    biomarker_name=value.biomarker_name,
                    issue_type="range",
                    severity="high",
                    message=f"Status 'normal' but value {actual_value} is outside range {value.reference_range}",
                    original_value=actual_status,
                    suggested_correction=expected_status
                )
                
        except (ValueError, IndexError):
            pass  # Can't parse range, skip check
        
        return None
    
    def _check_unit_sanity(self, value: ExtractedValue) -> Optional[ValidationIssue]:
        """Check for common unit extraction errors."""
        if not value.original_unit:
            return ValidationIssue(
                biomarker_name=value.biomarker_name,
                issue_type="unit",
                severity="medium",
                message="No unit extracted - may affect accuracy",
                original_value=value.original_value,
                suggested_correction=None
            )
        
        # Check for suspiciously high/low values that suggest unit confusion
        suspicions = [
            # Glucose: mmol/L (4-7) vs mg/dL (70-100)
            (value.matched_id == "glucose" and value.original_unit == "mg/dL" and value.original_value < 20,
             "Glucose in mg/dL but value < 20 - might be mmol/L?"),
            
            # Hemoglobin: g/L (120-160) vs g/dL (12-16)
            (value.matched_id == "hemoglobin" and value.original_unit == "g/dL" and value.original_value > 50,
             "Hemoglobin in g/dL but value > 50 - might be g/L?"),
            
            # Creatinine: µmol/L (60-110) vs mg/dL (0.6-1.1)
            (value.matched_id == "creatinine" and value.original_unit == "mg/dL" and value.original_value > 15,
             "Creatinine in mg/dL but value > 15 - might be µmol/L?"),
        ]
        
        for condition, message in suspicions:
            if condition:
                return ValidationIssue(
                    biomarker_name=value.biomarker_name,
                    issue_type="unit",
                    severity="high",
                    message=message,
                    original_value=f"{value.original_value} {value.original_unit}",
                    suggested_correction=None
                )
        
        return None
    
    def _check_coherence(self, values: List[ExtractedValue]) -> List[ValidationIssue]:
        """Check coherence between related biomarker values."""
        issues = []
        
        # Build lookup by matched_id
        value_map = {v.matched_id: v for v in values if v.matched_id}
        
        # Check hemoglobin/hematocrit ratio (should be ~3:1)
        if "hemoglobin" in value_map and "hematocrit" in value_map:
            hgb = value_map["hemoglobin"].converted_value or value_map["hemoglobin"].original_value
            hct = value_map["hematocrit"].original_value
            
            if hct > 0:
                ratio = hct / hgb
                if ratio < 2.5 or ratio > 3.5:
                    issues.append(ValidationIssue(
                        biomarker_name="Hemoglobin/Hematocrit",
                        issue_type="coherence",
                        severity="medium",
                        message=f"Hct:Hgb ratio is {ratio:.1f}, expected ~3:1",
                        original_value=f"Hgb={hgb}, Hct={hct}",
                        suggested_correction=None
                    ))
        
        # Check BUN:Creatinine ratio (normal 10-20:1)
        if "bun" in value_map and "creatinine" in value_map:
            bun = value_map["bun"].converted_value or value_map["bun"].original_value
            cr = value_map["creatinine"].converted_value or value_map["creatinine"].original_value
            
            if cr > 0:
                ratio = bun / cr
                if ratio > 25:
                    issues.append(ValidationIssue(
                        biomarker_name="BUN/Creatinine",
                        issue_type="coherence",
                        severity="low",
                        message=f"BUN:Cr ratio is {ratio:.1f}:1 (elevated), may suggest dehydration or upper GI bleed",
                        original_value=f"BUN={bun}, Cr={cr}",
                        suggested_correction=None
                    ))
        
        # Check lipid panel totals
        if all(k in value_map for k in ["cholesterol_total", "hdl", "ldl", "triglycerides"]):
            tc = value_map["cholesterol_total"].original_value
            hdl = value_map["hdl"].original_value
            ldl = value_map["ldl"].original_value
            tg = value_map["triglycerides"].original_value
            
            # Friedewald equation: LDL = TC - HDL - (TG/5)
            calculated_ldl = tc - hdl - (tg / 5)
            ldl_diff = abs(ldl - calculated_ldl)
            
            if ldl_diff > 20:
                issues.append(ValidationIssue(
                    biomarker_name="Lipid Panel",
                    issue_type="coherence",
                    severity="medium",
                    message=f"LDL ({ldl}) differs from calculated ({calculated_ldl:.0f}) by {ldl_diff:.0f}",
                    original_value=f"TC={tc}, HDL={hdl}, LDL={ldl}, TG={tg}",
                    suggested_correction=None
                ))
        
        return issues
    
    async def _llm_validate(
        self,
        values: List[ExtractedValue],
        patient_context: Optional[PatientContext]
    ) -> List[ValidationIssue]:
        """Use LLM for advanced clinical validation."""
        if not self.model:
            return []
        
        try:
            # Build context for LLM
            values_summary = []
            for v in values:
                actual = v.converted_value or v.original_value
                unit = v.reference_unit or v.original_unit
                values_summary.append(
                    f"- {v.biomarker_name}: {actual} {unit} (Status: {v.status})"
                )
            
            context_str = ""
            if patient_context:
                context_str = f"""
Patient: {patient_context.sex}, {patient_context.age or 'unknown'} years old
Fasting: {patient_context.is_fasting}
"""
            
            prompt = f"""You are a Clinical Laboratory Validator. Review these lab values for potential errors.

{context_str}

Lab Values:
{chr(10).join(values_summary)}

Check for:
1. Implausible values (physiologically impossible)
2. Inconsistent status vs. value
3. Suspicious patterns between related tests
4. Potential OCR/extraction errors

If you find issues, respond in JSON format:
{{
    "has_issues": true/false,
    "issues": [
        {{
            "biomarker": "name",
            "type": "implausible|inconsistent|suspicious|extraction",
            "severity": "low|medium|high|critical",
            "message": "Brief explanation"
        }}
    ]
}}

If all values look correct, respond: {{"has_issues": false, "issues": []}}
"""
            
            response = self.model.generate_content(
                prompt,
                generation_config={"temperature": 0.1}
            )
            
            # Parse response
            text = response.text.strip()
            if text.startswith("```"):
                text = text.split("```")[1]
                if text.startswith("json"):
                    text = text[4:]
            
            result = json.loads(text)
            
            if result.get("has_issues"):
                return [
                    ValidationIssue(
                        biomarker_name=issue["biomarker"],
                        issue_type=issue["type"],
                        severity=issue["severity"],
                        message=f"[LLM] {issue['message']}",
                        original_value=None,
                        suggested_correction=None
                    )
                    for issue in result.get("issues", [])
                ]
            
        except Exception as e:
            logger.warning(f"LLM validation failed: {e}")
        
        return []
    
    def _calculate_confidence(
        self,
        values: List[ExtractedValue],
        issues: List[ValidationIssue]
    ) -> float:
        """Calculate overall confidence score (0.0 - 1.0)."""
        if not values:
            return 0.0
        
        # Start with base confidence
        confidence = 1.0
        
        # Deduct for issues by severity
        severity_deductions = {
            "critical": 0.3,
            "high": 0.15,
            "medium": 0.05,
            "low": 0.02
        }
        
        for issue in issues:
            deduction = severity_deductions.get(issue.severity, 0.05)
            confidence -= deduction
        
        # Deduct for unknown biomarkers
        unknown_count = sum(1 for v in values if v.status == ValueStatus.UNKNOWN)
        confidence -= unknown_count * 0.05
        
        return max(0.0, min(1.0, confidence))
    
    def _generate_notes(self, issues: List[ValidationIssue]) -> str:
        """Generate human-readable validation notes."""
        if not issues:
            return "All values passed validation checks."
        
        critical = [i for i in issues if i.severity == "critical"]
        high = [i for i in issues if i.severity == "high"]
        
        parts = []
        
        if critical:
            parts.append(f"⚠️ {len(critical)} critical issue(s) found")
        if high:
            parts.append(f"⚡ {len(high)} high-severity issue(s) found")
        
        parts.append(f"Total: {len(issues)} validation issue(s)")
        
        return ". ".join(parts)


# Singleton instance
_validator: Optional[ValidatorAgent] = None


def get_validator() -> ValidatorAgent:
    """Get or create the validator agent singleton."""
    global _validator
    
    if _validator is None:
        _validator = ValidatorAgent()
    
    return _validator
