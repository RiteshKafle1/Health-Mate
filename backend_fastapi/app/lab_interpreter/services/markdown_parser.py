"""
Markdown Parser for Lab Report Tables
=======================================
Converts LlamaParse markdown output into structured JSON
containing biomarker names, values, and units.

This is a deterministic Python parser — no LLM involved.
It handles the variability of lab report table formats:
  - Different column orders
  - Merged value+unit columns (e.g., "10.2 g/dL")
  - Variable header names (Result vs Value, Range vs Normal)
  - Sub-headers and footnotes

Usage:
    from app.lab_interpreter.services.markdown_parser import parse_lab_markdown

    result = parse_lab_markdown(markdown_text)
    # result = {
    #     "patient_info": {"sex": "male", "age": 55},
    #     "extracted_values": [
    #         {"name": "Hemoglobin", "value": 10.2, "unit": "g/dL"},
    #         ...
    #     ]
    # }
"""

import re
import logging
from typing import List, Dict, Any, Optional, Tuple

logger = logging.getLogger(__name__)

# ─── Header name aliases ──────────────────────────────────────────────────────
# Maps various column header names to our canonical field names
TEST_NAME_HEADERS = {
    "test", "test name", "test description", "investigation",
    "investigations", "parameter", "parameters", "analyte",
    "biomarker", "component", "test type", "lab test",
    "test performed", "examination", "assay", "specimen",
    "profile", "panel", "chemistry", "analytes",
}

RESULT_HEADERS = {
    "result", "results", "value", "observed value", "observed",
    "patient value", "patient result", "finding", "findings",
    "reported value", "measured value", "obtained value",
    "test result", "lab value", "lab result", "reading",
    "outcome", "your result", "patient's value",
}

UNIT_HEADERS = {
    "unit", "units", "uom", "unit of measure", "measurement unit",
}

REFERENCE_HEADERS = {
    "reference", "reference range", "reference interval",
    "normal range", "normal", "normal value", "normal values",
    "biological ref. interval", "bio. ref. interval",
    "biological reference interval", "bio ref interval",
    "ref range", "ref. range", "ref interval", "ref. interval",
    "expected range", "standard range", "reference value",
    "reference values", "normal limit", "normal limits",
    "desirable range", "therapeutic range", "ref",
}

# ─── Regex patterns ───────────────────────────────────────────────────────────
# Match numeric values (with optional decimal) and optional units
VALUE_UNIT_PATTERN = re.compile(
    r"^([<>]?\s*\d+\.?\d*)\s*([a-zA-Zμ/%\^·×]+(?:[/\s][a-zA-Zμ/%\^·×²³]+)*)?$"
)

# Match range patterns like "14.0 - 18.0" or "14.0-18.0" or "70 - 100"
RANGE_PATTERN = re.compile(
    r"(\d+\.?\d*)\s*[-–—]\s*(\d+\.?\d*)"
)

# Match "< 200", "<200", "< 200 mg/dL"
LESS_THAN_PATTERN = re.compile(
    r"[<≤]\s*(\d+\.?\d*)\s*([a-zA-Zμ/%^·×]+(?:[/\s][a-zA-Zμ/%^·×²³]+)*)?"
)

# Match "> 60", ">60", "> 60 mL/min"
GREATER_THAN_PATTERN = re.compile(
    r"[>≥]\s*(\d+\.?\d*)\s*([a-zA-Zμ/%^·×]+(?:[/\s][a-zA-Zμ/%^·×²³]+)*)?"
)

# Patient info patterns
AGE_PATTERN = re.compile(r"(?:age|aged?)\s*[:.]?\s*(\d+)", re.IGNORECASE)
SEX_PATTERN = re.compile(
    r"(?:sex|gender)\s*[:.]?\s*(male|female|m|f)\b", re.IGNORECASE
)
# Also detect from standalone M/F or Male/Female
SEX_STANDALONE = re.compile(
    r"\b(male|female)\b", re.IGNORECASE
)


def parse_lab_markdown(markdown: str) -> Dict[str, Any]:
    """
    Parse LlamaParse markdown output into structured lab report JSON.

    Args:
        markdown: Raw markdown string from LlamaParse

    Returns:
        Dict with:
          - patient_info: {sex, age} if detected
          - extracted_values: [{name, value, unit, reference_range}, ...]
    """
    if not markdown or not markdown.strip():
        return {"patient_info": {}, "extracted_values": []}

    # Extract patient info from non-table text
    patient_info = _extract_patient_info(markdown)

    # Find and parse all tables
    extracted = []
    tables = _find_markdown_tables(markdown)

    for table_lines in tables:
        rows = _parse_table(table_lines)
        if rows:
            extracted.extend(rows)

    # Deduplicate by test name (keep first occurrence)
    seen = set()
    unique = []
    for val in extracted:
        key = val["name"].lower().strip()
        if key not in seen:
            seen.add(key)
            unique.append(val)

    logger.info(f"Parsed {len(unique)} biomarkers from {len(tables)} table(s)")

    return {
        "patient_info": patient_info,
        "extracted_values": unique,
    }


def _extract_patient_info(text: str) -> Dict[str, Any]:
    """Extract patient demographics from report text."""
    info: Dict[str, Any] = {}

    # Extract age
    age_match = AGE_PATTERN.search(text)
    if age_match:
        try:
            info["age"] = int(age_match.group(1))
        except ValueError:
            pass

    # Extract sex
    sex_match = SEX_PATTERN.search(text)
    if sex_match:
        raw = sex_match.group(1).lower()
        info["sex"] = "male" if raw in ("m", "male") else "female"
    else:
        # Try standalone match (less reliable)
        sex_standalone = SEX_STANDALONE.search(text[:500])  # Only in header area
        if sex_standalone:
            info["sex"] = sex_standalone.group(1).lower()

    return info


def _find_markdown_tables(markdown: str) -> List[List[str]]:
    """
    Find all markdown tables in the text.
    A table is a consecutive block of lines containing '|'.
    """
    lines = markdown.split("\n")
    tables: List[List[str]] = []
    current_table: List[str] = []

    for line in lines:
        stripped = line.strip()
        if "|" in stripped and stripped.startswith("|"):
            current_table.append(stripped)
        else:
            if len(current_table) >= 3:  # header + separator + at least 1 row
                tables.append(current_table)
            current_table = []

    # Don't forget the last table
    if len(current_table) >= 3:
        tables.append(current_table)

    return tables


def _parse_table(table_lines: List[str]) -> List[Dict[str, Any]]:
    """
    Parse a single markdown table into extracted values.

    Returns list of {name, value, unit, reference_range} dicts.
    """
    if len(table_lines) < 3:
        return []

    # Parse header row
    header_row = table_lines[0]
    headers = [h.strip().lower() for h in header_row.split("|") if h.strip()]

    # Map headers to canonical fields
    col_map = _identify_columns(headers)

    if "test" not in col_map:
        # Can't identify test name column — skip this table
        return []

    # Skip separator row (row with ---)
    data_start = 1
    for i, line in enumerate(table_lines[1:], 1):
        if re.match(r"^\|[\s\-:|]+\|$", line.strip()):
            data_start = i + 1
            break

    results = []
    for line in table_lines[data_start:]:
        cells = [c.strip() for c in line.split("|") if c.strip() != ""]

        if len(cells) < len(headers):
            # Pad with empty strings if columns are missing
            cells.extend([""] * (len(headers) - len(cells)))

        row = _extract_row(cells, col_map, headers)
        if row:
            results.append(row)

    return results


def _identify_columns(headers: List[str]) -> Dict[str, int]:
    """
    Identify which column index maps to which field.
    Returns dict like {"test": 0, "result": 1, "unit": 2, "reference": 3}
    """
    col_map: Dict[str, int] = {}

    for i, header in enumerate(headers):
        header_clean = header.strip().lower()

        if header_clean in TEST_NAME_HEADERS or any(
            h in header_clean for h in TEST_NAME_HEADERS
        ):
            col_map.setdefault("test", i)

        elif header_clean in RESULT_HEADERS or any(
            h in header_clean for h in RESULT_HEADERS
        ):
            col_map.setdefault("result", i)

        elif header_clean in UNIT_HEADERS or any(
            h in header_clean for h in UNIT_HEADERS
        ):
            col_map.setdefault("unit", i)

        elif header_clean in REFERENCE_HEADERS or any(
            h in header_clean for h in REFERENCE_HEADERS
        ):
            col_map.setdefault("reference", i)

    # If no explicit test column found, assume first column
    if "test" not in col_map:
        col_map["test"] = 0

    # If no result column, assume second column
    if "result" not in col_map and len(headers) > 1:
        col_map["result"] = 1

    return col_map


def _extract_row(
    cells: List[str],
    col_map: Dict[str, int],
    headers: List[str],
) -> Optional[Dict[str, Any]]:
    """
    Extract a single biomarker row from table cells.

    Returns {name, value, unit, reference_range} or None if invalid.
    """
    try:
        # Get test name
        test_idx = col_map.get("test", 0)
        if test_idx >= len(cells):
            return None
        name = cells[test_idx].strip()

        # Skip empty names, sub-headers, or category rows
        if not name or name.startswith("**") or name.startswith("#"):
            return None
        # Skip rows that look like section headers (all text, no numbers in row)
        if not any(re.search(r"\d", c) for c in cells[1:]):
            return None

        # Get result value
        value, unit = None, ""
        result_idx = col_map.get("result")

        if result_idx is not None and result_idx < len(cells):
            value, unit = _parse_value_unit(cells[result_idx])

        # Get unit from separate column if not found in result
        if not unit:
            unit_idx = col_map.get("unit")
            if unit_idx is not None and unit_idx < len(cells):
                unit = cells[unit_idx].strip()

        # Skip if no numeric value found
        if value is None:
            return None

        # Get reference range — parse into structured format
        ref_range = None
        ref_idx = col_map.get("reference")
        if ref_idx is not None and ref_idx < len(cells):
            raw_ref = cells[ref_idx].strip()
            if raw_ref:
                ref_range = _parse_reference_range(raw_ref)

        result = {
            "name": _clean_name(name),
            "value": value,
            "unit": unit,
            "reference_range": ref_range,
        }

        return result

    except (IndexError, ValueError):
        return None


def _parse_value_unit(text: str) -> Tuple[Optional[float], str]:
    """
    Parse a result cell that might contain value+unit together.
    Examples:
      "10.2"          → (10.2, "")
      "10.2 g/dL"     → (10.2, "g/dL")
      "< 0.5"         → (0.5, "")  (preserves numeric part)
      "> 60"          → (60.0, "")
      "Negative"      → (None, "")
    """
    text = text.strip()
    if not text:
        return None, ""

    # Try to match value and optional unit
    match = VALUE_UNIT_PATTERN.match(text)
    if match:
        val_str = match.group(1).replace("<", "").replace(">", "").strip()
        try:
            value = float(val_str)
        except ValueError:
            return None, ""
        unit = (match.group(2) or "").strip()
        return value, unit

    # Fallback: try to find just a number
    num_match = re.search(r"([<>]?\s*\d+\.?\d*)", text)
    if num_match:
        val_str = num_match.group(1).replace("<", "").replace(">", "").strip()
        try:
            value = float(val_str)
        except ValueError:
            return None, ""
        # Everything after the number is the unit
        remaining = text[num_match.end():].strip()
        return value, remaining

    return None, ""


def _parse_reference_range(text: str) -> Optional[Dict[str, Any]]:
    """
    Parse a reference range string into a structured dict.

    Examples:
        "14.0 - 18.0"       → {"raw": "14.0 - 18.0", "low": 14.0, "high": 18.0, "unit": ""}
        "14.0-18.0 g/dL"    → {"raw": "14.0-18.0 g/dL", "low": 14.0, "high": 18.0, "unit": "g/dL"}
        "< 200 mg/dL"       → {"raw": "< 200 mg/dL", "low": None, "high": 200.0, "unit": "mg/dL"}
        "> 60 mL/min"       → {"raw": "> 60 mL/min", "low": 60.0, "high": None, "unit": "mL/min"}
        ""                  → None
    """
    if not text or not text.strip():
        return None

    raw = text.strip()

    # Try standard range pattern: "14.0 - 18.0" or "14.0-18.0 g/dL"
    range_match = RANGE_PATTERN.search(raw)
    if range_match:
        low = float(range_match.group(1))
        high = float(range_match.group(2))
        # Extract unit from text after the range numbers
        remaining = raw[range_match.end():].strip()
        # Clean up unit (remove leading/trailing punctuation)
        unit = re.sub(r'^[\s,;:]+|[\s,;:]+$', '', remaining)
        return {"raw": raw, "low": low, "high": high, "unit": unit}

    # Try less-than pattern: "< 200 mg/dL"
    lt_match = LESS_THAN_PATTERN.search(raw)
    if lt_match:
        high = float(lt_match.group(1))
        unit = (lt_match.group(2) or "").strip()
        return {"raw": raw, "low": None, "high": high, "unit": unit}

    # Try greater-than pattern: "> 60 mL/min"
    gt_match = GREATER_THAN_PATTERN.search(raw)
    if gt_match:
        low = float(gt_match.group(1))
        unit = (gt_match.group(2) or "").strip()
        return {"raw": raw, "low": low, "high": None, "unit": unit}

    # Unparseable — return raw string only
    return {"raw": raw, "low": None, "high": None, "unit": ""}


def _clean_name(name: str) -> str:
    """Clean up a biomarker name."""
    # Remove markdown bold markers
    name = name.replace("**", "").replace("*", "")
    # Remove leading/trailing whitespace and special chars
    name = name.strip(" -·•")
    # Collapse multiple spaces
    name = re.sub(r"\s+", " ", name)
    return name
