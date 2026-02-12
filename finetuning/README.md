# 🧬 Lab Report Interpreter Fine-Tuning Module

> **Goal:** Fine-tune a local LLM to fully interpret lab reports offline, replacing the Gemini API dependency.

## 📁 Directory Structure

```
finetuning/
├── README.md                 # This file - Project overview
├── docs/
│   ├── ARCHITECTURE.md       # Technical architecture & design decisions
│   ├── TRAINING_GUIDE.md     # Step-by-step training instructions
│   ├── INTEGRATION_GUIDE.md  # Backend integration guide
│   └── OCR_INTEGRATION.md    # EasyOCR setup and API docs ✅ IMPLEMENTED
├── scripts/
│   ├── generate_dataset.py   # Enhanced dataset generator
│   ├── validate_dataset.py   # Dataset quality validation
│   └── colab_training.py     # Google Colab training script
├── datasets/
│   ├── train_dataset.jsonl   # Training data (generated)
│   └── eval_dataset.jsonl    # Evaluation data (10% holdout)
├── models/
│   └── .gitkeep              # Trained models go here (GGUF format)
└── tests/
    └── test_inference.py     # Inference accuracy tests
```

## 🎯 Key Design Decisions

### 1. OCR over Vision Model
**Recommendation: EasyOCR**

| Criteria | EasyOCR | LLaVA Vision |
|----------|---------|--------------|
| **Model Size** | ~100MB | ~4GB+ |
| **M1 Mac (8GB)** | ✅ Excellent | ⚠️ Tight fit |
| **Accuracy for Tables** | ✅ Very Good | ✅ Good |
| **Offline** | ✅ Yes | ✅ Yes |
| **Setup Complexity** | Low | Medium |

**Rationale:** Lab reports are structured tabular documents. OCR excels at extracting text from tables, and EasyOCR provides excellent accuracy for English text. Vision models add unnecessary overhead for this use case.

### 2. llama.cpp over Ollama
**Recommendation: llama.cpp**

| Criteria | llama.cpp | Ollama |
|----------|-----------|--------|
| **Python Integration** | ✅ Direct bindings | REST API calls |
| **Memory Efficiency** | ✅ Better control | Overhead from daemon |
| **Startup Time** | ✅ Instant | Daemon startup |
| **Dependencies** | Minimal | Requires Ollama install |
| **Production Ready** | ✅ Battle-tested | ✅ Battle-tested |

**Rationale:** For a FastAPI backend, `llama-cpp-python` provides direct, synchronous inference without REST API overhead. This is ideal for integrating into existing services.

### 3. Fallback Chain
```
Local Model → Gemini API (if uncertain/offline fails)
```
- Local model confidence threshold: 80%
- Below threshold → Fallback to Gemini (if online)

---

## 🚀 Quick Start

### Step 1: Generate Training Dataset
```bash
cd finetuning
python scripts/generate_dataset.py --output datasets/train_dataset.jsonl --count 3000
```

### Step 2: Train on Google Colab
1. Open [Google Colab](https://colab.research.google.com/)
2. Upload `scripts/colab_training.py`
3. Upload `datasets/train_dataset.jsonl`
4. Run all cells
5. Download the exported `.gguf` model

### Step 3: Local Inference
```bash
# Place the model in models/
mv ~/Downloads/lab-interpreter-q4.gguf models/

# Test inference
python tests/test_inference.py
```

---

## 📊 Model Specifications

| Spec | Value |
|------|-------|
| **Base Model** | DeepSeek-R1-Distill-Qwen-1.5B |
| **Fine-Tuning Method** | QLoRA (4-bit quantization) |
| **LoRA Rank** | 16 |
| **Training Examples** | 3000+ |
| **Output Format** | GGUF (Q4_K_M quantization) |
| **Final Model Size** | ~1.2GB |
| **Inference RAM** | ~2-3GB |

---

## 🔗 Related Files

- [Backend Integration](../backend_fastapi/app/lab_interpreter/services/) - Where the model integrates
- [Biomarkers Reference](../backend_fastapi/data/biomarkers.json) - Reference ranges used for training data
- [Original Fine-Tuning Doc](../docs/finetuning.md) - Initial strategy document
