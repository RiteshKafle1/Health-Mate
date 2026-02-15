#!/usr/bin/env python3
"""
Qwen 2.5-3B-Instruct Fine-Tuning Script for Medical Lab Interpretation
=======================================================================
Optimized for Google Colab T4 GPU (16GB VRAM).

Changes from DeepSeek 1.5B version:
  - Model: Qwen2.5-3B-Instruct (2x capacity → less hallucination)
  - Batch: 2 per device × 8 accumulation = 16 effective
  - Epochs: 5 (was 4)
  - Inference: max_new_tokens=384, temperature=0.01

HOW TO USE ON COLAB:
  Copy each cell (marked with ## Cell N) into a separate Colab cell.
"""

# ============================================================================
# ## Cell 1: Install Dependencies
# ============================================================================
# !pip install -q "unsloth[colab-new]" "trl>=0.12.1" peft accelerate bitsandbytes

# ============================================================================
# ## Cell 2: Load Model — Qwen 2.5-3B-Instruct (4-bit quantized)
# ============================================================================
import torch
from unsloth import FastLanguageModel

MODEL_NAME = "unsloth/Qwen2.5-3B-Instruct-bnb-4bit"
MAX_SEQ_LENGTH = 2048
LOAD_IN_4BIT = True

model, tokenizer = FastLanguageModel.from_pretrained(
    model_name=MODEL_NAME,
    max_seq_length=MAX_SEQ_LENGTH,
    load_in_4bit=LOAD_IN_4BIT,
    dtype=None,  # Auto-detect
)

print(f"✅ Model loaded: {MODEL_NAME}")
print(f"   Parameters: ~3B")
print(f"   Quantization: 4-bit")
print(f"   Max sequence length: {MAX_SEQ_LENGTH}")

# ============================================================================
# ## Cell 3: Apply LoRA Adapters
# ============================================================================
model = FastLanguageModel.get_peft_model(
    model,
    r=32,
    lora_alpha=64,
    lora_dropout=0,
    target_modules=[
        "q_proj", "k_proj", "v_proj", "o_proj",
        "gate_proj", "up_proj", "down_proj",
    ],
    bias="none",
    use_gradient_checkpointing="unsloth",
    random_state=3407,
)

model.print_trainable_parameters()

# ============================================================================
# ## Cell 4: Prepare Dataset
# ============================================================================
from datasets import load_dataset

CHATML_TEMPLATE = """<|im_start|>system
You are a medical lab interpreter. Analyze lab results based on the provided reference ranges and provide clinical interpretations with recommendations.
<|im_end|>
<|im_start|>user
{input}
<|im_end|>
<|im_start|>assistant
{output}
<|im_end|>"""


def format_example(example):
    """Format a single example into ChatML template for training"""
    text = CHATML_TEMPLATE.format(
        input=example["input"],
        output=example["output"]
    )
    return {"text": text}


# Upload train_dataset.jsonl and train_dataset_eval.jsonl to Colab first
# (from finetuning/qwen/datasets/)
train_dataset = load_dataset("json", data_files="train_dataset.jsonl", split="train")
eval_dataset = load_dataset("json", data_files="train_dataset_eval.jsonl", split="train")

train_dataset = train_dataset.map(format_example)
eval_dataset = eval_dataset.map(format_example)

print(f"✅ Dataset loaded")
print(f"   Train: {len(train_dataset)} examples")
print(f"   Eval:  {len(eval_dataset)} examples")

# ============================================================================
# ## Cell 5: Training Configuration & Train
# ============================================================================
from trl import SFTTrainer
from transformers import TrainingArguments

NUM_EPOCHS = 5
TOTAL_STEPS = (len(train_dataset) // (2 * 8)) * NUM_EPOCHS  # batch=2, accum=8

print(f"📊 Training Configuration:")
print(f"   Model:            Qwen2.5-3B-Instruct (4-bit)")
print(f"   Batch size:       2 per device")
print(f"   Grad accumulation: 8 steps")
print(f"   Effective batch:  16")
print(f"   Epochs:           {NUM_EPOCHS}")
print(f"   Total steps:      {TOTAL_STEPS}")
print(f"   Learning rate:    2e-4")
print(f"   Scheduler:        cosine")
print(f"   Optimizer:        adamw_8bit")

trainer = SFTTrainer(
    model=model,
    tokenizer=tokenizer,
    train_dataset=train_dataset,
    eval_dataset=eval_dataset,
    dataset_text_field="text",
    max_seq_length=MAX_SEQ_LENGTH,
    dataset_num_proc=2,
    packing=False,
    args=TrainingArguments(
        per_device_train_batch_size=2,
        gradient_accumulation_steps=8,
        max_steps=TOTAL_STEPS,
        learning_rate=2e-4,
        optim="adamw_8bit",
        weight_decay=0.01,
        lr_scheduler_type="cosine",
        warmup_steps=50,
        fp16=not torch.cuda.is_bf16_supported(),
        bf16=torch.cuda.is_bf16_supported(),
        logging_steps=25,
        save_steps=200,
        save_total_limit=2,
        output_dir="outputs_qwen3b",
        report_to="none",
        seed=3407,
        # ─── Evaluation (was missing → eval_dataset was silently unused) ───
        eval_strategy="steps",
        eval_steps=100,                    # Evaluate every 100 steps
        per_device_eval_batch_size=4,      # Larger batch OK for eval (no gradients)
        load_best_model_at_end=True,       # Auto-select checkpoint with lowest eval_loss
        metric_for_best_model="eval_loss",
    ),
)

print("\n🚀 Starting training...")
trainer_stats = trainer.train()
print(f"\n✅ Training complete!")
print(f"   Total training time: {trainer_stats.metrics['train_runtime']:.0f}s")
print(f"   Final loss: {trainer_stats.metrics['train_loss']:.4f}")

# ============================================================================
# ## Cell 6: Inference Tests (45 Cases with Hallucination Detection)
# ============================================================================
FastLanguageModel.for_inference(model)


def run_inference(patient_info, biomarker_name, biomarker_id, value, unit, ref_range, critical_thresholds=""):
    """Run a single inference test against the fine-tuned model.
    
    Args:
        ref_range: e.g. "70.0-100.0 mg/dL" — the ABIM reference range
        critical_thresholds: e.g. "Critical Low: 40.0 | Critical High: 400.0 mg/dL" (optional)
    """
    crit_line = f"\nCritical Thresholds: {critical_thresholds}" if critical_thresholds else ""
    prompt = f"""<|im_start|>system
You are a medical lab interpreter. Analyze lab results based on the provided reference ranges and provide clinical interpretations with recommendations.
<|im_end|>
<|im_start|>user
Patient: {patient_info}.
Test: {biomarker_name} ({biomarker_id})
Result: {value} {unit}
Reference Range: {ref_range}{crit_line}
<|im_end|>
<|im_start|>assistant
"""
    inputs = tokenizer(prompt, return_tensors="pt").to("cuda")
    outputs = model.generate(
        **inputs,
        max_new_tokens=384,       # Increased from 256 → fixes truncation
        temperature=0.01,         # Near-deterministic → fewer hallucinations
        do_sample=True,
    )
    response = tokenizer.decode(outputs[0], skip_special_tokens=False)
    assistant_text = response.split("<|im_start|>assistant")[-1]
    assistant_text = assistant_text.split("<|im_end|>")[0].strip()
    return assistant_text


# ─── Original 15 Test Cases ──────────────────────────────────────────────────
# Format: (name, patient_info, biomarker_name, biomarker_id, value, unit, ref_range, critical_thresholds, expected_status)
ORIGINAL_TEST_CASES = [
    ("Fasting Glucose - High",
     "Male, 55 years old", "Glucose, Fasting", "glucose_fasting",
     "145", "mg/dL", "70.0-100.0 mg/dL", "Critical Low: 40.0 | Critical High: 400.0 mg/dL", "High"),
    ("Hemoglobin - Critical Low",
     "Female, 30 years old", "Hemoglobin", "hemoglobin",
     "6.5", "g/dL", "12.0-16.0 g/dL", "Critical Low: 7.0 | Critical High: 20.0 g/dL", "Critical Low"),
    ("D-Dimer - High (Age-Adjusted)",
     "Male, 68 years old", "D-Dimer", "d_dimer",
     "1.8", "ug/mL", "<0.5 ug/mL", "", "High"),
    ("Total Cholesterol - Normal",
     "Female, 45 years old", "Cholesterol, Total", "cholesterol_total",
     "185", "mg/dL", "<200.0 mg/dL", "", "Normal"),
    ("TSH - High",
     "Female, 38 years old", "TSH", "tsh",
     "8.5", "uIU/mL", "0.4-4.0 uIU/mL", "", "High"),
    ("Creatinine - Normal",
     "Male, 42 years old", "Creatinine", "creatinine",
     "1.0", "mg/dL", "0.7-1.3 mg/dL", "", "Normal"),
    ("Potassium - Critical High",
     "Male, 60 years old", "Potassium", "potassium",
     "6.8", "mEq/L", "3.5-5.0 mEq/L", "Critical Low: 2.5 | Critical High: 6.0 mEq/L", "Critical High"),
    ("ALT - High",
     "Male, 50 years old", "ALT", "alt",
     "65", "U/L", "7.0-56.0 U/L", "", "High"),
    ("HbA1c - High",
     "Female, 55 years old", "HbA1c", "hba1c",
     "7.2", "%", "4.0-5.6 %", "", "High"),
    ("Ferritin - Low (Female)",
     "Female, 28 years old", "Ferritin", "ferritin",
     "8", "ng/mL", "12.0-150.0 ng/mL", "", "Low"),
    ("Vitamin D - Low",
     "Male, 35 years old", "Vitamin D", "vitamin_d",
     "18", "ng/mL", "30.0-100.0 ng/mL", "", "Low"),
    ("Sodium - Normal",
     "Female, 50 years old", "Sodium", "sodium",
     "140", "mEq/L", "136.0-145.0 mEq/L", "Critical Low: 120.0 | Critical High: 160.0 mEq/L", "Normal"),
    ("Platelet Count - Low",
     "Male, 65 years old", "Platelet Count", "platelet_count",
     "95", "x10^3/uL", "150.0-450.0 x10^3/uL", "Critical Low: 50.0 | Critical High: 1000.0 x10^3/uL", "Low"),
    ("Triglycerides - High (Fasting)",
     "Male, 48 years old", "Triglycerides", "triglycerides",
     "220", "mg/dL", "<150.0 mg/dL", "", "High"),
    ("WBC Count - Normal",
     "Female, 33 years old", "WBC Count", "wbc_count",
     "7.5", "x10^3/uL", "4.5-11.0 x10^3/uL", "Critical Low: 2.0 | Critical High: 30.0 x10^3/uL", "Normal"),
]

# ─── Extended 30 Test Cases ──────────────────────────────────────────────────
EXTENDED_TEST_CASES = [
    # Liver (4)
    ("AST - High", "Male, 48 years old", "Aspartate Aminotransferase", "ast", "55", "U/L", "10.0-40.0 U/L", "", "High"),
    ("ALP - Normal", "Female, 52 years old", "Alkaline Phosphatase", "alp", "95", "U/L", "44.0-147.0 U/L", "", "Normal"),
    ("Bilirubin Total - High", "Male, 40 years old", "Bilirubin, Total", "bilirubin_total", "2.5", "mg/dL", "0.1-1.2 mg/dL", "", "High"),
    ("Albumin - Low", "Female, 70 years old", "Albumin", "albumin", "2.8", "g/dL", "3.5-5.5 g/dL", "", "Low"),
    # Kidney (4)
    ("BUN - High", "Male, 65 years old", "Blood Urea Nitrogen", "bun", "28", "mg/dL", "7.0-20.0 mg/dL", "", "High"),
    ("eGFR - Low", "Female, 72 years old", "Estimated Glomerular Filtration Rate", "egfr", "45", "mL/min/1.73m²", ">60.0 mL/min/1.73m²", "", "Low"),
    ("Uric Acid - High", "Male, 55 years old", "Uric Acid", "uric_acid", "9.2", "mg/dL", "3.5-7.2 mg/dL", "", "High"),
    ("Creatinine Female - Normal", "Female, 35 years old", "Creatinine", "creatinine", "0.9", "mg/dL", "0.6-1.1 mg/dL", "", "Normal"),
    # Thyroid (3)
    ("TSH - Low", "Male, 45 years old", "Thyroid Stimulating Hormone", "tsh", "0.1", "uIU/mL", "0.4-4.0 uIU/mL", "", "Low"),
    ("Free T4 - High", "Female, 32 years old", "Thyroxine, Free", "t4_free", "2.5", "ng/dL", "0.8-1.8 ng/dL", "", "High"),
    ("Free T3 - Normal", "Male, 50 years old", "Triiodothyronine, Free", "t3_free", "3.1", "pg/mL", "2.3-4.2 pg/mL", "", "Normal"),
    # Iron Panel (3)
    ("Iron Serum - Low", "Female, 25 years old", "Iron, Serum", "iron", "35", "ug/dL", "50.0-170.0 ug/dL", "", "Low"),
    ("TIBC - High", "Female, 30 years old", "Total Iron Binding Capacity", "tibc", "420", "ug/dL", "250.0-400.0 ug/dL", "", "High"),
    ("Transferrin Saturation - Low", "Male, 40 years old", "Transferrin Saturation", "transferrin_saturation", "12", "%", "20.0-50.0 %", "", "Low"),
    # Cardiac (3)
    ("Troponin I - Critical High", "Male, 62 years old", "Troponin I", "troponin_i", "0.5", "ng/mL", "<0.04 ng/mL", "Critical High: 0.4 ng/mL", "Critical High"),
    ("BNP - High", "Female, 68 years old", "B-Type Natriuretic Peptide", "bnp", "350", "pg/mL", "<100.0 pg/mL", "", "High"),
    ("Creatine Kinase - Normal", "Male, 35 years old", "Creatine Kinase", "creatine_kinase", "120", "U/L", "30.0-200.0 U/L", "", "Normal"),
    # Coagulation (3)
    ("INR - High", "Male, 70 years old", "International Normalized Ratio", "inr", "2.5", "ratio", "0.8-1.2 ratio", "", "High"),
    ("PT - Normal", "Female, 45 years old", "Prothrombin Time", "pt", "12.0", "seconds", "11.0-13.5 seconds", "", "Normal"),
    ("Fibrinogen - Low", "Male, 55 years old", "Fibrinogen", "fibrinogen", "150", "mg/dL", "200.0-400.0 mg/dL", "", "Low"),
    # Electrolytes (3)
    ("Calcium - Critical Low", "Female, 60 years old", "Calcium", "calcium", "5.5", "mg/dL", "8.5-10.5 mg/dL", "Critical Low: 6.0 | Critical High: 13.0 mg/dL", "Critical Low"),
    ("Chloride - High", "Male, 50 years old", "Chloride", "chloride", "112", "mEq/L", "98.0-106.0 mEq/L", "", "High"),
    ("Magnesium - Low", "Female, 45 years old", "Magnesium", "magnesium", "1.1", "mg/dL", "1.7-2.2 mg/dL", "", "Low"),
    # Hematology (3)
    ("RBC Male - Low", "Male, 60 years old", "Red Blood Cell Count", "rbc_count", "3.8", "million/uL", "4.7-6.1 million/uL", "", "Low"),
    ("MCV - High", "Female, 55 years old", "Mean Corpuscular Volume", "mcv", "105", "fL", "80.0-100.0 fL", "", "High"),
    ("RDW - Normal", "Male, 40 years old", "Red Cell Distribution Width", "rdw", "12.5", "%", "11.5-14.5 %", "", "Normal"),
    # Hormones (2)
    ("Testosterone Male - Low", "Male, 58 years old", "Testosterone", "testosterone", "180", "ng/dL", "270.0-1070.0 ng/dL", "", "Low"),
    ("Cortisol AM - Normal", "Female, 35 years old", "Cortisol, Morning", "cortisol_am", "15", "ug/dL", "6.0-18.0 ug/dL", "", "Normal"),
    # Inflammatory/Pancreatic (2)
    ("CRP - High", "Male, 50 years old", "C-Reactive Protein", "crp", "3.5", "mg/dL", "<1.0 mg/dL", "", "High"),
    ("Lipase - High", "Female, 42 years old", "Lipase", "lipase", "250", "U/L", "0.0-160.0 U/L", "", "High"),
]

ALL_TEST_CASES = ORIGINAL_TEST_CASES + EXTENDED_TEST_CASES

# ─── Extended 100 Test Cases (ABIM-Validated, Common Biomarkers) ─────────────
# These focus on the most commonly ordered lab tests in daily clinical practice.
# Every expected_status has been cross-validated against biomarkers.json ABIM ranges.
EXTENDED_100_TEST_CASES = [
    # ═══ GLUCOSE (6) ══════════════════════════════════════════════════════════
    ("Glucose Normal Male",
     "Male, 40 years old", "Glucose, Fasting", "glucose_fasting",
     "88", "mg/dL", "70.0-99.0 mg/dL", "Critical Low: 40.0 | Critical High: 400.0 mg/dL", "Normal"),
    ("Glucose Normal Female",
     "Female, 35 years old", "Glucose, Fasting", "glucose_fasting",
     "92", "mg/dL", "70.0-99.0 mg/dL", "Critical Low: 40.0 | Critical High: 400.0 mg/dL", "Normal"),
    ("Glucose High Pre-diabetic",
     "Male, 52 years old", "Glucose, Fasting", "glucose_fasting",
     "118", "mg/dL", "70.0-99.0 mg/dL", "Critical Low: 40.0 | Critical High: 400.0 mg/dL", "High"),
    ("Glucose High Diabetic",
     "Female, 60 years old", "Glucose, Fasting", "glucose_fasting",
     "210", "mg/dL", "70.0-99.0 mg/dL", "Critical Low: 40.0 | Critical High: 400.0 mg/dL", "High"),
    ("Glucose Critical Low",
     "Male, 28 years old", "Glucose, Fasting", "glucose_fasting",
     "38", "mg/dL", "70.0-99.0 mg/dL", "Critical Low: 40.0 | Critical High: 400.0 mg/dL", "Critical Low"),
    ("Glucose Critical High",
     "Female, 65 years old", "Glucose, Fasting", "glucose_fasting",
     "420", "mg/dL", "70.0-99.0 mg/dL", "Critical Low: 40.0 | Critical High: 400.0 mg/dL", "Critical High"),
    # ═══ HbA1c (4) ═══════════════════════════════════════════════════════════
    ("HbA1c Normal",
     "Male, 45 years old", "HbA1c", "hba1c",
     "5.2", "%", "4.0-5.6 %", "", "Normal"),
    ("HbA1c Prediabetic",
     "Female, 50 years old", "HbA1c", "hba1c",
     "6.1", "%", "4.0-5.6 %", "", "High"),
    ("HbA1c Diabetic Range",
     "Male, 62 years old", "HbA1c", "hba1c",
     "8.5", "%", "4.0-5.6 %", "", "High"),
    ("HbA1c Low Normal",
     "Female, 30 years old", "HbA1c", "hba1c",
     "4.2", "%", "4.0-5.6 %", "", "Normal"),
    # ═══ CHOLESTEROL PANEL (8) ═══════════════════════════════════════════════
    ("Total Cholesterol Normal",
     "Male, 45 years old", "Cholesterol, Total", "cholesterol_total",
     "180", "mg/dL", "<200.0 mg/dL", "", "Normal"),
    ("Total Cholesterol High",
     "Female, 55 years old", "Cholesterol, Total", "cholesterol_total",
     "245", "mg/dL", "<200.0 mg/dL", "", "High"),
    ("LDL Normal",
     "Male, 40 years old", "LDL Cholesterol", "ldl",
     "90", "mg/dL", "<100.0 mg/dL", "", "Normal"),
    ("LDL High",
     "Female, 50 years old", "LDL Cholesterol", "ldl",
     "165", "mg/dL", "<100.0 mg/dL", "", "High"),
    ("HDL Normal Male",
     "Male, 38 years old", "HDL Cholesterol", "hdl",
     "55", "mg/dL", "40.0-60.0 mg/dL", "", "Normal"),
    ("HDL Low Male",
     "Male, 50 years old", "HDL Cholesterol", "hdl",
     "32", "mg/dL", "40.0-60.0 mg/dL", "", "Low"),
    ("Triglycerides Normal",
     "Female, 42 years old", "Triglycerides", "triglycerides",
     "120", "mg/dL", "<150.0 mg/dL", "", "Normal"),
    ("Triglycerides High",
     "Male, 55 years old", "Triglycerides", "triglycerides",
     "280", "mg/dL", "<150.0 mg/dL", "", "High"),
    # ═══ CBC (10) ════════════════════════════════════════════════════════════
    ("Hemoglobin Normal Male",
     "Male, 35 years old", "Hemoglobin", "hemoglobin",
     "15.2", "g/dL", "14.0-18.0 g/dL", "Critical Low: 7.0 | Critical High: 20.0 g/dL", "Normal"),
    ("Hemoglobin Low Female",
     "Female, 28 years old", "Hemoglobin", "hemoglobin",
     "10.5", "g/dL", "12.0-16.0 g/dL", "Critical Low: 7.0 | Critical High: 20.0 g/dL", "Low"),
    ("Hemoglobin High Male",
     "Male, 50 years old", "Hemoglobin", "hemoglobin",
     "18.5", "g/dL", "14.0-18.0 g/dL", "Critical Low: 7.0 | Critical High: 20.0 g/dL", "High"),
    ("WBC Normal",
     "Male, 40 years old", "WBC Count", "wbc_count",
     "6.8", "x10^3/uL", "4.5-11.0 x10^3/uL", "Critical Low: 2.0 | Critical High: 30.0 x10^3/uL", "Normal"),
    ("WBC Low",
     "Female, 55 years old", "WBC Count", "wbc_count",
     "3.5", "x10^3/uL", "4.5-11.0 x10^3/uL", "Critical Low: 2.0 | Critical High: 30.0 x10^3/uL", "Low"),
    ("WBC High",
     "Male, 60 years old", "WBC Count", "wbc_count",
     "14.0", "x10^3/uL", "4.5-11.0 x10^3/uL", "Critical Low: 2.0 | Critical High: 30.0 x10^3/uL", "High"),
    ("Platelet Normal",
     "Female, 35 years old", "Platelet Count", "platelet_count",
     "250", "x10^3/uL", "150.0-450.0 x10^3/uL", "Critical Low: 50.0 | Critical High: 1000.0 x10^3/uL", "Normal"),
    ("Platelet Low",
     "Male, 70 years old", "Platelet Count", "platelet_count",
     "120", "x10^3/uL", "150.0-450.0 x10^3/uL", "Critical Low: 50.0 | Critical High: 1000.0 x10^3/uL", "Low"),
    ("RBC Normal Female",
     "Female, 40 years old", "Red Blood Cell Count", "rbc_count",
     "4.5", "million/uL", "4.2-5.9 million/uL", "", "Normal"),
    ("Hematocrit Normal Male",
     "Male, 45 years old", "Hematocrit", "hematocrit",
     "44", "%", "42.0-50.0 %", "", "Normal"),
    # ═══ THYROID (6) ═════════════════════════════════════════════════════════
    ("TSH Normal",
     "Female, 35 years old", "TSH", "tsh",
     "2.1", "uIU/mL", "0.4-4.0 uIU/mL", "", "Normal"),
    ("TSH High Hypothyroid",
     "Female, 48 years old", "TSH", "tsh",
     "12.0", "uIU/mL", "0.4-4.0 uIU/mL", "", "High"),
    ("TSH Low Hyperthyroid",
     "Male, 42 years old", "TSH", "tsh",
     "0.15", "uIU/mL", "0.4-4.0 uIU/mL", "", "Low"),
    ("Free T4 Normal",
     "Male, 50 years old", "Thyroxine, Free", "t4_free",
     "1.2", "ng/dL", "0.8-1.8 ng/dL", "", "Normal"),
    ("Free T4 Low",
     "Female, 60 years old", "Thyroxine, Free", "t4_free",
     "0.6", "ng/dL", "0.8-1.8 ng/dL", "", "Low"),
    ("Free T3 High",
     "Male, 38 years old", "Triiodothyronine, Free", "t3_free",
     "5.0", "pg/mL", "2.3-4.2 pg/mL", "", "High"),
    # ═══ LIVER PANEL (6) ════════════════════════════════════════════════════
    ("ALT Normal",
     "Male, 40 years old", "ALT", "alt",
     "30", "U/L", "7.0-56.0 U/L", "", "Normal"),
    ("ALT High",
     "Female, 45 years old", "ALT", "alt",
     "72", "U/L", "7.0-56.0 U/L", "", "High"),
    ("AST Normal",
     "Female, 38 years old", "Aspartate Aminotransferase", "ast",
     "25", "U/L", "10.0-40.0 U/L", "", "Normal"),
    ("AST High",
     "Male, 55 years old", "Aspartate Aminotransferase", "ast",
     "68", "U/L", "10.0-40.0 U/L", "", "High"),
    ("ALP Normal",
     "Male, 50 years old", "Alkaline Phosphatase", "alp",
     "80", "U/L", "44.0-147.0 U/L", "", "Normal"),
    ("Bilirubin Normal",
     "Female, 35 years old", "Bilirubin, Total", "bilirubin_total",
     "0.8", "mg/dL", "0.1-1.2 mg/dL", "", "Normal"),
    # ═══ KIDNEY (6) ═════════════════════════════════════════════════════════
    ("Creatinine Normal Male",
     "Male, 45 years old", "Creatinine", "creatinine",
     "1.1", "mg/dL", "0.7-1.3 mg/dL", "", "Normal"),
    ("Creatinine High Male",
     "Male, 65 years old", "Creatinine", "creatinine",
     "1.8", "mg/dL", "0.7-1.3 mg/dL", "", "High"),
    ("Creatinine Normal Female",
     "Female, 40 years old", "Creatinine", "creatinine",
     "0.8", "mg/dL", "0.5-1.1 mg/dL", "", "Normal"),
    ("BUN Normal",
     "Male, 50 years old", "Blood Urea Nitrogen", "bun",
     "15", "mg/dL", "8.0-20.0 mg/dL", "", "Normal"),
    ("BUN High",
     "Female, 70 years old", "Blood Urea Nitrogen", "bun",
     "25", "mg/dL", "8.0-20.0 mg/dL", "", "High"),
    ("eGFR Low",
     "Male, 68 years old", "Estimated Glomerular Filtration Rate", "egfr",
     "52", "mL/min/1.73m²", ">90.0 mL/min/1.73m²", "Critical Low: 15.0 mL/min/1.73m²", "Low"),
    # ═══ ELECTROLYTES (10) ══════════════════════════════════════════════════
    ("Sodium Normal",
     "Male, 45 years old", "Sodium", "sodium",
     "141", "mEq/L", "136.0-145.0 mEq/L", "Critical Low: 120.0 | Critical High: 160.0 mEq/L", "Normal"),
    ("Sodium Low",
     "Female, 72 years old", "Sodium", "sodium",
     "130", "mEq/L", "136.0-145.0 mEq/L", "Critical Low: 120.0 | Critical High: 160.0 mEq/L", "Low"),
    ("Sodium Critical Low",
     "Male, 60 years old", "Sodium", "sodium",
     "118", "mEq/L", "136.0-145.0 mEq/L", "Critical Low: 120.0 | Critical High: 160.0 mEq/L", "Critical Low"),
    ("Potassium Normal",
     "Male, 40 years old", "Potassium", "potassium",
     "4.2", "mEq/L", "3.5-5.0 mEq/L", "Critical Low: 2.5 | Critical High: 6.5 mEq/L", "Normal"),
    ("Potassium High",
     "Female, 65 years old", "Potassium", "potassium",
     "5.5", "mEq/L", "3.5-5.0 mEq/L", "Critical Low: 2.5 | Critical High: 6.5 mEq/L", "High"),
    ("Potassium Critical High",
     "Male, 70 years old", "Potassium", "potassium",
     "6.5", "mEq/L", "3.5-5.0 mEq/L", "Critical Low: 2.5 | Critical High: 6.5 mEq/L", "Critical High"),
    ("Calcium Normal",
     "Female, 45 years old", "Calcium", "calcium",
     "9.5", "mg/dL", "8.6-10.2 mg/dL", "Critical Low: 6.0 | Critical High: 13.0 mg/dL", "Normal"),
    ("Calcium Low",
     "Male, 60 years old", "Calcium", "calcium",
     "7.8", "mg/dL", "8.6-10.2 mg/dL", "Critical Low: 6.0 | Critical High: 13.0 mg/dL", "Low"),
    ("Chloride Normal",
     "Male, 50 years old", "Chloride", "chloride",
     "102", "mEq/L", "98.0-106.0 mEq/L", "", "Normal"),
    ("Magnesium Normal",
     "Female, 40 years old", "Magnesium", "magnesium",
     "2.0", "mg/dL", "1.6-2.6 mg/dL", "", "Normal"),
    # ═══ IRON PANEL (6) ═════════════════════════════════════════════════════
    ("Iron Normal",
     "Male, 40 years old", "Iron, Serum", "iron",
     "90", "μg/dL", "50.0-150.0 μg/dL", "", "Normal"),
    ("Iron Low Female",
     "Female, 30 years old", "Iron, Serum", "iron",
     "40", "μg/dL", "50.0-150.0 μg/dL", "", "Low"),
    ("Ferritin Normal Female",
     "Female, 35 years old", "Ferritin", "ferritin",
     "50", "ng/mL", "24.0-307.0 ng/mL", "", "Normal"),
    ("Ferritin Low Female",
     "Female, 25 years old", "Ferritin", "ferritin",
     "10", "ng/mL", "24.0-307.0 ng/mL", "", "Low"),
    ("TIBC Normal",
     "Male, 45 years old", "Total Iron Binding Capacity", "tibc",
     "280", "μg/dL", "250.0-310.0 μg/dL", "", "Normal"),
    ("Transferrin Sat Low",
     "Female, 32 years old", "Transferrin Saturation", "transferrin_saturation",
     "15", "%", "20.0-50.0 %", "", "Low"),
    # ═══ VITAMINS (4) ═══════════════════════════════════════════════════════
    ("Vitamin D Normal",
     "Male, 40 years old", "25-Hydroxyvitamin D", "vitamin_d",
     "45", "ng/mL", "30.0-60.0 ng/mL", "", "Normal"),
    ("Vitamin D Low",
     "Female, 55 years old", "25-Hydroxyvitamin D", "vitamin_d",
     "15", "ng/mL", "30.0-60.0 ng/mL", "", "Low"),
    ("Vitamin B12 Normal",
     "Male, 50 years old", "Vitamin B12", "vitamin_b12",
     "450", "pg/mL", "200.0-800.0 pg/mL", "", "Normal"),
    ("Vitamin B12 Low",
     "Female, 68 years old", "Vitamin B12", "vitamin_b12",
     "180", "pg/mL", "200.0-800.0 pg/mL", "", "Low"),
    # ═══ CARDIAC (4) ════════════════════════════════════════════════════════
    ("Troponin I Normal",
     "Male, 55 years old", "Troponin I", "troponin_i",
     "0.02", "ng/mL", "<0.04 ng/mL", "Critical High: 0.1 ng/mL", "Normal"),
    ("Troponin I Critical High",
     "Male, 62 years old", "Troponin I", "troponin_i",
     "0.8", "ng/mL", "<0.04 ng/mL", "Critical High: 0.1 ng/mL", "Critical High"),
    ("BNP Normal",
     "Female, 50 years old", "B-Type Natriuretic Peptide", "bnp",
     "45", "pg/mL", "<100.0 pg/mL", "", "Normal"),
    ("BNP High Heart Failure",
     "Male, 72 years old", "B-Type Natriuretic Peptide", "bnp",
     "250", "pg/mL", "<100.0 pg/mL", "", "High"),
    # ═══ INFLAMMATION (4) ═══════════════════════════════════════════════════
    ("CRP Normal",
     "Male, 40 years old", "C-Reactive Protein", "crp",
     "0.3", "mg/dL", "<0.8 mg/dL", "", "Normal"),
    ("CRP High",
     "Female, 55 years old", "C-Reactive Protein", "crp",
     "5.0", "mg/dL", "<0.8 mg/dL", "", "High"),
    ("ESR Normal Male",
     "Male, 45 years old", "Erythrocyte Sedimentation Rate", "esr",
     "10", "mm/hr", "0.0-15.0 mm/hr", "", "Normal"),
    ("ESR High Male",
     "Male, 60 years old", "Erythrocyte Sedimentation Rate", "esr",
     "25", "mm/hr", "0.0-15.0 mm/hr", "", "High"),
    # ═══ URIC ACID (2) ═════════════════════════════════════════════════════
    ("Uric Acid Normal",
     "Male, 45 years old", "Uric Acid", "uric_acid",
     "5.5", "mg/dL", "3.0-7.0 mg/dL", "", "Normal"),
    ("Uric Acid High",
     "Female, 55 years old", "Uric Acid", "uric_acid",
     "8.5", "mg/dL", "3.0-7.0 mg/dL", "", "High"),
    # ═══ D-DIMER (2) ═══════════════════════════════════════════════════════
    ("D-Dimer Normal",
     "Male, 40 years old", "D-Dimer", "d_dimer",
     "0.3", "μg/mL", "<0.5 μg/mL", "", "Normal"),
    ("D-Dimer High",
     "Female, 65 years old", "D-Dimer", "d_dimer",
     "1.2", "μg/mL", "<0.5 μg/mL", "", "High"),
    # ═══ COAGULATION (4) ═══════════════════════════════════════════════════
    ("PT Normal",
     "Male, 50 years old", "Prothrombin Time", "pt",
     "12.0", "seconds", "11.0-13.0 seconds", "", "Normal"),
    ("PT High",
     "Female, 65 years old", "Prothrombin Time", "pt",
     "16.0", "seconds", "11.0-13.0 seconds", "", "High"),
    ("INR Normal",
     "Male, 55 years old", "International Normalized Ratio", "inr",
     "1.0", "ratio", "0.8-1.2 ratio", "", "Normal"),
    ("INR High",
     "Female, 70 years old", "International Normalized Ratio", "inr",
     "3.0", "ratio", "0.8-1.2 ratio", "", "High"),
    # ═══ PANCREATIC (2) ════════════════════════════════════════════════════
    ("Lipase Normal",
     "Male, 45 years old", "Lipase", "lipase",
     "80", "U/L", "10.0-140.0 U/L", "", "Normal"),
    ("Amylase High",
     "Female, 50 years old", "Amylase", "amylase",
     "150", "U/L", "25.0-125.0 U/L", "", "High"),
    # ═══ PROTEINS (4) ═════════════════════════════════════════════════════
    ("Albumin Normal",
     "Male, 45 years old", "Albumin", "albumin",
     "4.2", "g/dL", "3.5-5.5 g/dL", "", "Normal"),
    ("Albumin Low",
     "Female, 75 years old", "Albumin", "albumin",
     "2.5", "g/dL", "3.5-5.5 g/dL", "", "Low"),
    ("Total Protein Normal",
     "Male, 50 years old", "Total Protein", "total_protein",
     "7.0", "g/dL", "5.5-9.0 g/dL", "", "Normal"),
    ("Total Protein Low",
     "Female, 60 years old", "Total Protein", "total_protein",
     "5.0", "g/dL", "5.5-9.0 g/dL", "", "Low"),
    # ═══ HORMONES (4) ═════════════════════════════════════════════════════
    ("Testosterone Normal Male",
     "Male, 40 years old", "Testosterone", "testosterone",
     "550", "ng/dL", "291.0-1100.0 ng/dL", "", "Normal"),
    ("Testosterone Low Male",
     "Male, 62 years old", "Testosterone", "testosterone",
     "200", "ng/dL", "291.0-1100.0 ng/dL", "", "Low"),
    ("Cortisol Normal",
     "Female, 35 years old", "Cortisol, Morning", "cortisol_am",
     "14", "μg/dL", "5.0-25.0 μg/dL", "", "Normal"),
    ("Cortisol Low",
     "Male, 50 years old", "Cortisol, Morning", "cortisol_am",
     "3.5", "μg/dL", "5.0-25.0 μg/dL", "", "Low"),
    # ═══ BOUNDARY EDGE CASES (4) ══════════════════════════════════════════
    ("Glucose Just Above Normal",
     "Male, 48 years old", "Glucose, Fasting", "glucose_fasting",
     "101", "mg/dL", "70.0-99.0 mg/dL", "Critical Low: 40.0 | Critical High: 400.0 mg/dL", "High"),
    ("Glucose Just Below Normal",
     "Female, 45 years old", "Glucose, Fasting", "glucose_fasting",
     "99", "mg/dL", "70.0-99.0 mg/dL", "Critical Low: 40.0 | Critical High: 400.0 mg/dL", "Normal"),
    ("Sodium Just Above Crit Low",
     "Male, 55 years old", "Sodium", "sodium",
     "121", "mEq/L", "136.0-145.0 mEq/L", "Critical Low: 120.0 | Critical High: 160.0 mEq/L", "Low"),
    ("Potassium Just Below Crit",
     "Female, 60 years old", "Potassium", "potassium",
     "5.9", "mEq/L", "3.5-5.0 mEq/L", "Critical Low: 2.5 | Critical High: 6.5 mEq/L", "High"),
    # ═══ ADDITIONAL COMMON (4) ════════════════════════════════════════════
    ("GGT Normal Male",
     "Male, 50 years old", "Gamma-Glutamyl Transferase", "ggt",
     "35", "U/L", "9.0-50.0 U/L", "", "Normal"),
    ("LDH Normal",
     "Male, 45 years old", "Lactate Dehydrogenase", "ldh",
     "180", "U/L", "80.0-225.0 U/L", "", "Normal"),
    ("Phosphorus Normal",
     "Female, 40 years old", "Phosphorus", "phosphorus",
     "3.5", "mg/dL", "3.0-4.5 mg/dL", "", "Normal"),
    ("Bicarbonate Normal",
     "Male, 50 years old", "Bicarbonate", "bicarbonate",
     "24", "mEq/L", "23.0-28.0 mEq/L", "", "Normal"),
]

# ─── Synonym-aware status matching ────────────────────────────────────────────
STATUS_SYNONYMS = {
    "Critical High": [
        "critical high", "critically high", "critically elevated",
        "dangerously high", "dangerously elevated",
    ],
    "Critical Low": [
        "critical low", "critically low", "critically decreased",
        "dangerously low", "severely low", "life-threatening low",
    ],
    "High": [
        "high", "elevated", "above normal", "above the normal",
        "above the reference", "above the upper limit",
        "above the upper", "exceeds the normal", "exceeds the reference",
        "higher than the normal", "higher than the reference",
        "outside the normal", "beyond the normal",
        "significantly elevated", "mildly elevated",
        "is above", "is elevated", "is high",
    ],
    "Low": [
        "low", "below normal", "below the normal",
        "below the reference", "below the lower limit",
        "below the lower", "decreased", "deficient",
        "lower than the normal", "lower than the reference",
        "significantly decreased", "is below", "is low",
        "is decreased",
    ],
    "Normal": [
        "normal", "within normal", "within the normal",
        "within the reference", "within acceptable",
        "is normal", "falls within",
    ],
}


def check_status_match(expected, response_text):
    """Check if model response matches the expected status.
    Returns (strict_match, clinical_match).
    - strict_match:  exact keyword found (e.g. 'High' in response)
    - clinical_match: synonym phrase found (e.g. 'elevated' for High)
    """
    resp_lower = response_text.lower()
    strict = expected.lower() in resp_lower

    # For clinical match, check synonyms
    clinical = strict  # strict implies clinical
    if not clinical:
        synonyms = STATUS_SYNONYMS.get(expected, [])
        for syn in synonyms:
            if syn in resp_lower:
                clinical = True
                break

    return strict, clinical


# ─── Run all 45 test cases ───────────────────────────────────────────────────
print("=" * 70)
print("POST-TRAINING INFERENCE TESTS (45 Cases)")
print("=" * 70)

strict_pass = 0
clinical_pass = 0
hallucination_count = 0
failed = 0
clinical_failures = []

for i, (name, patient, bm_name, bm_id, val, unit, ref_range, crit_thresh, expected) in enumerate(ALL_TEST_CASES, 1):
    print(f"\n--- Test {i}/{len(ALL_TEST_CASES)}: {name} ---")
    print(f"  Input:    {patient} | {bm_name} ({bm_id}) = {val} {unit}")
    print(f"  Range:    {ref_range}  Crit: {crit_thresh or 'N/A'}")
    print(f"  Expected: {expected}")

    response = run_inference(patient, bm_name, bm_id, val, unit, ref_range, crit_thresh)
    print(f"  Response:\n{response}")

    strict, clinical = check_status_match(expected, response)
    value_echoed = val in response

    if strict:
        if not value_echoed:
            print(f"  Result:   ⚠️ SOFT PASS (keyword matched but value not echoed)")
            hallucination_count += 1
        else:
            print(f"  Result:   ✅ PASS (strict keyword match)")
        strict_pass += 1
        clinical_pass += 1
    elif clinical:
        print(f"  Result:   ✅ CLINICAL PASS (synonym match — no exact keyword)")
        clinical_pass += 1
    else:
        print(f"  Result:   ❌ FAIL (expected '{expected}' — not even synonyms found)")
        failed += 1
        clinical_failures.append(f"  #{i} {name}: expected={expected}")

# ─── Summary ─────────────────────────────────────────────────────────────────
print("\n" + "=" * 70)
print("FINAL RESULTS — Qwen 2.5-3B-Instruct (Original 45)")
print("=" * 70)
total = len(ALL_TEST_CASES)
print(f"  Total:            {total}")
print(f"  Strict Pass:      {strict_pass}/{total} ({strict_pass/total*100:.1f}%) — exact keyword found")
print(f"  Clinical Pass:    {clinical_pass}/{total} ({clinical_pass/total*100:.1f}%) — synonym/keyword found")
print(f"  Soft Pass:        {hallucination_count}/{total} (keyword OK but value not echoed)")
print(f"  Failed:           {failed}/{total} ({failed/total*100:.1f}%) — true hallucinations")
print("=" * 70)
if clinical_failures:
    print("\n❌ TRUE FAILURES (model gave wrong clinical direction):")
    for f in clinical_failures:
        print(f)
    print()

# ─── Run Extended 100 Test Cases ─────────────────────────────────────────────
print("\n\n" + "=" * 70)
print("EXTENDED INFERENCE TESTS (100 Cases — Common Daily Biomarkers)")
print("=" * 70)

ext_strict = 0
ext_clinical = 0
ext_hallucination = 0
ext_failed = 0
ext_failures = []

for i, (name, patient, bm_name, bm_id, val, unit, ref_range, crit_thresh, expected) in enumerate(EXTENDED_100_TEST_CASES, 1):
    print(f"\n--- Test {i}/{len(EXTENDED_100_TEST_CASES)}: {name} ---")
    print(f"  Input:    {patient} | {bm_name} ({bm_id}) = {val} {unit}")
    print(f"  Range:    {ref_range}  Crit: {crit_thresh or 'N/A'}")
    print(f"  Expected: {expected}")

    response = run_inference(patient, bm_name, bm_id, val, unit, ref_range, crit_thresh)
    print(f"  Response:\n{response}")

    strict, clinical = check_status_match(expected, response)
    value_echoed = val in response

    if strict:
        if not value_echoed:
            print(f"  Result:   ⚠️ SOFT PASS (keyword matched but value not echoed)")
            ext_hallucination += 1
        else:
            print(f"  Result:   ✅ PASS (strict keyword match)")
        ext_strict += 1
        ext_clinical += 1
    elif clinical:
        print(f"  Result:   ✅ CLINICAL PASS (synonym match — no exact keyword)")
        ext_clinical += 1
    else:
        print(f"  Result:   ❌ FAIL (expected '{expected}' — not even synonyms found)")
        ext_failed += 1
        ext_failures.append(f"  #{i} {name}: expected={expected}")

# ─── Extended 100 Summary ────────────────────────────────────────────────────
print("\n" + "=" * 70)
print("FINAL RESULTS — Qwen 2.5-3B-Instruct (Extended 100)")
print("=" * 70)
ext_total = len(EXTENDED_100_TEST_CASES)
print(f"  Total:            {ext_total}")
print(f"  Strict Pass:      {ext_strict}/{ext_total} ({ext_strict/ext_total*100:.1f}%) — exact keyword found")
print(f"  Clinical Pass:    {ext_clinical}/{ext_total} ({ext_clinical/ext_total*100:.1f}%) — synonym/keyword found")
print(f"  Soft Pass:        {ext_hallucination}/{ext_total} (keyword OK but value not echoed)")
print(f"  Failed:           {ext_failed}/{ext_total} ({ext_failed/ext_total*100:.1f}%) — true hallucinations")
print("=" * 70)
if ext_failures:
    print("\n❌TRUE FAILURES (model gave wrong clinical direction):")
    for f in ext_failures:
        print(f)
    print()

# ─── Combined Summary ────────────────────────────────────────────────────────
combined_total = total + ext_total
combined_strict = strict_pass + ext_strict
combined_clinical = clinical_pass + ext_clinical
combined_failed = failed + ext_failed
print("\n" + "=" * 70)
print("COMBINED RESULTS — All 145 Tests")
print("=" * 70)
print(f"  Total:            {combined_total}")
print(f"  Strict Pass:      {combined_strict}/{combined_total} ({combined_strict/combined_total*100:.1f}%)")
print(f"  Clinical Pass:    {combined_clinical}/{combined_total} ({combined_clinical/combined_total*100:.1f}%)")
print(f"  Failed:           {combined_failed}/{combined_total} ({combined_failed/combined_total*100:.1f}%)")
print("=" * 70)


# ============================================================================
# ## Cell 7: Export to GGUF for Local Inference
# ============================================================================
# Uncomment the format you need:

# model.save_pretrained_gguf("qwen3b-lab-interpreter", tokenizer, quantization_method="q4_k_m")
# model.push_to_hub_gguf("your-username/qwen3b-lab-interpreter", tokenizer, quantization_method="q4_k_m")

print("\n✅ To export as GGUF, uncomment Cell 7 and run it.")
print("   Recommended quantization: q4_k_m (~2GB file)")
