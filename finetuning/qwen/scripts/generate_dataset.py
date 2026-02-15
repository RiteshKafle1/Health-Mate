#!/usr/bin/env python3
"""
Improved Dataset Generator for Qwen 2.5-3B Fine-Tuning
========================================================
Generates 6,000 training examples with:
  - Higher Critical case weights (12%/8% vs old 7%/3%)
  - Richer interpretations from biomarkers.json
  - **Conclusion** line in every response to anchor the status
  - Built-in ABIM cross-validation at generation time
  - Deduplication and 90/10 train/eval split

Usage:
    python generate_dataset.py
"""

import json
import random
import os
import sys

# ─── Configuration ────────────────────────────────────────────────────────────
_SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
_PROJECT_ROOT = os.path.abspath(os.path.join(_SCRIPT_DIR, "..", "..", ".."))

INPUT_FILE = os.path.join(_PROJECT_ROOT, "backend_fastapi", "data", "biomarkers.json")
OUTPUT_DIR = os.path.join(_SCRIPT_DIR, "..", "datasets")
OUTPUT_FILE = os.path.join(OUTPUT_DIR, "train_dataset.jsonl")
EVAL_FILE = os.path.join(OUTPUT_DIR, "train_dataset_eval.jsonl")

NUM_EXAMPLES = 6000
TRAIN_SPLIT = 0.9  # 90% train, 10% eval

# Biomarkers to skip (no defined normal/abnormal range per ABIM)
SKIP_BIOMARKERS = {'psa'}

# ─── Status Weights (improved from DeepSeek version) ─────────────────────────
# Old:  Normal=40%, Low=25%, High=25%, CritHigh=7%, CritLow=3%
# New:  Normal=35%, Low=22%, High=23%, CritHigh=12%, CritLow=8%
STATUS_WEIGHTS = {
    "base":          {"normal": 0.35, "low": 0.22, "high": 0.23},
    "critical_high": 0.12,
    "critical_low":  0.08,
}

# ─── Clinical Recommendations by Category ────────────────────────────────────
RECOMMENDATIONS = {
    "glucose_high": [
        "Recommend follow-up fasting glucose test",
        "Consider HbA1c testing for diabetes screening",
        "Discuss dietary modifications with healthcare provider",
        "Monitor for symptoms of hyperglycemia",
        "Evaluate for metabolic syndrome risk factors",
    ],
    "glucose_low": [
        "Evaluate for causes of hypoglycemia",
        "Review current medications that may lower glucose",
        "Consider frequent small meals to maintain glucose levels",
        "Monitor for symptoms of hypoglycemia (shakiness, confusion)",
    ],
    "cholesterol_high": [
        "Recommend lipid-lowering dietary changes",
        "Consider cardiovascular risk assessment",
        "Discuss statin therapy with physician",
        "Encourage regular aerobic exercise",
        "Assess for familial hyperlipidemia",
    ],
    "cholesterol_low": [
        "Evaluate for malnutrition or malabsorption",
        "Consider liver function assessment",
        "Review dietary intake",
    ],
    "hematology_low": [
        "Evaluate for anemia etiology",
        "Consider reticulocyte count assessment",
        "Assess for nutritional deficiencies",
        "Review medication effects on blood counts",
        "Consider hematology referral if persistent",
    ],
    "hematology_high": [
        "Evaluate hydration status",
        "Consider polycythemia screening",
        "Assess for chronic hypoxia causes",
        "Check oxygen saturation",
    ],
    "iron_panel_low": [
        "Evaluate for iron deficiency anemia",
        "Consider B12 and folate testing",
        "Dietary counseling for iron-rich foods",
        "Assess for chronic blood loss",
    ],
    "iron_panel_high": [
        "Evaluate for iron overload (hemochromatosis)",
        "Check transferrin saturation and ferritin",
        "Consider genetic testing for hereditary hemochromatosis",
        "Monitor hepatic function",
    ],
    "kidney_high": [
        "Monitor kidney function closely",
        "Review nephrotoxic medications",
        "Assess hydration status",
        "Consider nephrology referral",
        "Evaluate for underlying renal disease",
    ],
    "kidney_low": [
        "Monitor kidney function",
        "Assess for malnutrition or muscle wasting",
        "Consider additional testing",
    ],
    "liver_high": [
        "Evaluate for hepatic causes",
        "Review hepatotoxic medications and alcohol use",
        "Consider viral hepatitis screening",
        "Recommend liver imaging if persistently elevated",
        "Assess for drug-induced liver injury",
    ],
    "liver_low": [
        "Evaluate for liver synthetic dysfunction",
        "Assess nutritional status",
        "Consider additional liver function testing",
    ],
    "electrolyte_high": [
        "Monitor electrolyte levels",
        "Assess fluid balance",
        "Review medications affecting electrolytes",
        "Evaluate renal function",
    ],
    "electrolyte_low": [
        "Monitor electrolyte levels",
        "Assess fluid and dietary intake",
        "Review medications affecting electrolytes",
        "Evaluate for GI or renal losses",
    ],
    "thyroid_high": [
        "Correlate with clinical symptoms",
        "Consider additional thyroid function tests",
        "Evaluate for thyroid disease",
        "Follow up with endocrinology if indicated",
    ],
    "thyroid_low": [
        "Correlate with clinical symptoms",
        "Consider additional thyroid function tests",
        "Evaluate medication effects on thyroid function",
    ],
    "coagulation_high": [
        "Evaluate bleeding risk",
        "Review anticoagulant therapy",
        "Correlate with clinical symptoms",
        "Consider mixing studies if prolonged",
    ],
    "coagulation_low": [
        "Evaluate for hypercoagulable state",
        "Consider thrombotic risk assessment",
        "Review anticoagulant therapy",
    ],
    "cardiac_high": [
        "Evaluate for cardiac injury or heart failure",
        "Correlate with clinical symptoms and ECG",
        "Consider serial troponin measurements",
        "Cardiology consultation recommended",
    ],
    "cardiac_low": [
        "Consider additional testing",
        "Follow up with healthcare provider",
    ],
    "inflammatory_high": [
        "Correlate with clinical symptoms",
        "Evaluate for infection, inflammation, or autoimmune disease",
        "Consider repeating test to monitor trend",
        "Follow up with healthcare provider",
    ],
    "inflammatory_low": [
        "Consider additional testing",
        "Follow up with healthcare provider",
    ],
    "general_high": [
        "Follow up with healthcare provider",
        "Repeat test in 1-2 weeks",
        "Correlate with clinical symptoms",
    ],
    "general_low": [
        "Follow up with healthcare provider",
        "Repeat test in 1-2 weeks",
        "Consider additional testing",
    ],
}

# ─── Fix 3: Biomarker-specific recommendation overrides ──────────────────────
# These OVERRIDE category-based recommendations to prevent template leakage.
# Example: d_dimer should never get "Consider vitamin K status".
BIOMARKER_RECOMMENDATIONS = {
    "d_dimer": {
        "high": ["Evaluate for venous thromboembolism", "Consider CT angiography if clinical suspicion",
                 "Assess for DIC if markedly elevated", "Correlate with clinical probability score"],
    },
    "tibc": {
        "high": ["Evaluate for iron deficiency anemia", "Check serum iron and ferritin levels",
                 "Assess dietary iron intake", "Consider iron supplementation"],
        "low": ["Evaluate for iron overload", "Check transferrin saturation",
                "Consider hereditary hemochromatosis screening"],
    },
    "ferritin": {
        "low": ["Evaluate for iron deficiency", "Assess dietary iron intake",
                "Consider iron supplementation", "Check for occult blood loss"],
        "high": ["Evaluate for iron overload or inflammation", "Check transferrin saturation",
                 "Consider hemochromatosis screening", "Assess for chronic disease"],
    },
    "transferrin": {
        "high": ["Evaluate for iron deficiency anemia", "Check serum iron and ferritin",
                 "Assess dietary iron intake"],
        "low": ["Evaluate for iron overload or chronic disease", "Check transferrin saturation"],
    },
    "transferrin_saturation": {
        "high": ["Evaluate for iron overload (hemochromatosis)", "Check ferritin level",
                 "Consider genetic testing"],
        "low": ["Evaluate for iron deficiency", "Check serum iron and TIBC",
                "Consider iron supplementation"],
    },
    "haptoglobin": {
        "low": ["Evaluate for hemolytic anemia", "Check LDH and indirect bilirubin",
                "Consider peripheral blood smear", "Assess reticulocyte count"],
        "high": ["Evaluate for acute inflammation", "Correlate with CRP and ESR"],
    },
    "mcv": {
        "high": ["Evaluate for B12 or folate deficiency", "Consider reticulocyte count",
                 "Assess for liver disease or hypothyroidism", "Review alcohol intake"],
        "low": ["Evaluate for iron deficiency or thalassemia", "Check iron panel",
                "Consider hemoglobin electrophoresis"],
    },
    "mch": {
        "high": ["Evaluate for macrocytic anemia causes", "Check B12 and folate levels",
                 "Assess for liver disease"],
        "low": ["Evaluate for iron deficiency or thalassemia trait", "Check iron panel"],
    },
    "mchc": {
        "high": ["Evaluate for hereditary spherocytosis", "Review peripheral blood smear",
                 "Assess for hemolytic anemia"],
        "low": ["Evaluate for iron deficiency", "Check iron panel and reticulocyte count"],
    },
    "reticulocyte_count": {
        "high": ["Evaluate for hemolytic anemia or acute blood loss", "Assess for treatment response",
                 "Check LDH and haptoglobin"],
        "low": ["Evaluate for bone marrow suppression", "Check B12, folate, and iron levels",
                "Consider bone marrow evaluation if persistent"],
    },
    "wbc_count": {
        "high": ["Evaluate for infection or inflammation", "Consider differential WBC count",
                 "Assess for leukocytosis causes", "Correlate with clinical presentation"],
        "low": ["Evaluate for bone marrow suppression", "Review medications causing leukopenia",
                "Assess for infection risk", "Consider hematology referral"],
    },
    "urine_ph": {
        "high": ["Evaluate for urinary tract infection", "Assess for renal tubular acidosis",
                 "Review dietary factors affecting urine pH"],
        "low": ["Evaluate for metabolic acidosis", "Assess dietary factors",
                "Consider uric acid stone risk"],
    },
    "erythropoietin": {
        "high": ["Evaluate for secondary erythrocytosis", "Assess kidney function",
                 "Consider paraneoplastic syndrome", "Correlate with CBC findings"],
        "low": ["Evaluate for chronic kidney disease", "Assess for anemia of chronic disease",
                "Consider erythropoiesis-stimulating agent therapy"],
    },
    "platelet_count": {
        "high": ["Evaluate for reactive thrombocytosis vs. myeloproliferative disorder",
                 "Assess for infection or inflammation", "Consider iron studies",
                 "Correlate with peripheral blood smear"],
        "low": ["Evaluate for thrombocytopenia causes", "Review medications",
                "Assess for DIC or HIT", "Consider hematology referral"],
    },
    "rdw": {
        "high": ["Evaluate for mixed anemia (iron deficiency + B12 deficiency)",
                 "Assess for early iron deficiency", "Check reticulocyte count",
                 "Correlate with MCV for anemia classification"],
        "low": ["Consider additional testing", "Follow up with healthcare provider"],
    },
}

# ─── Biomarker → Category mapping ────────────────────────────────────────────
CATEGORY_MAP = {
    # Glucose / Diabetes
    "glucose_fasting": "glucose", "glucose_random": "glucose", "hba1c": "glucose",
    "c_peptide": "glucose",
    # Lipid panel
    "cholesterol_total": "cholesterol", "hdl": "cholesterol", "ldl": "cholesterol",
    "ldl_direct": "cholesterol", "vldl": "cholesterol", "triglycerides": "cholesterol",
    # Hematology (RBC/WBC/platelet indices)
    "hemoglobin": "hematology", "hematocrit": "hematology", "rbc_count": "hematology",
    "wbc_count": "hematology", "mcv": "hematology", "mch": "hematology",
    "mchc": "hematology", "platelet_count": "hematology", "rdw": "hematology",
    "reticulocyte_count": "hematology", "haptoglobin": "hematology",
    "erythropoietin": "hematology",
    # Kidney
    "creatinine": "kidney", "bun": "kidney", "uric_acid": "kidney", "egfr": "kidney",
    "creatinine_clearance": "kidney",
    # Liver
    "alt": "liver", "ast": "liver", "alp": "liver", "ggt": "liver",
    "bilirubin_total": "liver", "bilirubin_direct": "liver",
    "bilirubin_indirect": "liver", "albumin": "liver", "ammonia": "liver",
    "ldh": "liver", "total_protein": "liver", "globulin": "liver",
    # Electrolytes
    "sodium": "electrolyte", "potassium": "electrolyte", "chloride": "electrolyte",
    "calcium": "electrolyte", "magnesium": "electrolyte", "phosphorus": "electrolyte",
    "bicarbonate": "electrolyte", "ionized_calcium": "electrolyte",
    # Thyroid
    "tsh": "thyroid", "t4_total": "thyroid", "t4_free": "thyroid",
    "t3_total": "thyroid", "t3_free": "thyroid",
    # Coagulation
    "pt": "coagulation", "inr": "coagulation", "aptt": "coagulation",
    "fibrinogen": "coagulation", "d_dimer": "coagulation",
    "thrombin_time": "coagulation",
    # Cardiac
    "bnp": "cardiac", "troponin_i": "cardiac", "troponin_t": "cardiac",
    "creatine_kinase": "cardiac",
    # Hormones
    "cortisol_am": "general", "testosterone": "general", "estradiol": "general",
    "prolactin": "general", "pth": "electrolyte", "calcitonin": "general",
    "fsh": "general", "dhea_s": "general",
    # Inflammatory markers
    "esr": "inflammatory", "crp": "inflammatory", "procalcitonin": "inflammatory",
    "complement_c3": "inflammatory", "complement_c4": "inflammatory",
    "rheumatoid_factor": "inflammatory",
    # Vitamins
    "vitamin_b12": "general", "vitamin_d": "general", "folate": "general",
    # Pancreatic
    "amylase": "general", "lipase": "general",
    # Tumor markers
    "beta2_microglobulin": "general", "cea": "general",
    "ca_125": "general", "ca_19_9": "general",
    # Iron panel (separate from hematology to avoid polycythemia leakage)
    "iron": "iron_panel", "tibc": "iron_panel", "ferritin": "iron_panel",
    "transferrin": "iron_panel", "transferrin_saturation": "iron_panel",
    # Blood chemistry
    "prealbumin": "liver", "ceruloplasmin": "general",
    "osmolality_serum": "general", "copper": "general", "zinc": "general",
    # Urinalysis
    "urine_protein": "kidney", "urine_glucose": "glucose",
    "urine_specific_gravity": "kidney", "urine_ph": "kidney",
}

# ─── Conclusion templates ────────────────────────────────────────────────────
CONCLUSIONS = {
    "Normal": [
        "Normal. No immediate clinical action required.",
        "Normal. Result is within expected reference range.",
        "Normal. Continue routine monitoring as scheduled.",
    ],
    "Low": [
        "Low. Follow-up testing recommended.",
        "Low. Clinical correlation advised.",
        "Low. Further evaluation may be warranted.",
    ],
    "High": [
        "High. Follow-up testing recommended.",
        "High. Clinical correlation advised.",
        "High. Further evaluation may be warranted.",
    ],
    "Critical Low": [
        "Critical Low. Immediate clinical attention required.",
        "Critical Low. Urgent follow-up recommended.",
        "Critical Low. Immediate medical evaluation needed.",
    ],
    "Critical High": [
        "Critical High. Immediate clinical attention required.",
        "Critical High. Urgent follow-up recommended.",
        "Critical High. Immediate medical evaluation needed.",
    ],
}


# =============================================================================
# Core Functions
# =============================================================================

def load_biomarkers():
    """Load biomarker definitions from biomarkers.json"""
    try:
        with open(INPUT_FILE, 'r') as f:
            data = json.load(f)
            return data.get('biomarkers', [])
    except FileNotFoundError:
        print(f"❌ Error: Could not find {INPUT_FILE}")
        sys.exit(1)


def generate_patient_profile():
    """Generate a random patient (sex + age 18-85)"""
    sex = random.choice(["male", "female"])
    age = random.randint(18, 85)
    return {"sex": sex, "age": age}


def get_recommendations(biomarker_id, status):
    """Get 2 clinical recommendations.
    Fix 3: Check biomarker-specific overrides FIRST, then fall back to category.
    """
    if status in ["High", "Critical High"]:
        direction = "high"
    elif status in ["Low", "Critical Low"]:
        direction = "low"
    else:
        return []

    # 1. Biomarker-specific override (highest priority)
    if biomarker_id in BIOMARKER_RECOMMENDATIONS:
        specific = BIOMARKER_RECOMMENDATIONS[biomarker_id].get(direction, [])
        if specific:
            return random.sample(specific, min(2, len(specific)))

    # 2. Category-based fallback
    category = CATEGORY_MAP.get(biomarker_id, "general")
    key = f"{category}_{direction}" if f"{category}_{direction}" in RECOMMENDATIONS else f"general_{direction}"
    recs = RECOMMENDATIONS.get(key, [])
    return random.sample(recs, min(2, len(recs)))


def generate_value_for_range(ref_range, biomarker):
    """
    Generate a value with weighted random status.
    Returns (value_string, status_label).
    """
    critical_values = biomarker.get("critical_values", {})
    has_crit_high = critical_values.get("critical_high") is not None
    has_crit_low = critical_values.get("critical_low") is not None

    # Build status options and weights dynamically
    statuses = ["normal", "low", "high"]
    weights = [
        STATUS_WEIGHTS["base"]["normal"],
        STATUS_WEIGHTS["base"]["low"],
        STATUS_WEIGHTS["base"]["high"],
    ]

    if has_crit_high:
        statuses.append("critical_high")
        weights.append(STATUS_WEIGHTS["critical_high"])
    if has_crit_low:
        statuses.append("critical_low")
        weights.append(STATUS_WEIGHTS["critical_low"])

    status = random.choices(statuses, weights=weights)[0]

    low = ref_range.get("low")
    high = ref_range.get("high")
    critical_low = critical_values.get("critical_low")
    critical_high = critical_values.get("critical_high")

    # Handle None bounds
    effective_low = low if low is not None else 0
    effective_high = high if high is not None else 100
    span = effective_high - effective_low if effective_high > effective_low else 10

    if status == "normal":
        if low is not None and high is not None:
            pad = span * 0.05
            val = random.uniform(low + pad, high - pad)
        elif high is not None:
            val = random.uniform(high * 0.3, high * 0.85)
        elif low is not None:
            val = random.uniform(low * 1.1, low * 2.0)
        else:
            val = random.uniform(50, 100)
        interp = "Normal"

    elif status == "low":
        if low is None or low <= 0:
            if low is not None and high is not None:
                pad = span * 0.05
                val = random.uniform(low + pad, high - pad)
            elif high is not None:
                val = random.uniform(high * 0.3, high * 0.85)
            else:
                val = random.uniform(50, 100)
            interp = "Normal"
        else:
            floor = critical_low if critical_low is not None else max(0.1, low - span)
            val = random.uniform(max(floor, low - span * 0.3), low - span * 0.05 - 0.01)
            val = max(0.1, val)
            interp = "Low"

    elif status == "high":
        if high is None:
            if low is not None:
                val = random.uniform(low * 1.1, low * 2.0)
            else:
                val = random.uniform(50, 100)
            interp = "Normal"
        else:
            ceiling = critical_high if critical_high is not None else high + span
            val = random.uniform(high + span * 0.05 + 0.01, min(ceiling, high + span * 0.3))
            interp = "High"

    elif status == "critical_high":
        if critical_high is not None:
            val = random.uniform(critical_high, critical_high * 1.5)
            interp = "Critical High"
        elif high is not None:
            val = high * random.uniform(1.8, 2.5)
            interp = "Critical High"
        else:
            if low is not None:
                val = random.uniform(low * 1.1, low * 2.0)
            else:
                val = random.uniform(50, 100)
            interp = "Normal"

    else:  # critical_low
        if critical_low is not None:
            val = random.uniform(max(0.01, critical_low * 0.3), critical_low)
            interp = "Critical Low"
        elif low is not None and low > 0:
            val = low * random.uniform(0.1, 0.4)
            val = max(0.01, val)
            interp = "Critical Low"
        else:
            if high is not None:
                val = random.uniform(0.01, high * 0.9) if high > 0 else random.uniform(50, 100)
            else:
                val = random.uniform(50, 100)
            interp = "Normal"

    # Format value
    if val < 0.1:
        val_str = f"{val:.3f}"
    elif val < 10:
        val_str = f"{val:.2f}"
    elif val < 100:
        val_str = f"{val:.1f}"
    else:
        val_str = f"{val:.0f}"

    # Post-format validation: re-validate after rounding
    displayed_val = float(val_str)

    if interp == "Normal":
        if low is not None and displayed_val < low:
            if critical_low is not None and displayed_val <= critical_low:
                interp = "Critical Low"
            else:
                interp = "Low"
        elif high is not None and displayed_val > high:
            if critical_high is not None and displayed_val >= critical_high:
                interp = "Critical High"
            else:
                interp = "High"
    elif interp == "Low":
        if low is not None and displayed_val >= low:
            interp = "Normal"
        elif critical_low is not None and displayed_val <= critical_low:
            interp = "Critical Low"
    elif interp == "High":
        if high is not None and displayed_val <= high:
            interp = "Normal"
        elif critical_high is not None and displayed_val >= critical_high:
            interp = "Critical High"
    elif interp == "Critical Low":
        if critical_low is not None and displayed_val > critical_low:
            if low is not None and displayed_val < low:
                interp = "Low"
            elif low is not None and displayed_val >= low:
                interp = "Normal"
    elif interp == "Critical High":
        if critical_high is not None and displayed_val < critical_high:
            if high is not None and displayed_val > high:
                interp = "High"
            elif high is not None and displayed_val <= high:
                interp = "Normal"

    return val_str, interp


def create_example(biomarker, patient):
    """Create a single training example with enriched response format"""

    # Find applicable reference range
    applicable_range = None
    for r in biomarker.get("reference_ranges", []):
        cond = r.get("conditions", {})
        if cond.get("sex") and cond.get("sex") != patient["sex"]:
            continue
        if cond.get("age_min") and patient["age"] < cond["age_min"]:
            continue
        if cond.get("age_max") and patient["age"] > cond["age_max"]:
            continue
        applicable_range = r
        break

    if not applicable_range:
        return None

    val_str, status_label = generate_value_for_range(applicable_range, biomarker)

    # Build reference range string
    low = applicable_range.get('low')
    high = applicable_range.get('high')

    if low is not None and high is not None:
        range_str = f"{low}-{high}"
    elif low is not None:
        range_str = f">{low}"
    elif high is not None:
        range_str = f"<{high}"
    else:
        range_str = "N/A"

    # Build interpretation text from biomarkers.json
    # Fix 5/6: Use critical_low/critical_high interpretation keys when available
    interp_data = applicable_range.get("interpretation", {})
    if status_label == "Critical Low":
        base_interp = interp_data.get("critical_low",
                      interp_data.get("low", "Below the normal reference range. Critically low value."))
        assessment = f"{status_label}. {base_interp}"
    elif status_label == "Critical High":
        base_interp = interp_data.get("critical_high",
                      interp_data.get("high", "Above the normal reference range. Critically high value."))
        assessment = f"{status_label}. {base_interp}"
    elif status_label == "Low":
        base_interp = interp_data.get("low", "Below the normal reference range.")
        assessment = f"{status_label}. {base_interp}"
    elif status_label == "High":
        base_interp = interp_data.get("high", "Above the normal reference range.")
        assessment = f"{status_label}. {base_interp}"
    else:
        base_interp = interp_data.get("normal", "Within normal limits.")
        assessment = base_interp

    # Get 2 recommendations for abnormal results
    recommendations = get_recommendations(biomarker["id"], status_label)
    rec_text = ""
    if recommendations:
        rec_text = "\n\n**Recommendations:**\n" + "\n".join(f"- {r}" for r in recommendations)

    # Critical value warning
    critical_warning = ""
    if "Critical" in status_label:
        critical_warning = "\n\n⚠️ **CRITICAL VALUE** - Immediate medical attention may be required."

    # Clinical context for conditional ranges (fasting, etc.)
    conditions = applicable_range.get("conditions", {})
    context_line = ""
    if conditions.get("state"):
        context_line = f"\nCondition: {conditions['state'].capitalize()}"

    # Conclusion line (NEW: anchors the status keyword at the end)
    conclusion = random.choice(CONCLUSIONS.get(status_label, ["Follow up with healthcare provider."]))

    # Build critical thresholds line for input
    critical_values = biomarker.get('critical_values', {})
    crit_low_val = critical_values.get('critical_low')
    crit_high_val = critical_values.get('critical_high')
    crit_parts = []
    if crit_low_val is not None:
        crit_parts.append(f"Critical Low: {crit_low_val}")
    if crit_high_val is not None:
        crit_parts.append(f"Critical High: {crit_high_val}")
    crit_line = ""
    if crit_parts:
        crit_line = f"\nCritical Thresholds: {' | '.join(crit_parts)} {biomarker['reference_unit']}"

    # ─── Build explicit comparison line (Fix: reduces numerical hallucinations) ─
    unit = biomarker['reference_unit']
    try:
        val_num = float(val_str)
    except ValueError:
        val_num = None

    comparison_line = ""
    if val_num is not None:
        if status_label == "Critical Low" and crit_low_val is not None:
            comparison_line = f"\n\n**Comparison:** {val_str} {unit} is at or below the critical low threshold of {crit_low_val} {unit}."
        elif status_label == "Critical High" and crit_high_val is not None:
            comparison_line = f"\n\n**Comparison:** {val_str} {unit} is at or above the critical high threshold of {crit_high_val} {unit}."
        elif status_label == "Low" and low is not None:
            comparison_line = f"\n\n**Comparison:** {val_str} {unit} is below the lower limit of {low} {unit}."
        elif status_label == "High" and high is not None:
            comparison_line = f"\n\n**Comparison:** {val_str} {unit} is above the upper limit of {high} {unit}."
        elif status_label == "Normal":
            if low is not None and high is not None:
                comparison_line = f"\n\n**Comparison:** {val_str} {unit} is within the reference range of {low}-{high} {unit}."
            elif high is not None:
                comparison_line = f"\n\n**Comparison:** {val_str} {unit} is below the upper limit of {high} {unit}."
            elif low is not None:
                comparison_line = f"\n\n**Comparison:** {val_str} {unit} is above the lower limit of {low} {unit}."

    # ─── Construct the Prompt (User Input) ─────────────────────────────────
    # KEY CHANGE: Reference range is now IN the input, so the model
    # doesn't need to memorize 119 different ranges from training data.
    prompt = f"""Patient: {patient['sex'].capitalize()}, {patient['age']} years old.{context_line}
Test: {biomarker['canonical_name']} ({biomarker['id']})
Result: {val_str} {biomarker['reference_unit']}
Reference Range: {range_str} {biomarker['reference_unit']}{crit_line}"""

    # ─── Construct the Response (Assistant Output) ─────────────────────────
    # The response echoes the values and provides interpretation.
    response = f"""**Analysis:**
- **Result:** {val_str} {biomarker['reference_unit']}
- **Reference Range ({patient['sex'].capitalize()}):** {range_str} {biomarker['reference_unit']}
- **Status:** {status_label}{comparison_line}

**Interpretation:**
{assessment}{critical_warning}{rec_text}

**Conclusion:**
{conclusion}"""

    return {
        "instruction": "You are a medical lab interpreter. Analyze the result based on the provided reference ranges.",
        "input": prompt,
        "output": response
    }


def validate_example_against_abim(example, biomarkers_map):
    """
    Cross-validate a single example's status against ABIM ranges.
    Returns (is_valid, error_message).
    """
    input_text = example["input"]
    output_text = example["output"]

    # Extract biomarker ID
    bm_id = None
    for line in input_text.split("\n"):
        if line.startswith("Test:") and "(" in line and ")" in line:
            bm_id = line.split("(")[1].split(")")[0]
            break

    if not bm_id or bm_id not in biomarkers_map:
        return False, f"Biomarker {bm_id} not found"

    # Extract value
    val = None
    for line in input_text.split("\n"):
        if line.startswith("Result:"):
            parts = line.replace("Result:", "").strip().split()
            try:
                val = float(parts[0])
            except (ValueError, IndexError):
                return False, f"Cannot parse value from: {line}"
            break

    if val is None:
        return False, "No value found"

    # Extract patient sex and age
    sex = None
    age = None
    for line in input_text.split("\n"):
        if line.startswith("Patient:"):
            text = line.replace("Patient:", "").strip()
            parts = text.split(",")
            if len(parts) >= 2:
                sex = parts[0].strip().lower().rstrip(".")
                age_str = parts[1].strip().split()[0]
                try:
                    age = int(age_str)
                except ValueError:
                    pass
            break

    # Extract status from output
    output_status = None
    for line in output_text.split("\n"):
        if "**Status:**" in line:
            output_status = line.split("**Status:**")[1].strip()
            break

    if not output_status:
        return False, "No status found in output"

    # Find applicable ABIM range
    bm = biomarkers_map[bm_id]
    applicable = None
    for r in bm.get("reference_ranges", []):
        cond = r.get("conditions", {})
        if cond.get("sex") and sex and cond["sex"] != sex:
            continue
        if cond.get("age_min") and age and age < cond["age_min"]:
            continue
        if cond.get("age_max") and age and age > cond["age_max"]:
            continue
        applicable = r
        break

    if not applicable:
        return False, f"No applicable range for {sex}, age {age}"

    # Calculate expected status
    low = applicable.get("low")
    high = applicable.get("high")
    crit = bm.get("critical_values", {})
    crit_low = crit.get("critical_low")
    crit_high = crit.get("critical_high")

    expected = "Normal"
    if crit_low is not None and val <= crit_low:
        expected = "Critical Low"
    elif low is not None and val < low:
        expected = "Low"
    elif crit_high is not None and val >= crit_high:
        expected = "Critical High"
    elif high is not None and val > high:
        expected = "High"

    if output_status != expected:
        return False, f"Status mismatch: output='{output_status}' expected='{expected}' (val={val}, range={low}-{high}, crit={crit_low}/{crit_high})"

    return True, ""


# =============================================================================
# Main
# =============================================================================

def generate_boundary_example(biomarker, patient, biomarkers_map):
    """Generate an example with value near a threshold boundary (±1% of cutoff).
    Fix 6: Improves model's ability to classify values near decision boundaries.
    """
    applicable_range = None
    for r in biomarker.get("reference_ranges", []):
        cond = r.get("conditions", {})
        if cond.get("sex") and cond.get("sex") != patient["sex"]:
            continue
        if cond.get("age_min") and patient["age"] < cond["age_min"]:
            continue
        if cond.get("age_max") and patient["age"] > cond["age_max"]:
            continue
        applicable_range = r
        break

    if not applicable_range:
        return None

    low = applicable_range.get('low')
    high = applicable_range.get('high')

    # Pick a boundary to target
    boundaries = []
    if low is not None and low > 0:
        epsilon = max(0.01, low * 0.01)  # ±1%
        boundaries.append(("just_below_low", low - epsilon, "Low"))
        boundaries.append(("just_above_low", low + epsilon, "Normal"))
    if high is not None:
        epsilon = max(0.01, high * 0.01)  # ±1%
        boundaries.append(("just_below_high", high - epsilon, "Normal"))
        boundaries.append(("just_above_high", high + epsilon, "High"))

    if not boundaries:
        return None

    name, val, expected_status = random.choice(boundaries)

    # Format value
    if val < 0.1:
        val_str = f"{val:.3f}"
    elif val < 10:
        val_str = f"{val:.2f}"
    elif val < 100:
        val_str = f"{val:.1f}"
    else:
        val_str = f"{val:.0f}"

    # Re-validate status after formatting
    displayed_val = float(val_str)
    critical_values = biomarker.get("critical_values", {})
    crit_low = critical_values.get("critical_low")
    crit_high = critical_values.get("critical_high")

    status_label = "Normal"
    if crit_low is not None and displayed_val <= crit_low:
        status_label = "Critical Low"
    elif low is not None and displayed_val < low:
        status_label = "Low"
    elif crit_high is not None and displayed_val >= crit_high:
        status_label = "Critical High"
    elif high is not None and displayed_val > high:
        status_label = "High"

    # Build the example using the same format as create_example
    if low is not None and high is not None:
        range_str = f"{low}-{high}"
    elif low is not None:
        range_str = f">{low}"
    elif high is not None:
        range_str = f"<{high}"
    else:
        range_str = "N/A"

    interp_data = applicable_range.get("interpretation", {})
    if status_label == "Critical Low":
        base_interp = interp_data.get("critical_low",
                      interp_data.get("low", "Below the normal reference range. Critically low value."))
        assessment = f"{status_label}. {base_interp}"
    elif status_label == "Critical High":
        base_interp = interp_data.get("critical_high",
                      interp_data.get("high", "Above the normal reference range. Critically high value."))
        assessment = f"{status_label}. {base_interp}"
    elif status_label == "Low":
        base_interp = interp_data.get("low", "Below the normal reference range.")
        assessment = f"{status_label}. {base_interp}"
    elif status_label == "High":
        base_interp = interp_data.get("high", "Above the normal reference range.")
        assessment = f"{status_label}. {base_interp}"
    else:
        base_interp = interp_data.get("normal", "Within normal limits.")
        assessment = base_interp

    recommendations = get_recommendations(biomarker["id"], status_label)
    rec_text = ""
    if recommendations:
        rec_text = "\n\n**Recommendations:**\n" + "\n".join(f"- {r}" for r in recommendations)

    critical_warning = ""
    if "Critical" in status_label:
        critical_warning = "\n\n⚠️ **CRITICAL VALUE** - Immediate medical attention may be required."

    conditions = applicable_range.get("conditions", {})
    context_line = ""
    if conditions.get("state"):
        context_line = f"\nCondition: {conditions['state'].capitalize()}"

    conclusion = random.choice(CONCLUSIONS.get(status_label, ["Follow up with healthcare provider."]))

    crit_parts = []
    if crit_low is not None:
        crit_parts.append(f"Critical Low: {crit_low}")
    if crit_high is not None:
        crit_parts.append(f"Critical High: {crit_high}")
    crit_line = ""
    if crit_parts:
        crit_line = f"\nCritical Thresholds: {' | '.join(crit_parts)} {biomarker['reference_unit']}"

    prompt = f"""Patient: {patient['sex'].capitalize()}, {patient['age']} years old.{context_line}
Test: {biomarker['canonical_name']} ({biomarker['id']})
Result: {val_str} {biomarker['reference_unit']}
Reference Range: {range_str} {biomarker['reference_unit']}{crit_line}"""

    # Build explicit comparison line (matches create_example format)
    unit = biomarker['reference_unit']
    comparison_line = ""
    if status_label == "Critical Low" and crit_low is not None:
        comparison_line = f"\n\n**Comparison:** {val_str} {unit} is at or below the critical low threshold of {crit_low} {unit}."
    elif status_label == "Critical High" and crit_high is not None:
        comparison_line = f"\n\n**Comparison:** {val_str} {unit} is at or above the critical high threshold of {crit_high} {unit}."
    elif status_label == "Low" and low is not None:
        comparison_line = f"\n\n**Comparison:** {val_str} {unit} is below the lower limit of {low} {unit}."
    elif status_label == "High" and high is not None:
        comparison_line = f"\n\n**Comparison:** {val_str} {unit} is above the upper limit of {high} {unit}."
    elif status_label == "Normal":
        if low is not None and high is not None:
            comparison_line = f"\n\n**Comparison:** {val_str} {unit} is within the reference range of {low}-{high} {unit}."
        elif high is not None:
            comparison_line = f"\n\n**Comparison:** {val_str} {unit} is below the upper limit of {high} {unit}."
        elif low is not None:
            comparison_line = f"\n\n**Comparison:** {val_str} {unit} is above the lower limit of {low} {unit}."

    response = f"""**Analysis:**
- **Result:** {val_str} {biomarker['reference_unit']}
- **Reference Range ({patient['sex'].capitalize()}):** {range_str} {biomarker['reference_unit']}
- **Status:** {status_label}{comparison_line}

**Interpretation:**
{assessment}{critical_warning}{rec_text}

**Conclusion:**
{conclusion}"""

    return {
        "instruction": "You are a medical lab interpreter. Analyze the result based on the provided reference ranges.",
        "input": prompt,
        "output": response
    }


def main():
    random.seed(42)

    biomarkers = load_biomarkers()
    if not biomarkers:
        return

    biomarkers_map = {b["id"]: b for b in biomarkers}

    # Ensure output directory exists
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    # ─── Phase 1: Generate main examples ──────────────────────────────────────
    MAIN_COUNT = NUM_EXAMPLES - 300  # Reserve 300 for boundary examples
    dataset = []
    status_counts = {"Normal": 0, "High": 0, "Low": 0, "Critical High": 0, "Critical Low": 0}
    biomarker_counts = {}

    print(f"🧬 Generating {MAIN_COUNT} main + 300 boundary = {NUM_EXAMPLES} total examples...")
    print(f"   Critical weights: High={STATUS_WEIGHTS['critical_high']*100:.0f}%, Low={STATUS_WEIGHTS['critical_low']*100:.0f}%")

    count = 0
    max_attempts = MAIN_COUNT * 3
    attempts = 0

    while count < MAIN_COUNT and attempts < max_attempts:
        attempts += 1
        bm = random.choice(biomarkers)
        if bm['id'] in SKIP_BIOMARKERS:
            continue
        pt = generate_patient_profile()
        example = create_example(bm, pt)
        if example:
            dataset.append(example)
            count += 1

            bm_id = bm['id']
            biomarker_counts[bm_id] = biomarker_counts.get(bm_id, 0) + 1

            for part in example['output'].split('\n'):
                if '**Status:**' in part:
                    status = part.split('**Status:**')[1].strip()
                    status_counts[status] = status_counts.get(status, 0) + 1

            if count % 1000 == 0:
                print(f"  Generated {count}/{MAIN_COUNT} main examples...")

    print(f"  Generated {count}/{MAIN_COUNT} main examples ✓")

    # ─── Phase 2: Generate boundary-focused examples (Fix 6) ──────────────────
    print(f"  Generating 300 boundary examples...")
    boundary_count = 0
    boundary_attempts = 0
    while boundary_count < 300 and boundary_attempts < 1500:
        boundary_attempts += 1
        bm = random.choice(biomarkers)
        if bm['id'] in SKIP_BIOMARKERS:
            continue
        pt = generate_patient_profile()
        example = generate_boundary_example(bm, pt, biomarkers_map)
        if example:
            dataset.append(example)
            boundary_count += 1

            bm_id = bm['id']
            biomarker_counts[bm_id] = biomarker_counts.get(bm_id, 0) + 1

            for part in example['output'].split('\n'):
                if '**Status:**' in part:
                    status = part.split('**Status:**')[1].strip()
                    status_counts[status] = status_counts.get(status, 0) + 1

    print(f"  Generated {boundary_count} boundary examples ✓")

    # ─── Fix 4: Deduplicate by INPUT text (not full row) ──────────────────────
    # Keep only the first output for each unique input prompt.
    seen_inputs = set()
    unique_dataset = []
    input_dupes = 0
    for entry in dataset:
        inp = entry['input']
        if inp not in seen_inputs:
            seen_inputs.add(inp)
            unique_dataset.append(entry)
        else:
            input_dupes += 1
    if input_dupes > 0:
        print(f"⚠️  Removed {input_dupes} duplicate-input rows (keeping first output per input)")
    dataset = unique_dataset

    # ─── ABIM Cross-Validation ────────────────────────────────────────────────
    print(f"\n🔍 Running ABIM cross-validation on {len(dataset)} examples...")
    errors = []
    for i, example in enumerate(dataset):
        valid, msg = validate_example_against_abim(example, biomarkers_map)
        if not valid:
            errors.append(f"  Example {i+1}: {msg}")

    if errors:
        print(f"❌ ABIM VALIDATION FAILED — {len(errors)} mismatches found:")
        for err in errors[:20]:
            print(err)
        if len(errors) > 20:
            print(f"  ... and {len(errors) - 20} more")
        print("\n🛑 Aborting. Fix the errors before proceeding.")
        sys.exit(1)
    else:
        print(f"✅ ABIM validation passed — all {len(dataset)} examples correct!")

    # ─── Fix 4: Split by UNIQUE INPUT to ensure 0 train/eval overlap ──────────
    random.shuffle(dataset)
    split_idx = int(len(dataset) * TRAIN_SPLIT)
    train_data = dataset[:split_idx]
    eval_data = dataset[split_idx:]

    # Verify zero overlap
    train_inputs = set(ex['input'] for ex in train_data)
    eval_inputs = set(ex['input'] for ex in eval_data)
    overlap = train_inputs & eval_inputs
    if overlap:
        print(f"⚠️  Found {len(overlap)} train/eval overlapping inputs — removing from eval")
        eval_data = [ex for ex in eval_data if ex['input'] not in train_inputs]

    print(f"  Train/eval input overlap: {len(overlap)} (should be 0)")

    # Save train set
    with open(OUTPUT_FILE, 'w') as f:
        for entry in train_data:
            f.write(json.dumps(entry) + "\n")

    # Save eval set
    with open(EVAL_FILE, 'w') as f:
        for entry in eval_data:
            f.write(json.dumps(entry) + "\n")

    # ─── Report ───────────────────────────────────────────────────────────────
    print(f"\n✅ Done!")
    print(f"📁 Training set: {OUTPUT_FILE} ({len(train_data)} examples)")
    print(f"📁 Eval set:     {EVAL_FILE} ({len(eval_data)} examples)")
    print(f"\n📊 Status Distribution:")
    total = sum(status_counts.values())
    for status, cnt in sorted(status_counts.items()):
        pct = cnt / total * 100 if total > 0 else 0
        print(f"  {status:15s}: {cnt:5d} ({pct:.1f}%)")
    print(f"\n🧪 Biomarkers covered: {len(biomarker_counts)}/{len(biomarkers)}")
    print(f"📊 Boundary examples: {boundary_count}")

    missing = set(b['id'] for b in biomarkers if b['id'] not in SKIP_BIOMARKERS) - set(biomarker_counts.keys())
    if missing:
        print(f"⚠️  Missing biomarkers: {missing}")
    else:
        print(f"✅ All biomarkers represented!")


if __name__ == "__main__":
    main()
