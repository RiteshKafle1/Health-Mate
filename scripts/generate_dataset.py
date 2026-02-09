import json
import random
import datetime

# Configuration
INPUT_FILE = "../backend_fastapi/data/biomarkers.json"
OUTPUT_FILE = "train_dataset.jsonl"
NUM_EXAMPLES = 1200  # Generate plenty of data

def load_biomarkers():
    try:
        with open(INPUT_FILE, 'r') as f:
            data = json.load(f)
            return data.get('biomarkers', [])
    except FileNotFoundError:
        print(f"Error: Could not find {INPUT_FILE}. Please run this script from the 'scripts' directory or adjust path.")
        return []

def generate_patient_profile():
    sex = random.choice(["male", "female"])
    age = random.randint(18, 85)
    return {"sex": sex, "age": age}

def generate_value_for_range(ref_range, condition):
    # Determine if we want a Low, Normal, or High value
    status = random.choice(["low", "normal", "high", "critical_high", "critical_low"])
    
    low = ref_range.get("low")
    high = ref_range.get("high")
    
    # Handle missing bounds (e.g. "high only" ranges)
    if low is None: low = 0
    if high is None: high = 100 # Arbitrary fallback
    
    span = high - low
    
    if status == "normal":
        if high is None: val = low + 5
        elif low is None: val = high - 5
        else: val = random.uniform(low, high)
        interp = "Normal"
    elif status == "low":
        if low is None: 
             val = random.uniform(0, high) # Actually normal if no low bound
             interp = "Normal"
        else:
            val = low - (span * 0.2)
            interp = "Low"
    elif status == "high":
        if high is None:
            val = low + (span * 1.5) # Actually normal
            interp = "Normal"
        else: 
            val = high + (span * 0.2)
            interp = "High"
    elif status == "critical_high":
        val = high * 1.5 if high else 500
        interp = "Critical High"
    else: # critical_low
        val = low * 0.5 if low else 0
        interp = "Critical Low"
        
    # Formatting
    if val < 10:
        val_str = f"{val:.2f}"
    else:
        val_str = f"{val:.1f}"
        
    return val_str, interp

def create_example(biomarker, patient):
    # Find applicable range
    applicable_range = None
    for r in biomarker.get("reference_ranges", []):
        cond = r.get("conditions", {})
        # Simple match for sex
        if cond.get("sex") and cond.get("sex") != patient["sex"]:
            continue
        applicable_range = r
        break
    
    if not applicable_range:
        return None

    val_str, status_label = generate_value_for_range(applicable_range, None) # helper handles random
    
    # Construct the Prompt (User Input)
    prompt = f"""Patient: {patient['sex'].capitalize()}, {patient['age']} years old.
Test: {biomarker['canonical_name']} ({biomarker['id']})
Result: {val_str} {biomarker['reference_unit']}"""

    # Construct the Response (Assistant Output)
    # This is where we "Teach" the logic
    low = applicable_range.get('low')
    high = applicable_range.get('high')
    range_str = f"{low}-{high}" if (low and high) else (f">{low}" if low else f"<{high}")
    
    assessment = "Within normal limits."
    if status_label in ["Low", "Critical Low"]:
        base_interp = applicable_range.get("interpretation", {}).get("low", "Below normal range.")
        assessment = f"{status_label}. {base_interp}"
    elif status_label in ["High", "Critical High"]:
        base_interp = applicable_range.get("interpretation", {}).get("high", "Above normal range.")
        assessment = f"{status_label}. {base_interp}"

    response = f"""**Analysis:**
- **Result:** {val_str} {biomarker['reference_unit']}
- **Reference Range ({patient['sex'].capitalize()}):** {range_str} {biomarker['reference_unit']}
- **Status:** {status_label}

**Interpretation:**
{assessment}"""

    return {
        "instruction": "You are a medical lab interpreter. Analyze the result based on general reference ranges.",
        "input": prompt,
        "output": response
    }

def main():
    biomarkers = load_biomarkers()
    if not biomarkers: return

    dataset = []
    print(f"Generating {NUM_EXAMPLES} examples from {len(biomarkers)} biomarkers...")
    
    count = 0
    while count < NUM_EXAMPLES:
        bm = random.choice(biomarkers)
        pt = generate_patient_profile()
        example = create_example(bm, pt)
        if example:
            dataset.append(example)
            count += 1
            
    with open(OUTPUT_FILE, 'w') as f:
        for entry in dataset:
            f.write(json.dumps(entry) + "\n")
            
    print(f"Done! Saved to {OUTPUT_FILE}")

if __name__ == "__main__":
    main()
