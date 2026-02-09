# Lab Report Interpretation Fine-Tuning Strategy
**Goal:** Fine-tune a local LLM to **fully interpret** lab reports (Internalize Medical Knowledge), removing the dependency on external reference range identifiers.

## 1. Model Selection: The "Smart & Small" Winners
**The Constraint:** M1 MacBook Air (8GB RAM).
**The Winner:** **DeepSeek-R1-Distill-Qwen-1.5B**
- **Why?** Since we now want the model to *know* that "Hemoglobin 11 is low for a male", we need a model with strong **reasoning capabilities**. Use DeepSeek's "Chain of Thought" to allow it to "think" about the patient's context (Sex/Age) before outputting the verdict.

| Model | Parameters | Context | Strengths | Verdict |
| :--- | :--- | :--- | :--- | :--- |
| **DeepSeek-R1-Distill-Qwen-1.5B** | 1.5B | 32k | **Reasoning powerhouse**. Distilled from DeepSeek-R1 (671B). Excellent at logic ("Is this high? Why?"). | **🏆 Top Choice** |
| **Qwen2.5-1.5B-Instruct** | 1.5B | 32k | **Balanced**. Great general instruction following, coding, and math. Very fast. | **🥈 Strong Alternative** |
| **InternLM2.5-1.8B** | 1.8B | 1M | **Massive Context**. Good if you need to paste 50 pages of medical history. | Good, but 1.5B is faster. |

**Recommendation:** **DeepSeek-R1-Distill-Qwen-1.5B**
- **Why:** It specifically mimics the reasoning steps of a giant model, which is crucial for medical interpretation (deducing *implications* of values, not just reading them).
- **Size:** ~1.5GB of RAM in 4-bit quantization (leaving 6.5GB for your OS and App).

---

## 2. Dataset Strategy: "Distilling" Logic
We are **not** using `biomarkers.json` at runtime anymore. Instead, we will use it to **teach** the model during training.

** The "Teacher" Approach (Synthetic Data Generation)**
We will use the existing `biomarkers.json` (which contains 1000+ distinct rules/ranges) to generate **Instruction Tuning Data**.

**Training Example Format:**
- **System:** "You are an expert Clinical Pathologist. Analyze the following lab result, strictly applying the reference ranges for the patient's demographics."
- **User:** "Patient: Male, 45 years. Sample: Serum. \nResult: Glucose (Fasting): 135 mg/dL."
- **Assistant (Target Output):**
  "**Observation:** The Fasting Glucose level is **135 mg/dL**.
  **Reference Check:** For a Male (Adult), the normal fasting range is **70 - 100 mg/dL**. Values between 100-125 mg/dL indicate Prediabetes.
  **Interpretation:** The result is **High**. A value of 135 mg/dL is consistent with **Diabetes Mellitus**.
  **Assessment:** Hyperglycemia detected. Immediate follow-up recommended."

**Why this works:**
We generate 1,000 - 2,000 examples covering every biomarker in your JSON file, across different ages/sexes. The model **memorizes** these patterns. It essentially "downloads" the logic of `biomarkers.json` into its neural weights.

---

## 3. Mathematical Strategy: QLoRA
We will use **4-bit Quantized LoRA (QLoRA)**.
- **Quantization:** Squeezes the 1.5B params into 4-bit integers (reducing size by 4x).
- **LoRA (Low-Rank Adaptation):** Instead of retraining the whole brain, we train tiny "adapter" layers.
  - Mathematical core: $W_{new} = W_{frozen} + \alpha \cdot (A \times B)$
  - This allows us to train on a **Google Colab Free Tier (T4 GPU)** in under an hour.

---

## 4. Implementation Plan

### Phase 1: Data Generation (Local)
1.  **Script (`scripts/generate_dataset.py`):**
    - Load `biomarkers.json`.
    - Generate random "Virtual Patients" (Age, Sex, Conditions).
    - Simulate lab results (Norma, High, Critical).
    - Format pairs of `{ "input": "text report...", "output": "{ json... }" }`.
2.  **Output:** `train_dataset.jsonl` (Target: 1000 examples).

### Phase 2: Fine-Tuning (Cloud - Google Colab)
1.  **Notebook:** Use **Unsloth** framework (fastest for Qwen/DeepSeek).
2.  **Process:**
    - Load `unsloth/DeepSeek-R1-Distill-Qwen-1.5B`.
    - Load `train_dataset.jsonl`.
    - Train for 1-2 epochs (prevent overfitting).
    - **Export:** Save as `.gguf` (Q4_K_M quantization).

### Phase 3: Deployment (MacBook Air M1)
1.  **Engine:** Use **Ollama** (highly optimized for M1).
2.  **Setup:**
    - Create a `Modelfile`.
    - `ollama create medical-interpreter -f Modelfile`.
3.  **Integration:**
    - Update `gemini_interpreter.py` to call the local Ollama endpoint instead of Google API when "Offline Mode" is selected.

---

## 5. Next Steps
1.  Review this plan.
2.  **Action:** Create `scripts/generate_dataset.py` to build the training data.
