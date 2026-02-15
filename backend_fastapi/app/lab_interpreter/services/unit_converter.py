"""
Unit Converter
==============
Converts lab values between different units to match reference standards.
"""

import json
import re
from pathlib import Path
from typing import Optional, Tuple, Dict, Any
from functools import lru_cache


# Path to unit conversions JSON
DATA_DIR = Path(__file__).parent.parent.parent.parent / "data"
CONVERSIONS_FILE = DATA_DIR / "unit_conversions.json"


class UnitConverter:
    """
    Handles unit conversions for lab values.
    
    Converts various units to reference standard units used in biomarkers.json.
    """
    
    def __init__(self):
        self.conversions = self._load_conversions()
        self._unit_aliases = self._build_unit_aliases()
    
    def _load_conversions(self) -> Dict[str, Any]:
        """Load conversion factors from JSON file."""
        if not CONVERSIONS_FILE.exists():
            print(f"Warning: Unit conversions file not found: {CONVERSIONS_FILE}")
            return {"conversions": {}}
        
        with open(CONVERSIONS_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
        
        return data.get("conversions", {})
    
    def _build_unit_aliases(self) -> Dict[str, str]:
        """Build a mapping of unit aliases to canonical forms."""
        return {
            # Micro symbol variations
            "μ": "u",
            "µ": "u",
            "micro": "u",
            # Spaces and formatting
            " ": "",
            # Common variations
            "litre": "L",
            "liter": "L",
            "deciliter": "dL",
            "decilitre": "dL",
            "milliliter": "mL",
            "millilitre": "mL",
            # Case variations handled by normalization
        }
    
    def _normalize_unit(self, unit: str) -> str:
        """
        Normalize unit string for comparison.
        
        Handles various representations like μg/mL, ug/mL, µg/mL.
        """
        if not unit:
            return ""
        
        normalized = unit.strip()
        
        # Apply aliases
        for alias, replacement in self._unit_aliases.items():
            normalized = normalized.replace(alias, replacement)
        
        # Convert to lowercase for comparison
        return normalized.lower()
    
    def convert_to_reference_unit(
        self,
        biomarker_id: str,
        value: float,
        input_unit: str
    ) -> Tuple[float, str, bool]:
        """
        Convert a lab value to the reference unit.
        
        Args:
            biomarker_id: ID of the biomarker (e.g., 'glucose_fasting')
            value: Numeric value to convert
            input_unit: Unit of the input value
            
        Returns:
            Tuple of (converted_value, reference_unit, was_converted)
        """
        # Normalize biomarker ID
        biomarker_key = biomarker_id.lower().replace(" ", "_").replace("-", "_")
        
        # Check if we have conversions for this biomarker
        if biomarker_key not in self.conversions:
            return value, input_unit, False
        
        config = self.conversions[biomarker_key]
        reference_unit = config.get("reference_unit", input_unit)
        conversions = config.get("conversions", {})
        
        # Normalize input unit
        input_normalized = self._normalize_unit(input_unit)
        reference_normalized = self._normalize_unit(reference_unit)
        
        # Already in reference unit?
        if input_normalized == reference_normalized:
            return value, reference_unit, False
        
        # Find matching conversion
        for unit_key, conversion in conversions.items():
            if self._normalize_unit(unit_key) == input_normalized:
                # Apply conversion
                converted = value * conversion["multiply"]
                
                # Handle additional offset (e.g., for HbA1c IFCC to NGSP)
                if "add" in conversion:
                    converted += conversion["add"]
                
                return round(converted, 2), reference_unit, True
        
        # No conversion found - return original with warning
        return value, input_unit, False
    
    def get_supported_units(self, biomarker_id: str) -> Dict[str, str]:
        """
        Get all supported units for a biomarker.
        
        Args:
            biomarker_id: ID of the biomarker
            
        Returns:
            Dict with 'reference_unit' and 'convertible_units' list
        """
        biomarker_key = biomarker_id.lower().replace(" ", "_")
        
        if biomarker_key not in self.conversions:
            return {"reference_unit": None, "convertible_units": []}
        
        config = self.conversions[biomarker_key]
        return {
            "reference_unit": config.get("reference_unit"),
            "convertible_units": list(config.get("conversions", {}).keys())
        }
    
    def parse_value_with_unit(self, text: str) -> Tuple[Optional[float], Optional[str]]:
        """
        Parse a value and unit from text like "14.2 g/dL" or "126 mg/dL".
        
        Args:
            text: Text containing value and unit
            
        Returns:
            Tuple of (value, unit) or (None, None) if parsing fails
        """
        # Pattern: number (optional decimal) followed by unit
        pattern = r"([\d,]+\.?\d*)\s*([a-zA-Zμµ/%°×\d]+(?:/[a-zA-Zμµ%°×\d]+)?)"
        
        match = re.search(pattern, text.strip())
        if match:
            value_str = match.group(1).replace(",", "")
            unit = match.group(2).strip()
            try:
                value = float(value_str)
                return value, unit
            except ValueError:
                pass
        
        return None, None


# Singleton instance
_converter: Optional[UnitConverter] = None


def get_unit_converter() -> UnitConverter:
    """Get or create the singleton UnitConverter instance."""
    global _converter
    if _converter is None:
        _converter = UnitConverter()
    return _converter
