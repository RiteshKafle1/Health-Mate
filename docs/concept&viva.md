# Fine-Tuning LLMs (QLoRA) - Concepts and Viva Prep

This document is a long, student-friendly guide to the fine-tuning process used in this project, plus viva questions with oral-style answers. It explains both the ideas (why we do each step) and the mechanics (what each step does), with special focus on medical lab interpretation.

---

## 1. Project Goal and Big Picture

We want a language model to interpret medical lab results in a consistent, clinically cautious way. Instead of training a huge model from scratch, we take a strong base model and teach it a smaller, domain-specific skill. That is fine-tuning.

In this project:
- Base model: DeepSeek-R1-Distill-Qwen-1.5B.
- Training method: QLoRA (Quantized LoRA).
- Environment: Google Colab (T4 GPU).
- Output: A quantized GGUF model for offline inference.

High-level flow:
```
Raw JSONL data
  -> format into ChatML text
  -> tokenize
  -> 4-bit base model (frozen) + LoRA adapters (trainable)
  -> training loop (loss, backprop, optimizer)
  -> evaluation loop (eval loss)
  -> merge adapters and export GGUF
```

Key idea: we keep the strong general knowledge of the base model, and only train a small adapter to make it behave like a medical lab interpreter.

---

## 2. Key Concepts (Core Definitions)

### 2.1 What is fine-tuning?
Fine-tuning is continuing training of a pre-trained model on task-specific data. It changes the model so it speaks in your domain and follows your preferred style, while keeping general knowledge from pretraining. It is much cheaper and faster than training from scratch.

### 2.2 What is SFT (Supervised Fine-Tuning)?
SFT means we provide input-output pairs and train the model to predict the output tokens. It is the most common method when you have labeled examples because it is simple and reliable.

### 2.3 What is LoRA?
LoRA (Low-Rank Adaptation) adds small trainable matrices into existing model layers. The base weights are frozen. Only the new low-rank matrices are updated. Benefits:
- Faster training because fewer parameters update.
- Smaller memory usage because adapters are tiny compared to the full model.
- Less risk of forgetting general knowledge.

### 2.4 What is QLoRA?
QLoRA is LoRA on a quantized base model. The base model weights are stored in 4-bit (very small memory), while LoRA weights are trained in higher precision (fp16 or bf16). This gives:
- Very low memory usage.
- Training stability because only LoRA weights are updated.
- Feasibility on small GPUs like T4.

### 2.5 What is quantization?
Quantization reduces the number of bits used to store model weights. Example:
- fp16: 16 bits per weight.
- int8: 8 bits per weight.
- int4: 4 bits per weight.

Quantization reduces memory and speeds up loading. It can slightly reduce accuracy, but good methods reduce that loss.

Simple numeric example:
- Suppose weights range from -1.0 to +1.0.
- fp16 stores precise values.
- 4-bit stores only 16 possible levels. Each real value is rounded to the nearest level.
- Small rounding errors accumulate but are usually acceptable for large models.

---

## 3. Quantization in Detail

### 3.1 Why quantize?
- Memory: 1.5B parameters in fp16 need about 3 GB. 4-bit needs about 0.8 GB.
- Speed: smaller weights load faster and move faster through memory.
- Feasibility: makes training possible on a free T4 GPU.

### 3.2 Types of quantization
- Post-training quantization (PTQ): quantize after training.
- Quantization-aware training (QAT): simulate quantization during training for better accuracy.
- QLoRA: keep base weights 4-bit and train LoRA weights in 16-bit.

### 3.3 GGUF export and q4_k_m
GGUF is a format used by llama.cpp-like runtimes for CPU inference. The q4_k_m scheme is a good balance of size and quality for many CPUs (including Apple M-series).

---

## 4. Data Design and Prompting

### 4.1 Why two datasets?
We use:
- `train_dataset.jsonl` for learning.
- `train_dataset_eval.jsonl` for evaluation only.

Why? Because evaluation must use data the model did not see during training. This helps us detect overfitting and choose the best checkpoint.

### 4.2 Data leakage
If evaluation data leaks into training, the eval loss looks good even if the model is not generalizing. Always keep a strict separation.

### 4.3 Prompt template (ChatML)
The model expects a ChatML structure. If the training format and inference format mismatch, performance drops.

Example:
```
<|im_start|>system
You are a medical lab interpreter.
<|im_end|>
<|im_start|>user
{instruction}
{input}
<|im_end|>
<|im_start|>assistant
{output}
<|im_end|>
```

This matches how the model was originally trained for chat.

---

### 4.4 Rule-based dataset construction (curated + synthetic)
In this project, examples follow a strict set of rules so the model learns consistent, safe outputs. When we generate synthetic cases, we apply these same rules:
- Each example uses a fixed instruction so the model learns a stable task definition.
- Input always includes patient context (age, sex), test name, test code, numeric result, and units.
- Reference ranges are general clinical ranges and are sex-specific where appropriate.
- Output always starts with an **Analysis** section that lists result, reference range, and status.
- Status is assigned by comparing the value to the reference range (Normal, Low, High). For extreme values, we may mark as critical.
- Interpretation uses cautious language ("may indicate") and avoids definitive diagnosis.
- Recommendations are included for abnormal or critical results (follow-up, repeat test, or additional testing).
- Units are consistent between input and reference range to avoid scale errors.
- Names are standardized (one test name per biomarker) to reduce confusion.

These rules make the dataset predictable, easy to validate, and safer for clinical-style responses.

---

## 5. Training Loop (Deep Explanation)

### 5.1 Batch size and gradient accumulation
- Batch size is how many samples are processed in one forward pass.
- Large batch sizes smooth gradients but need more memory.
- Gradient accumulation simulates a larger batch by accumulating gradients over multiple mini-batches before stepping the optimizer.

Effective batch size:
```
Effective batch = batch_size * gradient_accumulation_steps
```

Example: batch_size=4 and grad_accum=4 -> effective batch = 16.

### 5.2 Steps, epochs, and total steps
- One epoch is one full pass over the dataset.
- One step is one optimizer update.
- Steps per epoch = num_examples / effective_batch.
- Total steps = steps_per_epoch * num_epochs.

### 5.3 Loss and backpropagation
- Training loss is the model's error on training batches.
- We backpropagate gradients and update LoRA weights.
- Lower loss means better fit to training data.

### 5.4 Validation loss
- Validation loss is computed on eval set.
- It is not used to update weights.
- If validation loss stops improving while training loss still drops, the model is overfitting.

### 5.5 Warmup
Warmup starts with a low learning rate and gradually increases it. This avoids unstable updates in the first steps.

### 5.6 Optimizer and scheduler
- AdamW is used because it is stable and standard for transformers.
- 8-bit AdamW reduces optimizer memory.
- Cosine scheduler slowly reduces learning rate to help convergence.

### 5.7 Mixed precision
- bf16 or fp16 speeds training and reduces memory.
- bf16 is preferred if hardware supports it (T4 supports bf16).

---

## 6. Overfitting vs Underfitting

### 6.1 Overfitting
Signs:
- Training loss keeps decreasing.
- Validation loss increases.
- Model outputs look too similar to training examples.

Fixes:
- Increase dropout.
- Reduce LoRA rank or epochs.
- Add more training data.
- Use early stopping (choose best eval checkpoint).

### 6.2 Underfitting
Signs:
- Both train and eval loss are high.
- Model outputs are generic or incorrect.

Fixes:
- Increase epochs.
- Increase LoRA rank.
- Increase learning rate slightly.
- Improve data quality.

---

## 7. Effects of Hyperparameters (What Happens if You Change Them)

| Parameter | Increase | Decrease | Risk |
| --- | --- | --- | --- |
| LoRA rank (r) | more capacity | less capacity | overfitting or underfitting |
| LoRA alpha | stronger updates | weaker updates | instability if too high |
| LoRA dropout | more regularization | less regularization | under/overfit |
| batch size | smoother gradients | noisier gradients | OOM if too high |
| grad accumulation | larger effective batch | smaller effective batch | longer step time |
| learning rate | faster learning | slower learning | divergence if too high |
| epochs | more training | less training | overfitting if too high |
| max seq length | longer contexts | shorter contexts | more memory |
| eval interval | fewer evals (faster) | more evals (slower) | overfit detection |

---

## 8. Evaluation Strategy

Why evaluate often?
- You can detect overfitting early.
- You can select the best checkpoint by lowest eval loss.

Tradeoff:
- Frequent evaluation slows training.
- Use a reasonable interval (e.g., every 100 steps) and adjust by dataset size.

---

## 9. Inference and Export

After training:
- Switch to inference mode.
- Generate responses using the same ChatML template.
- Low temperature (0.1 to 0.3) for deterministic clinical responses.

Export:
- Merge LoRA adapters into base model.
- Save as GGUF with q4_k_m.
- Use offline inference engines (llama.cpp family).

---

## 10. Practical Troubleshooting

- OOM (out of memory): reduce batch size, reduce rank, reduce max_seq_length.
- Loss does not improve: check data quality, reduce dropout, adjust learning rate.
- Outputs are irrelevant: check prompt format, check that train and inference formats match.
- Eval loss not computed: ensure eval dataset file exists and is loaded.

---

## 11. Visual Summaries

### 11.1 Training flow
```
Data -> Format -> Tokenize -> Forward -> Loss -> Backprop -> Update LoRA
                                |                          |
                                +------ eval loss ---------+
```

### 11.2 Gradient accumulation
```
Batch 1 -> backward -> accumulate grads
Batch 2 -> backward -> accumulate grads
Batch 3 -> backward -> accumulate grads
Batch 4 -> backward -> accumulate grads
Optimizer step -> clear grads
```

---

# Viva Questions and Answers (85)

The following questions are likely in a viva. Each answer is longer and oral-style so you can speak confidently and expand further if asked.

1. Q: What is fine-tuning in the context of LLMs?
   A: In a viva I would say fine-tuning is continuing training on a task-specific dataset so the model adapts to our domain. We do not start from scratch; we reuse the base model's general knowledge and only adjust it to our required behavior. This makes training cheaper, faster, and more practical.

2. Q: Why did you not train the model from scratch?
   A: Training from scratch needs massive datasets, weeks of GPU time, and expert infrastructure. For a domain task like lab interpretation, it is far more efficient to adapt a strong base model. Fine-tuning lets us focus on the medical interpretation style without reinventing the entire language model.

3. Q: What is LoRA and why use it?
   A: LoRA adds small trainable low-rank matrices to certain layers while keeping the original weights frozen. I would explain that this reduces memory and training time, because only a tiny fraction of parameters update. It is a practical way to specialize the model without expensive full fine-tuning.

4. Q: What is QLoRA?
   A: QLoRA combines quantization and LoRA. The base model is stored in 4-bit to save memory, while the LoRA adapters are trained in higher precision. In a viva I would say it gives the best of both worlds: low memory usage and stable training.

5. Q: Why use 4-bit quantization?
   A: 4-bit quantization dramatically reduces memory so the model fits on a free T4 GPU. The quality loss is small with good quantization schemes, so it is a strong tradeoff. Without 4-bit, the model would not be feasible on Colab hardware.

6. Q: What is the difference between fp16 and bf16?
   A: Both are 16-bit floating formats, but bf16 has a wider exponent range which makes it more stable for training. On hardware that supports it, bf16 often prevents overflow issues compared to fp16. That is why we auto-select bf16 when available.

7. Q: Why do you keep the base model frozen?
   A: Freezing preserves the model's broad language knowledge and reduces compute. We only need to teach task-specific behavior, so updating only adapters is sufficient. It also reduces the risk of catastrophic forgetting.

8. Q: What is the role of the LoRA rank r?
   A: The rank controls how much capacity the adapters have. In a viva I would say higher rank allows the model to learn more complex patterns, but it increases memory usage and overfitting risk. So r is a tradeoff between capacity and stability.

9. Q: Why is lora_alpha often set to about 2x r?
   A: lora_alpha scales the update magnitude from the adapters. Using about 2x r is a common heuristic that keeps updates strong enough to learn while remaining stable. If alpha is too high, training can become unstable.

10. Q: What does lora_dropout do?
    A: lora_dropout randomly drops adapter activations during training. I would describe it as regularization that prevents the adapters from overfitting the training examples. Too much dropout, however, can make learning too weak.

11. Q: What is gradient accumulation?
    A: Gradient accumulation means we perform several forward-backward passes and accumulate gradients before doing one optimizer step. This simulates a larger batch size without needing extra GPU memory. It is very useful when the GPU cannot handle large batches directly.

12. Q: Why not just increase batch size instead of gradient accumulation?
    A: Because batch size is limited by GPU memory. If I try to increase it too much, training crashes with OOM. Accumulation gives the same gradient effect but fits into memory.

13. Q: What is an epoch?
    A: An epoch is one full pass through all training examples. In a viva I would explain that more epochs allow the model to learn more, but too many can cause overfitting.

14. Q: What is a training step?
    A: A step is one optimizer update. Usually it happens after one effective batch, which might involve gradient accumulation. The number of steps determines how many parameter updates we perform.

15. Q: How do you calculate total steps?
    A: total_steps = (num_examples / effective_batch) * num_epochs. This tells us how many optimizer updates will happen. We use it to set warmup and evaluation intervals consistently.

16. Q: What is warmup in training?
    A: Warmup gradually increases the learning rate from a small value to the target value. In the early steps the model is unstable, so a small learning rate avoids large destructive updates. It stabilizes training.

17. Q: Why use AdamW optimizer?
    A: AdamW is a standard, stable optimizer for transformers. It decouples weight decay from gradient updates, which helps regularization without harming adaptive learning rates. It is widely proven in LLM training.

18. Q: Why use 8-bit AdamW?
    A: The optimizer itself takes a lot of memory. 8-bit AdamW reduces that memory while preserving most performance. It is essential on smaller GPUs.

19. Q: What is learning rate scheduling?
    A: Learning rate scheduling changes the learning rate over time. We use cosine decay so the learning rate starts high enough to learn and then slowly reduces to fine-tune the weights at the end. It improves convergence.

20. Q: What is training loss?
    A: Training loss is the error on the batches used for updating parameters. It directly drives gradient updates. Lower training loss means the model fits the training data better.

21. Q: What is validation loss?
    A: Validation loss is the error on held-out examples that are not used for training updates. It measures generalization. If validation loss worsens while training loss improves, that indicates overfitting.

22. Q: How do you detect overfitting?
    A: I would look for a gap where training loss keeps going down but validation loss starts going up. That tells me the model is memorizing rather than generalizing. I would also test on new prompts to confirm.

23. Q: How do you mitigate overfitting?
    A: Use more regularization like dropout, reduce LoRA rank, or stop training earlier. More diverse data also helps. In practice, selecting the checkpoint with best validation loss is a strong defense.

24. Q: What is underfitting?
    A: Underfitting means the model has not learned enough from the data. Both training and validation loss remain high, and outputs are generic or incorrect. It indicates insufficient capacity or training time.

25. Q: How do you fix underfitting?
    A: Increase training epochs, increase LoRA rank, or slightly raise the learning rate. Another fix is to improve data quality and add more examples to help the model learn patterns.

26. Q: Why do you need a separate eval dataset?
    A: The eval dataset tests generalization on unseen data. If we evaluated on the training set, the numbers would look artificially good. A separate eval set gives a more honest measure of performance.

27. Q: What is data leakage?
    A: Data leakage is when evaluation data appears in training, directly or indirectly. It makes the model look better than it is. In a medical setting, that is dangerous because it hides generalization failures.

28. Q: What is ChatML and why use it?
    A: ChatML is the structured format the base model expects for conversations. Using the same format during training and inference helps the model produce coherent responses. If you change the format, the model can behave unpredictably.

29. Q: What happens if training and inference prompts differ?
    A: The model may not recognize the structure it was trained on and its outputs may degrade. In a viva I would say prompt consistency is as important as data quality. It is like teaching in one language and testing in another.

30. Q: What is max_seq_length?
    A: It is the maximum number of tokens the model can process in one example. Longer lengths allow longer reports, but they consume more memory and reduce batch size. We pick a value that fits the GPU.

31. Q: Why do you log metrics every few steps?
    A: Frequent logging lets us detect instability early, like a sudden spike in loss. It also helps us monitor learning progress and decide if we should stop or adjust hyperparameters.

32. Q: What is eval interval?
    A: Eval interval is how often we run validation. More frequent evaluation gives better monitoring, but it slows training. We choose a balance based on dataset size and training time.

33. Q: What is checkpointing?
    A: Checkpointing saves intermediate model states. If training crashes, we can resume. It also lets us pick the best checkpoint based on validation loss, not just the final step.

34. Q: Why load the best model at the end?
    A: The final checkpoint can be overfit. The best model is usually the one with the lowest validation loss. Loading the best checkpoint ensures better generalization.

35. Q: What is the purpose of weight decay?
    A: Weight decay is a regularization method that discourages overly large weights. It helps reduce overfitting and improves generalization, especially on small datasets.

36. Q: Why is temperature low during inference?
    A: Low temperature makes outputs more deterministic and less random. For clinical interpretation, we prefer stable, conservative answers rather than creative ones. So we keep temperature around 0.1 to 0.3.

37. Q: What is tokenization?
    A: Tokenization converts text into numerical tokens the model can process. It affects sequence length and memory usage. Inconsistent tokenization between training and inference can break model behavior.

38. Q: Why use q4_k_m for GGUF export?
    A: q4_k_m is a good balance of size and accuracy for CPU inference. It runs efficiently on resource-limited machines while preserving most quality. That makes deployment practical.

39. Q: What is the difference between PTQ and QAT?
    A: PTQ quantizes after training, while QAT simulates quantization during training to preserve accuracy. QLoRA is closer to QAT in spirit because it trains with a quantized base. It usually gives better results than naive PTQ.

40. Q: Why do you choose T4 GPU?
    A: It is available for free in Colab and has enough memory for 4-bit fine-tuning with LoRA. It also supports bf16, which improves training stability. That makes it a practical choice for students.

41. Q: What does `target_modules` do in LoRA?
    A: It selects which layers receive LoRA adapters. We focus on attention and MLP projection layers because they carry most of the model's transform capacity. Adapting these gives the largest impact for minimal parameters.

42. Q: What is catastrophic forgetting?
    A: It is when the model loses general knowledge after fine-tuning. By freezing the base and only training adapters, we avoid large destructive updates. That is one of the main benefits of LoRA.

43. Q: How does gradient checkpointing help?
    A: It reduces memory by recomputing some activations during the backward pass. This trades extra compute for lower memory usage. It is helpful when GPU memory is the main bottleneck.

44. Q: Why choose r=32 in this project?
    A: The lab domain has many biomarkers and interpretation patterns, so we need enough capacity to capture them. A higher rank like 32 gives adapters more expressive power. It is a tradeoff between learning capacity and memory.

45. Q: What would happen if r is too high?
    A: Memory usage increases and training becomes slower. It can also overfit the dataset, especially if the dataset is small. So r must be tuned carefully.

46. Q: What would happen if learning rate is too high?
    A: Training can diverge or oscillate, and loss may spike instead of decreasing. That makes the model unstable. In practice, you lower the learning rate or increase warmup.

47. Q: What would happen if learning rate is too low?
    A: Training becomes very slow and may underfit. The loss decreases very slowly, and the model does not fully learn the task. You may need more epochs or a higher learning rate.

48. Q: Why do you use `train_dataset_eval.jsonl` instead of splitting automatically?
    A: It gives explicit control over evaluation data and avoids accidental leakage. We can ensure the eval set contains balanced biomarkers or harder cases. Manual splits are safer in small domain datasets.

49. Q: How do you ensure the model learned the task?
    A: I look at validation loss trends and run inference tests on unseen examples. I also check whether the outputs follow clinical reasoning and mention reference ranges appropriately. Both metrics and qualitative tests matter.

50. Q: What is perplexity?
    A: Perplexity is a metric derived from loss; it measures how well the model predicts tokens. Lower perplexity means better predictive performance. It is commonly used to compare language models.

51. Q: How do you choose the number of epochs?
    A: I watch validation loss and stop when it stops improving. For small datasets, too many epochs overfit quickly. The right number is a balance between learning and generalization.

52. Q: Why is effective batch size important?
    A: It influences gradient noise. A larger effective batch gives smoother gradients but may reduce generalization. A smaller batch adds noise that can help generalization but may destabilize training.

53. Q: How do you handle long lab reports beyond max_seq_length?
    A: I can truncate irrelevant sections, summarize input, or increase max_seq_length if memory allows. Another approach is splitting long reports into multiple prompts. The choice depends on GPU constraints and required context.

54. Q: What is the role of the tokenizer in training?
    A: The tokenizer defines how text is split into tokens, which affects sequence length and meaning. Using the correct tokenizer is essential; otherwise the model learns incorrect token patterns. Inconsistent tokenization leads to poor performance.

55. Q: Why use SFTTrainer from TRL?
    A: It simplifies supervised fine-tuning by handling data collation, loss computation, and training loops. It reduces boilerplate and helps avoid mistakes. This makes the training process more reliable.

56. Q: What is eval_loss used for in this script?
    A: It is the metric for selecting the best checkpoint. We set `metric_for_best_model` to eval_loss and load the best model at the end. That helps avoid keeping an overfit final checkpoint.

57. Q: What happens if eval dataset is missing?
    A: Training still works, but we lose the ability to measure generalization during training. That makes overfitting harder to detect. In a viva I would say eval data is strongly recommended even if small.

58. Q: Why do you keep report_to="none"?
    A: It disables external experiment tracking like W and B. In Colab, this keeps setup simple and avoids requiring extra logins. It is a practical choice for student workflows.

59. Q: How does quantization affect inference quality?
    A: Quantization introduces small rounding errors that can reduce accuracy slightly. However, good quantization schemes preserve most performance while saving memory. For this project, the size benefits outweigh the small quality loss.

60. Q: How do you explain the full pipeline in one sentence?
    A: We format labeled lab data, fine-tune a quantized base model using LoRA adapters, evaluate on a separate set, and export a compact GGUF model for deployment.

61. Q: How do you ensure clinical safety in outputs?
    A: I would say we constrain outputs through the system prompt to emphasize interpretation and caution. We also train on examples that include safe wording and encourage referring to clinicians. This reduces risky or overconfident statements.

62. Q: How do you handle critical lab values in the dataset?
    A: We include examples where values are clearly outside reference ranges and the expected response highlights urgency. This teaches the model to flag critical values. It is important because safety depends on correctly handling extremes.

63. Q: Why include patient context like age and sex?
    A: Many lab reference ranges are age- and sex-specific. Including these fields allows the model to interpret values more accurately. Without them, interpretations can be misleading.

64. Q: How do you address unit mismatches in lab data?
    A: We standardize units in the dataset and keep them explicit in prompts. If units are inconsistent, the model may compare values against the wrong scale. So unit consistency is a key data-quality step.

65. Q: What is the role of reference ranges in your training data?
    A: Reference ranges provide the clinical context for deciding if a value is normal or abnormal. We include them directly or implicitly in training examples so the model learns to reason with them. Without ranges, the model may hallucinate.

66. Q: How do you evaluate clinical correctness beyond loss?
    A: I would say we need qualitative checks like clinician review or rule-based comparisons with known thresholds. Loss alone does not guarantee clinical safety. Domain experts or validation scripts add important assurance.

67. Q: How do you prevent hallucination of diagnoses?
    A: We structure the system prompt to focus on interpretation and recommend clinical follow-up rather than diagnosis. Training data should also avoid making definitive diagnoses. This reduces the chance of overconfident or unsafe outputs.

68. Q: How do you handle rare biomarkers with few examples?
    A: We can upsample those cases or add synthetic examples carefully. Another method is to increase LoRA rank or provide few-shot templates during inference. The key is to avoid bias toward common tests only.

69. Q: Why do you include multiple tests in a single prompt?
    A: Real lab reports often contain panels, not single tests. Training on multi-test prompts teaches the model to summarize patterns and cross-reference values. It also makes the model more realistic for deployment.

70. Q: How do you ensure the model does not ignore abnormal values?
    A: We include explicit examples where abnormal values must be highlighted. We also evaluate by testing prompts with clear abnormalities. If the model misses them, it indicates training data imbalance or insufficient emphasis.

71. Q: What is the benefit of using ChatML for clinical tasks?
    A: It enforces a structured system/user/assistant separation. The system message can encode safety rules, which the model learns to follow. That makes outputs more consistent and cautious.

72. Q: How do you manage privacy or HIPAA concerns in training data?
    A: We de-identify any personal information and keep only medically relevant fields. We also avoid storing direct identifiers. In a viva I would highlight that patient privacy is a strict requirement.

73. Q: How do you handle missing fields in lab data?
    A: We either standardize missing values or include examples showing how to respond when data is incomplete. The model learns to mention uncertainty rather than making assumptions. This is important for safe responses.

74. Q: What happens if the dataset is imbalanced across biomarkers?
    A: The model will be stronger on common tests and weaker on rare ones. To fix this, we can balance or upsample rare biomarkers. Otherwise evaluation will reveal gaps.

75. Q: How do you align the model's tone with medical professionalism?
    A: We include examples with formal, cautious language and avoid overly casual phrasing. The system prompt reinforces professional tone. This ensures consistency in clinical settings.

76. Q: How do you validate that the model does not give harmful advice?
    A: We perform manual reviews on edge cases and critical values. We also test prompts that could trigger unsafe advice. If needed, we refine the system prompt and add training examples that demonstrate safe behavior.

77. Q: How do you handle interpretation of borderline values?
    A: We include examples near the reference range boundaries. The model learns to state "slightly elevated" or "borderline" rather than making extreme conclusions. This makes outputs more clinically realistic.

78. Q: Why is consistency in biomarker naming important?
    A: If the same test is named differently, the model may treat them as separate tests. Standardizing naming improves learning and reduces confusion. It also helps with downstream evaluation and deployment.

79. Q: How do you handle multiple reference ranges for different labs?
    A: We can include lab-specific ranges in the prompt or normalize ranges before training. The model must see the correct range for each lab. Otherwise it might apply a general range that is inaccurate.

80. Q: What is the role of evaluation prompts after training?
    A: Evaluation prompts check if the model generalizes to new cases and edge conditions. They should be different from training data to avoid leakage. This is the closest proxy to real-world deployment behavior.

81. Q: How do you explain your choice of dataset size?
    A: I would say the dataset is sized based on available labeled examples and training budget. For LoRA fine-tuning, thousands of examples can be sufficient if they are high quality. The key is coverage and diversity, not just volume.

82. Q: Why do you prefer deterministic responses for clinical tasks?
    A: Determinism reduces variability and makes outputs more predictable. In a clinical context, consistent responses are important for trust and safety. That is why we keep temperature low.

83. Q: What is your strategy for verifying reference ranges?
    A: We cross-check ranges during dataset preparation and avoid mixing units. If ranges are inconsistent, the model will learn incorrect patterns. So range validation is a critical preprocessing step.

84. Q: How would you improve the system in future work?
    A: I would add more data for rare biomarkers, evaluate with clinicians, and experiment with better safety constraints. I would also measure performance with task-specific metrics beyond loss, like correctness of abnormal/normal classification.

85. Q: If the model outputs a wrong interpretation, how do you debug it?
    A: First, I check if the prompt format matches training. Then I inspect similar examples in the dataset to see if the model learned incorrect patterns. Finally, I adjust data or hyperparameters and re-train with targeted fixes.

86. Q: How did you get the training and eval datasets? Are they synthetic, and how do you know they are accurate? What about overfitting?
    A: I would explain that the datasets were prepared from curated lab-interpretation examples, and in this project we also use controlled synthetic examples where needed to cover rare or critical cases. Synthetic data is generated using rules and reference ranges so that the outputs are consistent with standard clinical interpretation. Accuracy is checked by validating units and ranges, spot-checking outputs against known reference values, and reviewing a sample of examples for clinical plausibility. We also keep a separate eval set that is not used in training, so we can detect overfitting: if train loss goes down but eval loss goes up, it means the model is memorizing rather than generalizing. In that case, we reduce epochs, add more diverse examples, or increase regularization such as LoRA dropout.

87. Q: What rules were used to construct the dataset?
    A: I would say we used a rule-based template to keep every example consistent. Each record includes patient age and sex, test name and code, a numeric result with units, and a reference range. We then compute the status by comparing the value to the range, and we write the output in a fixed structure: Analysis (result, range, status), Interpretation, and Recommendations if abnormal. We also enforce safety rules like using cautious language ("may indicate") and avoiding definitive diagnoses. These rules make the dataset accurate, consistent, and easier to validate.

---

If you want, I can add an oral exam practice section with short explanations for each section and a timed mock viva script.
