"""
Biomarker Models
================
Pydantic models for biomarker reference data.
"""

from pydantic import BaseModel
from typing import Optional, List, Dict, Any


class InterpretationText(BaseModel):
    """Interpretation text for abnormal values."""
    low: Optional[str] = None
    high: Optional[str] = None


class ReferenceRange(BaseModel):
    """A single reference range with optional conditions."""
    low: Optional[float] = None
    high: Optional[float] = None
    conditions: Dict[str, Any] = {}
    interpretation: Optional[InterpretationText] = None


class CriticalValues(BaseModel):
    """Critical/panic value thresholds."""
    critical_low: Optional[float] = None
    critical_high: Optional[float] = None


class Biomarker(BaseModel):
    """Complete biomarker definition with reference ranges."""
    id: str
    canonical_name: str
    synonyms: List[str] = []
    category: str
    specimen_type: str
    reference_unit: str
    reference_ranges: List[ReferenceRange] = []
    critical_values: Optional[CriticalValues] = None
    
    def get_range_for_context(self, context: Dict[str, Any]) -> Optional[ReferenceRange]:
        """
        Find the most appropriate reference range for given patient context.
        
        Args:
            context: Patient context dict with keys like 'sex', 'age', 'state'
            
        Returns:
            Best matching ReferenceRange or None
        """
        best_match = None
        best_score = -1
        
        for range_entry in self.reference_ranges:
            score = self._calculate_match_score(range_entry.conditions, context)
            if score > best_score:
                best_score = score
                best_match = range_entry
        
        return best_match
    
    def _calculate_match_score(
        self, 
        conditions: Dict[str, Any], 
        context: Dict[str, Any]
    ) -> int:
        """
        Calculate how well conditions match context.
        Higher score = better match.
        """
        if not conditions:
            return 0  # Generic range, lowest priority
        
        score = 0
        for key, value in conditions.items():
            if key in context:
                if context[key] == value:
                    score += 10  # Exact match
                else:
                    return -1  # Mismatch, disqualify
            # If condition key not in context, don't penalize
        
        return score


class BiomarkersData(BaseModel):
    """Container for all biomarker data from JSON."""
    version: str
    source: str
    last_updated: str
    biomarkers: List[Biomarker]
