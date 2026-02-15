# Fine-Tuning DeepSeek-R1 with QLoRA — Study Notes

These notes are written as a guided lesson. They start with a topic plan, then dive into concepts, and finally walk through every line of `finetuning/scripts/colab_training.py` so you understand both the *why* and the *how*.

---

## 0. Lesson Plan (what you'll learn)
- Big picture: what the Colab script accomplishes.
- QLoRA & quantization fundamentals (why 4-bit, how adapters work).
- Data design: why we have `train_dataset.jsonl` *and* `train_dataset_eval.jsonl`.
- Training loop concepts: epochs, steps, batch size, gradient accumulation, warmup, losses, overfitting/underfitting.
- Evaluation cadence: eval/saving intervals and how to set them.
- Line‑by‑line walkthrough of every cell in `colab_training.py`.
- Exporting to GGUF and offline inference considerations.

---

## 1. Big Picture
Goal: Fine‑tune **DeepSeek-R1-Distill-Qwen-1.5B** to interpret lab reports. We keep the base model mostly frozen, train a small set of LoRA adapter weights, and run everything in Google Colab’s free T4 GPU using 4‑bit quantization so it fits in memory and trains quickly.

---

## 2. QLoRA & Quantization (Concepts First)

### What is Quantization?
- **Definition:** Store model weights with fewer bits (e.g., 4‑bit instead of 16‑bit) to shrink memory and speed up I/O.
- **Trade‑off:** Small drop in numerical precision; usually minimal quality loss if quantization scheme is good (bnb 4‑bit does per‑channel scaling to limit error).
- **Example:** A 1.5B‑parameter model in FP16 needs ~3GB. In 4‑bit, it needs roughly a quarter (~0.8GB), so it fits in a T4’s 15GB even after optimizer/activations overhead.

### What is LoRA?
- **Definition:** Low‑Rank Adaptation injects small trainable matrices (rank `r`) into attention/MLP layers. Base weights stay frozen.
- **Why:** Dramatically reduces trainable parameters → faster training, lower memory, less risk of catastrophic forgetting.

### What is QLoRA?
- **Pipeline:** Quantize the *base* model to 4‑bit **for storage and forward pass**, but keep the LoRA adapters in higher precision (usually 16‑bit) for stable updates.
- **Benefit:** You get the memory savings of 4‑bit with the training stability of full‑precision adapter weights.

### ASCII flow: QLoRA training path
```
Data → Tokenizer → 4-bit Base Model (frozen) → + LoRA adapters (trainable)
              ↑ backprop only through LoRA ↑
```

### Where quantization happens in this project
- We **load** a pre‑quantized 4‑bit checkpoint: `unsloth/DeepSeek-R1-Distill-Qwen-1.5B-unsloth-bnb-4bit`.
- We **train** only LoRA adapters (mixed precision).
- We **export** to GGUF with `q4_k_m` for lightweight CPU inference.

---

## 3. Data Design: Train vs Eval Sets

| File | Purpose | Used in script | Why it matters |
| ---- | ------- | -------------- | -------------- |
| `train_dataset.jsonl` | Training examples the model learns from | Required | Feeds gradient updates; should be diverse and representative. |
| `train_dataset_eval.jsonl` | Held‑out examples *not* used for weight updates | Optional (script will continue without it) | Tracks generalization; lets us pick the best checkpoint and detect overfitting early. |

Keep eval data disjoint from training data. If eval loss starts rising while train loss falls → overfitting.

---

## 4. Training Concepts You’ll See in the Script
- **Epochs:** One full pass over the training set. More epochs = more chances to learn; too many = overfit.
- **Steps:** One optimizer update. Steps per epoch = `ceil(num_examples / effective_batch)`.
- **Batch size (`BATCH_SIZE`):** Examples processed before one backward pass. Limited by GPU memory.
- **Gradient accumulation (`GRADIENT_ACCUMULATION`):** Simulates a larger batch by doing `accum_steps` forward/backward passes before an optimizer step. Effective batch = `BATCH_SIZE * GRADIENT_ACCUMULATION`.
- **Warmup steps:** Start with small LR for stability, then ramp to full LR.
- **Training loss vs validation loss:** Training loss is on the batches used for updates; validation (eval) loss is on held‑out data. Divergence between them is the overfitting alarm.
- **Eval interval:** How often we run eval during training. Frequent checks catch overfitting sooner but slow training.
- **Save interval:** How often to checkpoint; balances safety vs disk/time.
- **Precision (fp16/bf16):** Mixed precision speeds training; bf16 preferred on T4 if supported.

---

## 5. Hyperparameter Intuitions (what happens if you tweak them)
- **Increase `r` (LoRA rank):** More capacity; better fit on complex tasks; higher VRAM/overfit risk.
- **Increase `lora_dropout`:** More regularization; can reduce overfitting; too high may underfit.
- **Increase epochs:** Better training loss; if val loss rises → overfitting.
- **Increase eval interval (less frequent):** Faster training, slower feedback; risk missing overfitting.
- **Decrease eval interval (more frequent):** Better monitoring; slower wall‑clock.
- **Increase batch/effective batch:** Smoother gradients; requires more memory; may need LR retuning.
- **Learning rate too high:** Diverges or oscillates; too low: slow/underfit.
- **Gradient accumulation higher:** Allows larger effective batch without more memory; longer step time.

---

## 6. Line‑by‑Line Walkthrough of `finetuning/scripts/colab_training.py`

### Cell 0: Header & instructions (lines 1–16)
- Comments define the purpose (HealthMate lab interpreter) and model choice.
- Steps 1–4 tell you how to use the notebook in Colab and upload both datasets.
- Training time and final artifact size give expectations.

### Cell 1: Install dependencies (lines 21–27)
```python
# %%capture
# !pip install "unsloth[colab-new] @ git+https://github.com/unslothai/unsloth.git"
# !pip install --no-deps "xformers<0.0.27" "trl<0.9.0" peft accelerate bitsandbytes
```
- `%%capture` would silence noisy install logs.
- `unsloth` provides fast model loading + QLoRA helpers.
- `xformers`, `trl`, `peft`, `accelerate`, `bitsandbytes` support efficient training and 4‑bit quantization.

### Cell 2: Load model & tokenizer (lines 31–53)
```python
from unsloth import FastLanguageModel
import torch

MODEL_NAME = "...-bnb-4bit"  # already quantized
MAX_SEQ_LENGTH = 2048
LOAD_IN_4BIT = True

model, tokenizer = FastLanguageModel.from_pretrained(
    model_name=MODEL_NAME,
    max_seq_length=MAX_SEQ_LENGTH,
    dtype=None,          # auto bf16 on T4
    load_in_4bit=LOAD_IN_4BIT,
)
```
- Imports: `FastLanguageModel` wraps loading + quantization; `torch` for device/precision checks.
- `MODEL_NAME` points to a 4‑bit base → faster load, smaller footprint.
- `MAX_SEQ_LENGTH` caps context length; affects memory and training speed.
- `dtype=None` lets Unsloth pick bf16 if GPU supports it (T4 does).
- `load_in_4bit=True` triggers 4‑bit weights (QLoRA base).
- Print shows device to confirm CUDA.

### Cell 3: Configure LoRA adapters (lines 59–79)
```python
model = FastLanguageModel.get_peft_model(
    model,
    r=32,
    lora_alpha=64,
    lora_dropout=0.1,
    target_modules=[...],
    bias="none",
    use_gradient_checkpointing="unsloth",
    random_state=42,
)
```
- `r=32`: rank of low‑rank matrices; more capacity than common `r=8/16`, chosen to cover 99 biomarkers.
- `lora_alpha=64`: scales the LoRA update (rule of thumb ≈2× rank).
- `lora_dropout=0.1`: regularizes adapter updates to reduce overfitting.
- `target_modules`: apply adapters to attention projections and MLP projections—where most task‑specific info lives.
- `bias="none"`: don’t train bias terms (saves params).
- `use_gradient_checkpointing="unsloth"`: recomputes activations during backward to halve memory use.
- `random_state=42`: reproducibility.
- `print_trainable_parameters()` shows how few parameters are tuned.

### Cell 4: Load & format dataset (lines 85–126)
```python
from datasets import load_dataset

CHATML_TEMPLATE = """<|im_start|>system ... """

def format_example(example):
    return {"text": CHATML_TEMPLATE.format(...)}

train_dataset = load_dataset("json", data_files="train_dataset.jsonl", split="train")
train_dataset = train_dataset.map(format_example)

try:
    eval_dataset = load_dataset("json", data_files="train_dataset_eval.jsonl", split="train")
    eval_dataset = eval_dataset.map(format_example)
except:
    eval_dataset = None
```
- `datasets` library loads JSONL files where each row has `instruction`, `input`, `output`.
- `CHATML_TEMPLATE` ensures prompts match the model’s chat format. **Inference must use the same template** or outputs will degrade.
- `format_example` stitches each row into a single `text` field for SFT.
- `train_dataset` is mandatory; `eval_dataset` optional (script keeps going if absent).
- The sample print helps sanity‑check formatting.

### Cell 5: Train model (lines 132–190)
```python
BATCH_SIZE = 4
GRADIENT_ACCUMULATION = 4     # effective batch = 16
NUM_EPOCHS = 4

TOTAL_STEPS = (len(train_dataset) // EFFECTIVE_BATCH) * NUM_EPOCHS
WARMUP_STEPS = max(10, TOTAL_STEPS // 10)
EVAL_INTERVAL = 100
SAVE_INTERVAL = max(1, TOTAL_STEPS // 4)

USE_BF16 = torch.cuda.is_bf16_supported()
USE_FP16 = not USE_BF16
```
- Small per‑device batch fits T4; accumulation builds an effective batch of 16 for smoother gradients.
- `TOTAL_STEPS` derives from dataset size, effective batch, and epochs.
- `WARMUP_STEPS` ≈10% of total gives stable start for larger adapter.
- `EVAL_INTERVAL=100` steps catches overfitting without excessive slowdown.
- `SAVE_INTERVAL` saves 4 checkpoints across training.
- Precision picks bf16 on capable GPUs; otherwise fp16.

Trainer setup:
```python
trainer = SFTTrainer(
    model=model,
    tokenizer=tokenizer,
    train_dataset=train_dataset,
    eval_dataset=eval_dataset,
    dataset_text_field="text",
    max_seq_length=MAX_SEQ_LENGTH,
    args=TrainingArguments(
        per_device_train_batch_size=BATCH_SIZE,
        gradient_accumulation_steps=GRADIENT_ACCUMULATION,
        warmup_steps=WARMUP_STEPS,
        max_steps=TOTAL_STEPS,
        learning_rate=2e-4,
        fp16=USE_FP16,
        bf16=USE_BF16,
        logging_steps=25,
        output_dir="outputs",
        save_strategy="steps",
        save_steps=SAVE_INTERVAL,
        eval_strategy="steps" if eval_dataset else "no",
        eval_steps=EVAL_INTERVAL if eval_dataset else None,
        load_best_model_at_end=True if eval_dataset else False,
        metric_for_best_model="eval_loss",
        greater_is_better=False,
        optim="adamw_8bit",
        weight_decay=0.01,
        lr_scheduler_type="cosine",
        seed=42,
        report_to="none",
    ),
)
trainer.train()
```
- `SFTTrainer` (from TRL) fine‑tunes on plain text field using causal LM objective.
- `max_steps` instead of `num_train_epochs` because total steps already computed.
- `learning_rate=2e-4` typical for LoRA on small models; cosine decay smooths end of training.
- `adamw_8bit` reduces optimizer memory via bitsandbytes.
- `eval_strategy` only active if eval set exists; otherwise training runs faster.
- `load_best_model_at_end` uses lowest eval loss checkpoint (prevents picking overfit end state).
- `logging_steps=25` prints loss often enough to watch training curves.

### Cell 6: Test inference (lines 196–252)
- `FastLanguageModel.for_inference(model)` switches to inference mode (merges certain hooks, disables grad).
- Three prompt templates test normal, critical, and new biomarker scenarios.
- `tokenizer(...).to("cuda")` moves inputs to GPU for generation speed.
- `model.generate(..., temperature=0.1, do_sample=True)` samples low‑variance answers suitable for clinical tone.
- Assistant responses are extracted by splitting on ChatML markers.

### Cell 7: Export to GGUF (lines 258–270)
```python
model.save_pretrained_gguf(
    "lab-interpreter-gguf",
    tokenizer,
    quantization_method="q4_k_m"
)
```
- Merges LoRA adapters into the base and writes a `q4_k_m` GGUF file (~1GB) that runs efficiently on M‑series Macs or CPU inference backends.

### Cell 8: Download model (lines 276–285)
```python
from google.colab import files
files.download("lab-interpreter-gguf/unsloth.Q4_K_M.gguf")
```
- Simple Colab file download helper. Notes remind where to place the file in your project.

---

## 7. Training & Validation Loss — How to Read Them
- **Training loss going down, validation loss flat/up:** Overfitting; add dropout, reduce epochs, increase eval frequency, or augment data.
- **Both losses high:** Underfitting; try more epochs, slightly higher LR, or lower dropout/rank if capacity too constrained.
- **Loss spikes early:** Lower LR or increase warmup steps.
- **Validation loss lower than training loss:** Often due to regularization/batch effects; usually acceptable if not diverging later.

---

## 8. Gradient Accumulation (mini visual)
```
Step counter

  |
  +-- forward/backward on batch 1 (grad buffer += g1)
  +-- forward/backward on batch 2 (grad buffer += g2)
  +-- forward/backward on batch 3 (grad buffer += g3)
  +-- forward/backward on batch 4 (grad buffer += g4)
        => optimizer step (use g1+g2+g3+g4), zero grads
```
With `BATCH_SIZE=4` and `GRADIENT_ACCUMULATION=4`, you simulate batch 16 without storing all samples at once.

---

## 9. Practical Recommendations
- Always keep eval separate and small enough to run frequently.
- Match inference prompt format to training template (ChatML here).
- Monitor `eval_loss` every ~100 steps; tighten to 50 if you see overfitting.
- If VRAM OOM occurs, first lower `BATCH_SIZE`, then `r`, then `max_seq_length`.
- Keep `temperature` low (0.1–0.3) for clinical outputs; raise it for creative tasks.

---

## 10. Quick Reference Table

| Knob | Increase does… | Decrease does… | Watch out for |
| ---- | -------------- | -------------- | ------------- |
| `r` (LoRA rank) | More capacity, better fit | Less capacity, faster | Overfitting / VRAM |
| `lora_dropout` | More regularization | Less regularization | Under/overfitting |
| `epochs` | More learning time | Less time | Overfitting vs underfitting |
| `learning_rate` | Faster learning, possible divergence | Safer but slower | Spikes/plateaus |
| `grad_accum` | Larger effective batch | Noisy gradients | Longer step time |
| `eval_interval` | Faster training | Better monitoring | Missed overfit |
| `max_seq_length` | Handles longer inputs | Lower VRAM use | Truncation risk |

---

## 11. Overfitting & Underfitting Checklist
- **Signals of overfitting:** Train loss ↓, eval loss ↑; outputs parroting train set; sudden eval loss rise after certain steps.
- **Mitigations:** More dropout, smaller rank, earlier stopping, more diverse data, data augmentation, lower LR.
- **Signals of underfitting:** Both losses high and close; bland outputs; slow loss decrease.
- **Mitigations:** More epochs, slightly higher LR, lower dropout, increase rank/effective batch.

---

## 12. End‑to‑End Flow Diagram
```
JSONL data
   │
   ├─ load_dataset → map(format_example → ChatML)
   │
   ├─ tokenizer → tokenized batches
   │
   ├─ 4‑bit base (frozen) + LoRA adapters (trainable)
   │
   ├─ Training loop:
   │     [forward → loss → backward → grad accumulate → optimizer step]
   │           │
   │           └─ eval every 100 steps (if eval set)
   │
   ├─ Checkpoints saved every ~¼ of total steps
   │
   └─ Merge + export to GGUF (q4_k_m) → download → deploy
```

---

You now have both the conceptual foundations (QLoRA, quantization, training dynamics) and a line‑by‑line understanding of the Colab script. Refer back to the quick tables when tuning, and adjust eval/save intervals to match your dataset size and time budget.
