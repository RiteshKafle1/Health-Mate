# 🎓 Training Guide

> Step-by-step instructions for fine-tuning the lab report interpreter model.

## Prerequisites

- Google Account (for Colab)
- Generated training dataset (`train_dataset.jsonl`)
- ~2-4 hours of Colab GPU time (T4 free tier)

---

## Step 1: Generate Training Dataset

### 1.1 Run Dataset Generator

```bash
cd /path/to/cuty-main/finetuning

# Generate 3000 training examples
python scripts/generate_dataset.py \
    --output datasets/train_dataset.jsonl \
    --count 3000 \
    --eval-split 0.1
```

This creates:
- `datasets/train_dataset.jsonl` - Training data (2700 examples)
- `datasets/eval_dataset.jsonl` - Evaluation data (300 examples)

### 1.2 Validate Dataset

```bash
python scripts/validate_dataset.py --file datasets/train_dataset.jsonl
```

Expected output:
```
✅ Total examples: 3000
✅ Unique biomarkers: 55
✅ Status distribution: HIGH (33%), LOW (33%), NORMAL (34%)
✅ Age range: 18-85
✅ Format validation: PASSED
```

---

## Step 2: Google Colab Training

### 2.1 Open Colab

1. Go to [Google Colab](https://colab.research.google.com/)
2. **Runtime → Change runtime type → T4 GPU**
3. Create a new notebook

### 2.2 Upload Files

Upload these files to Colab:
- `finetuning/scripts/colab_training.py`
- `finetuning/datasets/train_dataset.jsonl`

### 2.3 Run Training Script

Copy and paste the following cells:

#### Cell 1: Install Dependencies
```python
%%capture
# Install Unsloth (optimized fine-tuning)
!pip install "unsloth[colab-new] @ git+https://github.com/unslothai/unsloth.git"
!pip install --no-deps "xformers<0.0.27" "trl<0.9.0" peft accelerate bitsandbytes
```

#### Cell 2: Load Model
```python
from unsloth import FastLanguageModel
import torch

# Model configuration
model_name = "deepseek-ai/DeepSeek-R1-Distill-Qwen-1.5B"
max_seq_length = 2048
dtype = None  # Auto-detect
load_in_4bit = True  # QLoRA

# Load model and tokenizer
model, tokenizer = FastLanguageModel.from_pretrained(
    model_name=model_name,
    max_seq_length=max_seq_length,
    dtype=dtype,
    load_in_4bit=load_in_4bit,
)

print("✅ Model loaded successfully!")
```

#### Cell 3: Configure LoRA
```python
model = FastLanguageModel.get_peft_model(
    model,
    r=16,                          # LoRA rank
    lora_alpha=32,                 # Scaling factor
    lora_dropout=0.05,             # Regularization
    target_modules=[
        "q_proj", "k_proj", "v_proj", "o_proj",
        "gate_proj", "up_proj", "down_proj"
    ],
    bias="none",
    use_gradient_checkpointing="unsloth",  # Memory optimization
    random_state=42,
)

print("✅ LoRA configured!")
print(f"📊 Trainable parameters: {model.print_trainable_parameters()}")
```

#### Cell 4: Load Dataset
```python
from datasets import load_dataset

# ChatML prompt template
PROMPT_TEMPLATE = """<|im_start|>system
You are a medical lab interpreter. Analyze lab results and provide clinical interpretations.
<|im_end|>
<|im_start|>user
{instruction}

{input}
<|im_end|>
<|im_start|>assistant
{output}
<|im_end|>"""

def format_example(example):
    return {
        "text": PROMPT_TEMPLATE.format(
            instruction=example["instruction"],
            input=example["input"],
            output=example["output"]
        )
    }

# Load and format dataset
dataset = load_dataset("json", data_files="train_dataset.jsonl", split="train")
dataset = dataset.map(format_example)

print(f"✅ Loaded {len(dataset)} training examples")
print(f"📝 Sample:\n{dataset[0]['text'][:500]}...")
```

#### Cell 5: Train Model
```python
from trl import SFTTrainer
from transformers import TrainingArguments

trainer = SFTTrainer(
    model=model,
    tokenizer=tokenizer,
    train_dataset=dataset,
    dataset_text_field="text",
    max_seq_length=max_seq_length,
    args=TrainingArguments(
        per_device_train_batch_size=4,
        gradient_accumulation_steps=4,
        warmup_steps=100,
        max_steps=1000,              # Adjust based on dataset size
        learning_rate=2e-4,
        bf16=True,
        logging_steps=25,
        output_dir="outputs",
        save_strategy="steps",
        save_steps=250,
        optim="adamw_8bit",
    ),
)

# Start training
print("🚀 Starting training...")
trainer.train()
print("✅ Training complete!")
```

#### Cell 6: Export to GGUF
```python
# Save LoRA adapter
model.save_pretrained("lab-interpreter-lora")
tokenizer.save_pretrained("lab-interpreter-lora")

# Merge and export to GGUF (for llama.cpp)
model.save_pretrained_gguf(
    "lab-interpreter-gguf",
    tokenizer,
    quantization_method="q4_k_m"  # Optimal for M1 Mac
)

print("✅ Model exported to GGUF format!")
print("📁 Download: lab-interpreter-gguf/unsloth.Q4_K_M.gguf")
```

#### Cell 7: Download Model
```python
from google.colab import files
files.download("lab-interpreter-gguf/unsloth.Q4_K_M.gguf")
```

---

## Step 3: Verify Trained Model

### 3.1 Move Model to Project

```bash
# After downloading from Colab
mv ~/Downloads/unsloth.Q4_K_M.gguf \
   /path/to/cuty-main/finetuning/models/lab-interpreter-q4.gguf
```

### 3.2 Test Inference

```bash
cd /path/to/cuty-main/finetuning
python tests/test_inference.py
```

Expected output:
```
🧪 Testing: Glucose (HIGH)
   Input: 126 mg/dL, Male, 58yo
   Output: **Status:** HIGH (Reference: 70-100 mg/dL)
           **Interpretation:** Fasting glucose of 126 mg/dL indicates...
   ✅ PASS

🧪 Testing: Hemoglobin (LOW)
   Input: 10.5 g/dL, Female, 35yo
   Output: **Status:** LOW (Reference: 12.0-16.0 g/dL)
           **Interpretation:** Hemoglobin of 10.5 g/dL suggests anemia...
   ✅ PASS

📊 Results: 10/10 passed (100% accuracy)
```

---

## Troubleshooting

### Out of Memory (Colab)
- Reduce `per_device_train_batch_size` to 2
- Reduce `max_seq_length` to 1024
- Use `gradient_accumulation_steps=8`

### Slow Training
- Verify T4 GPU is enabled: `!nvidia-smi`
- Reduce `max_steps` for faster iteration

### Poor Output Quality
- Increase training examples (5000+)
- Increase `max_steps` to 2000
- Check dataset quality with `validate_dataset.py`

### GGUF Export Fails
- Install llama.cpp: `!pip install llama-cpp-python`
- Try different quantization: `q8_0` (larger but safer)

---

## Training Metrics to Watch

| Metric | Good Range | Action if Bad |
|--------|------------|---------------|
| Loss | 0.5 - 1.5 | Adjust learning rate |
| Gradient Norm | < 1.0 | Add gradient clipping |
| Learning Rate | Decreasing | Normal (warmup + decay) |

---

## Next Steps

After successful training:
1. Move to [INTEGRATION_GUIDE.md](./INTEGRATION_GUIDE.md) for backend setup
2. Test with real lab report images
3. Fine-tune further if accuracy is low
