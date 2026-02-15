# Training Hyperparameter Optimization

Tuning QLoRA config for the expanded dataset (3,600 train / 400 eval, 99 biomarkers, 15 categories) on T4 GPU (15GB VRAM).

## Analysis: Current vs Proposed

| Parameter | Current | Proposed | Rationale |
|-----------|---------|----------|-----------|
| **LoRA rank (r)** | 16 | **32** | 99 biomarkers with sex-specific ranges, critical values, and 15 categories is a complex task. r=16 gives ~4.7M params, r=32 gives ~9.4M — more capacity to learn diverse medical patterns. Still fits comfortably on T4 with 4-bit quant + gradient checkpointing. |
| **LoRA alpha** | 32 | **64** | Standard practice: alpha = 2× rank. Maintains the same effective scaling factor. |
| **Epochs** | 3 | **4** | More capacity (r=32) needs more steps to converge. 3 epochs = 675 steps, 4 epochs = 900 steps. Going to 5 risks overfitting on 3,600 examples. |
| **Dropout** | 0.05 | **0.1** | Higher rank → more params → slightly increase regularization to prevent overfitting. |
| **Warmup** | 100 | **10% of total** | More warmup helps stability with the larger adapter. |
| **Learning rate** | 2e-4 | **2e-4** | No change needed — cosine scheduler + warmup handles the higher capacity fine. |
| **Batch size** | 4×4=16 | **4×4=16** | Keeps effective batch at 16. r=32 adds ~30MB VRAM — T4 handles this easily. |
| **Save strategy** | steps | **steps + `load_best_model_at_end`** | With eval set available, save the best checkpoint by eval loss instead of just the last one. |
| **Eval frequency** | every ~25% | **every ~100 steps** | More frequent eval lets us detect overfitting earlier. |

### Estimated Training Stats (T4 GPU)

```
Dataset:          3,600 training examples
Effective batch:  16
Steps per epoch:  225
Total steps:      900 (4 epochs)
Warmup:           90 steps (10%)
Eval every:       100 steps
Est. time:        ~20-30 min on T4
VRAM usage:       ~10-12 GB (well within T4's 15GB)
```

> [!IMPORTANT]
> If you hit OOM errors on T4 with r=32, reduce `per_device_train_batch_size` from 4 → 2 (and increase `gradient_accumulation_steps` from 4 → 8 to keep effective batch at 16).

## Proposed Changes

#### [MODIFY] [colab_training.py](file:///Users/sainacomputer/Desktop/8thsem/cuty-main/finetuning/scripts/colab_training.py)

1. **Cell 3** — LoRA config: `r=16→32`, `alpha=32→64`, `dropout=0.05→0.1`
2. **Cell 5** — Training args: `epochs=3→4`, add `load_best_model_at_end=True`, add `metric_for_best_model="eval_loss"`, more frequent eval

## Verification

The 3 test prompts (glucose, hemoglobin critical, D-dimer) will validate post-training.
