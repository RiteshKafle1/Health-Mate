# Understanding `colab_training.py` - Complete Project Viva Guide

This document is designed to teach you, line-by-line, the concepts behind `colab_training.py`. It is structured to help you answer questions in a project viva as if you built this system from scratch.

---

## Part 1: Core Concepts (The "Why")

### 1. What is Fine-Tuning?
> **Viva Question:** "Why did you fine-tune a model instead of just using prompt engineering?"

**Answer:** 
- **Prompt Engineering** is like leaving a sticky note on a textbook saying "Read this chapter carefully." It works for general tasks but has limits (context window size, cost per token, reliability).
- **Fine-Tuning** is like **re-writing the textbook** (or adding a permanent appendix) so the model inherently *knows* the task.
- We fine-tuned because we want the model to learn a specific **format** (Medical Lab Reports) and **reasoning style** (Clinical Interpretation) that general models might struggle to do consistently or cheaply.

### 2. What is Quantization? (The "MP3 for AI")
> **Viva Question:** "What does `load_in_4bit=True` mean and why did you use it?"

**Concept:** 
Models are stored as numbers (weights). Usually, these are 16-bit or 32-bit floating-point numbers (like `0.12345678`). 
- **16-bit model size:** ~3GB for a 1.5B model.
- **4-bit quantization:** We round these numbers to 4-bit integers (like just `0.1`). This shrinks the model size by ~4x (to ~1GB).

**Why we use it:**
- **Memory:** Google Colab's free tier (T4 GPU) has limited VRAM (16GB). A full 16-bit model + training overhead would crash it. 
- **Speed:** Reading 4-bit numbers from memory is faster.

### 3. What is Unsloth? 
> **Viva Question:** "I see `unsloth` in your imports. What is that?"

**Answer:**
**Unsloth** is an optimization library for LLM training. 
- **Standard Training (HuggingFace):** Calculating gradients (the "learning" step) is slow and memory-heavy because it creates many temporary variables.
- **Unsloth Training:** rewrite the backpropagation steps manually in OpenAI's Triton language. 
- **Result:** It makes fine-tuning **2x faster** and uses **60% less memory** than standard methods, allowing us to train on free Colab GPUs.

### 4. What is LoRA (Low-Rank Adaptation)?
> **Viva Question:** "Are you retraining the whole model? That seems expensive."

**Answer:**
No, we are using **LoRA (Low-Rank Adaptation)**.
- **Full Fine-Tuning:** Updating all 1.5 billion parameters ($W$). Impossible on a consumer GPU.
- **LoRA:** We freeze the original weights ($W$) and freeze them. We then attach **two tiny matrices** ($A$ and $B$) next to the original weights.
- During training, we only update $A$ and $B$.
- **Analogy:** Imagine a heavy encyclopedia (the model). Instead of rewriting the pages (Full Fine-Tuning), you tape a transparent sheet over a page and write your notes on the sheet (LoRA). When you read it, you see the original page + your notes.

---

## Part 2: Line-by-Line Code Analysis

### Section 1: Setup & Imports

```python
# %%capture
# !pip install "unsloth[colab-new] @ git+https://github.com/unslothai/unsloth.git"
# !pip install --no-deps "xformers<0.0.27" "trl<0.9.0" peft accelerate bitsandbytes
```

**Explanation:**
- These are **system commands** (bash) to install libraries.
- `unsloth`: The optimization engine.
- `trl`: Transformer Reinforcement Learning (library by HuggingFace for training).
- `peft`: Parameter-Efficient Fine-Tuning (library for LoRA).
- `bitsandbytes`: Managing 4-bit/8-bit quantization.
- `accelerate`: Helps run PyTorch on GPUs efficiently.

### Section 2: Loading the Model

```python
from unsloth import FastLanguageModel
import torch

MODEL_NAME = "unsloth/DeepSeek-R1-Distill-Qwen-1.5B-unsloth-bnb-4bit"
MAX_SEQ_LENGTH = 2048
LOAD_IN_4BIT = True

model, tokenizer = FastLanguageModel.from_pretrained(
    model_name=MODEL_NAME,
    max_seq_length=MAX_SEQ_LENGTH,
    dtype=None,
    load_in_4bit=LOAD_IN_4BIT,
)
```

**Why this code?**
1.  **`FastLanguageModel`**: This is Unsloth's wrapper. It handles the memory optimizations automatically.
2.  **`MODEL_NAME`**: We are using a **Pre-Quantized** version of DeepSeek R1 1.5B.
    *   *Why Pre-Quantized?* If we downloaded the full 16-bit model and quantized it ourselves, we would need ~6GB RAM just to load it before shrinking it. Downloading the 4-bit version directly uses only ~1.5GB RAM instantly.
3.  **`MAX_SEQ_LENGTH = 2048`**: The "context window". It defines the longest lab report + interpretation the model can read/write at once. 2048 words is plenty for a lab report.

> **Viva Question:** "Why DeepSeek R1 Distill?"
> **Answer:** "It is a 'reasoning' model (Chain-of-Thought) distilled from a larger model. It is excellent at following complex logic, which is crucial for medical interpretation."

### Section 3: Configuring LoRA (The "Adapter")

```python
model = FastLanguageModel.get_peft_model(
    model,
    r=32,
    lora_alpha=64,
    target_modules=["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"],
    use_gradient_checkpointing="unsloth",
)
```

**Key Parameters Explained:**
1.  **`r=32` (Rank):** 
    *   This is the "size" of the transparent sheet (LoRA adapter).
    *   **Low Rank (r=8):** Fewer trainable parameters, faster, but learns less detail.
    *   **High Rank (r=64+):** Smarter, but slower and bigger file size.
    *   *Why 32?* It's a "Goldilocks" number—enough capacity to learn medical terms without bloating the model.
2.  **`target_modules`**: 
    *   These are the specific layers inside the Transformer we are attaching adapters to.
    *   `q, k, v, o`: Attention layers (How the model relates words to each other).
    *   `gate, up, down`: MLP (Multi-Layer Perceptron) layers (Where the model stores "knowledge").
    *   *Why target all of them?* Unsloth allows this efficiently. Targeting MLP layers is crucial for learning **new facts** (like medical ranges), while Attention layers help with **reasoning**.

### Section 4: Data Formatting (ChatML)

```python
CHATML_TEMPLATE = """<|im_start|>system
...
<|im_end|>
<|im_start|>user
{instruction}
{input}
<|im_end|>
<|im_start|>assistant
{output}
<|im_end|>"""
```

**Concept:**
LLMs don't actually understand "chat". They just complete text. 
To make it *act* like a chat, we use a specific **Prompt Template**. 
- `<|im_start|>` and `<|im_end|>` are **Special Tokens**. They tell the model "This is where the user stops speaking, and this is where you start."
- If we didn't use this, the model might get confused about who is speaking.

> **Viva Question:** "Why did you use ChatML format?"
> **Answer:** "It is the standard format for Qwen/DeepSeek models. Using the format the model was pre-trained on ensures we don't 'break' its existing knowledge."

### Section 5: The Training Loop

```python
trainer = SFTTrainer(
    model=model,
    args=TrainingArguments(
        per_device_train_batch_size=4,
        gradient_accumulation_steps=4,
        max_steps=TOTAL_STEPS,
        learning_rate=2e-4,
        optim="adamw_8bit",
        ...
    ),
)
trainer.train()
```

**Key Arguments:**
1.  **`per_device_train_batch_size=4`**:
    *   The GPU processes 4 examples at a time.
    *   *Why 4?* Increasing this might run out of memory (OOM).
2.  **`gradient_accumulation_steps=4`**:
    *   A "virtual" batch size. We process 4 batches of 4 (16 total) *before* updating the model weights.
    *   *Benefit:* It simulates having a big expensive GPU cluster on a small free GPU. It makes training more stable.
3.  **`learning_rate=2e-4`**:
    *   How "fast" the model changes its mind. 
    *   Too high = Model forgets everything (Catastrophic Forgetting).
    *   Too low = Model learns nothing.
4.  **`optim="adamw_8bit"`**:
    *   The Optimizer is the algorithm that calculates how to change weights.
    *   **Standard AdamW:** Uses 32-bit stats (Memory hog).
    *   **8-bit AdamW:** Uses 8-bit stats. Saves huge amounts of memory with almost zero loss in quality.

### Section 6: Saving & Exporting

```python
model.save_pretrained_gguf("lab-interpreter-gguf", tokenizer, quantization_method="q4_k_m")
```

**Concept:**
Once training is done, we have the "LoRA Adapters" (the post-it notes).
To run this offline on a Mac/PC easily, we want **one single file**.
This command:
1.  **Merges** the Base Model (DeepSeek) + LoRA Adapters into one set of weights.
2.  **Converts** (Quantizes) that merged model into **GGUF format**.

**What is GGUF?**
- **GGUF (GPT-Generated Unified Format)** is a file format designed for **llama.cpp**.
- It allows LLMs to run on **CPUs** (slowly) or **Apple Silicon (M1/M2/M3)** (very fast) efficiently.
- `q4_k_m`: A specific 4-bit quantization mix that balances speed and smarts perfectly for 8GB RAM laptops.

---

## Part 3: Summary for Viva Presentation

**The Narrative:**
"We built a specialized offline Lab Interpreter. To do this, we used **Parameter-Efficient Fine-Tuning (PEFT)**. We specifically chose the **Unsloth** framework because it allows us to fine-tune a **1.5 Billion parameter reasoning model (DeepSeek-R1)** on a free Google Colab T4 GPU.

We used **LoRA (Rank 32)** to inject medical knowledge into the model without retraining it fully. We targeted both attention and MLP layers to capture both clinical reasoning and specific reference range facts.

Finally, we exported the model to **GGUF format** using 4-bit quantization, which allows the entire medical AI to run locally on a user's laptop (even without internet) with high privacy and low latency."
