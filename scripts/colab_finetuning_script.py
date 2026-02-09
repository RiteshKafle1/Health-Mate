# 🏥 Lab Report Fine-Tuner (DeepSeek-R1-Distill-Qwen-1.5B)
# Open Google Colab (https://colab.research.google.com/) -> New Notebook -> Runtime -> Change Runtime Type -> T4 GPU
# Copy this entire block into a cell and run it!

# 1. Install Unsloth (Fastest Fine-Tuning Library)
%%capture
!pip install "unsloth[colab-new] @ git+https://github.com/unslothai/unsloth.git"
!pip install --no-deps "xformers<0.0.27" "trl<0.9.0" peft accelerate bitsandbytes

# 2. Load Model & Tokenizer
from unsloth import FastLanguageModel
import torch

max_seq_length = 2048
dtype = None # Auto detection
load_in_4bit = True # 4bit Quantization (fits 8GB RAM easily later)

model, tokenizer = FastLanguageModel.from_pretrained(
    model_name = "unsloth/DeepSeek-R1-Distill-Qwen-1.5B-unsloth-bnb-4bit",
    max_seq_length = max_seq_length,
    dtype = dtype,
    load_in_4bit = load_in_4bit,
)

# 3. Add LoRA Adapters (The "Brain Surgery")
model = FastLanguageModel.get_peft_model(
    model,
    r = 16, # Rank (power of the adapter)
    target_modules = ["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"],
    lora_alpha = 16,
    lora_dropout = 0,
    bias = "none",
    use_gradient_checkpointing = "unsloth",
    random_state = 3407,
)

# 4. Load YOUR Data (Upload 'train_dataset.jsonl' to Colab files first!)
from datasets import load_dataset
dataset = load_dataset("json", data_files="train_dataset.jsonl", split="train")

# Format prompt
alpaca_prompt = """Below is an instruction that describes a task, paired with an input that provides further context. Write a response that appropriately completes the request.

### Instruction:
{}

### Input:
{}

### Response:
{}"""

EOS_TOKEN = tokenizer.eos_token
def formatting_prompts_func(examples):
    instructions = examples["instruction"]
    inputs       = examples["input"]
    outputs      = examples["output"]
    texts = []
    for instruction, input, output in zip(instructions, inputs, outputs):
        text = alpaca_prompt.format(instruction, input, output) + EOS_TOKEN
        texts.append(text)
    return { "text" : texts, }

dataset = dataset.map(formatting_prompts_func, batched = True,)

# 5. Train! (Takes ~10-20 mins)
from trl import SFTTrainer
from transformers import TrainingArguments

trainer = SFTTrainer(
    model = model,
    tokenizer = tokenizer,
    train_dataset = dataset,
    dataset_text_field = "text",
    max_seq_length = max_seq_length,
    dataset_num_proc = 2,
    args = TrainingArguments(
        per_device_train_batch_size = 2,
        gradient_accumulation_steps = 4,
        warmup_steps = 5,
        max_steps = 60, # Increase to 100-200 for full training
        learning_rate = 2e-4,
        fp16 = not torch.cuda.is_bf16_supported(),
        bf16 = torch.cuda.is_bf16_supported(),
        logging_steps = 1,
        optim = "adamw_8bit",
        weight_decay = 0.01,
        lr_scheduler_type = "linear",
        seed = 3407,
        output_dir = "outputs",
    ),
)

trainer.train()

# 6. Save GGUF for Mac
model.save_pretrained_gguf("model", tokenizer, quantization_method = "q4_k_m")
print("✅ Done! Download 'model-unsloth.Q4_K_M.gguf' from the files tab!")
