"""
Qwen Local Inference Service
==============================
Loads and runs the fine-tuned Qwen 2.5-3B-Instruct model (GGUF format)
locally via llama-cpp-python for lab report interpretation.

The model is loaded lazily (on first use) as a singleton.
All inference uses ChatML format matching the fine-tuning template.

Usage:
    from app.lab_interpreter.services.qwen_inference import get_qwen_service

    qwen = get_qwen_service()
    response = qwen.generate("Patient: Male, 55 years old.\\nTest: Hemoglobin...")
"""

import os
import logging
from typing import Optional

logger = logging.getLogger(__name__)

# Singleton model instance
_model = None
_model_loaded = False


def _load_model():
    """Load the GGUF model via llama-cpp-python. Called once."""
    global _model, _model_loaded

    if _model_loaded:
        return _model

    try:
        from llama_cpp import Llama
    except ImportError:
        raise ImportError(
            "llama-cpp-python is not installed. "
            "Install with: pip install llama-cpp-python\n"
            "For Metal GPU on Mac: CMAKE_ARGS=\"-DLLAMA_METAL=on\" pip install llama-cpp-python"
        )

    # Get model path from env or config
    model_path = os.getenv("QWEN_MODEL_PATH", "")
    if not model_path:
        try:
            from app.core.config import settings
            model_path = getattr(settings, "QWEN_MODEL_PATH", "")
        except Exception:
            pass

    if not model_path:
        logger.warning(
            "QWEN_MODEL_PATH not set. Qwen inference will not be available. "
            "Set it in .env to the path of your .gguf model file."
        )
        _model_loaded = True  # Mark as attempted
        return None

    if not os.path.exists(model_path):
        logger.error(f"Qwen model file not found: {model_path}")
        _model_loaded = True
        return None

    logger.info(f"Loading Qwen model from: {model_path}")
    logger.info("This may take 10-30 seconds on first load...")

    try:
        _model = Llama(
            model_path=model_path,
            n_ctx=2048,          # Context window (matches training)
            n_threads=4,         # CPU threads
            n_gpu_layers=-1,     # Offload ALL layers to Metal GPU (Mac)
            verbose=False,
        )
        _model_loaded = True
        logger.info(
            f"✅ Qwen model loaded successfully "
            f"({os.path.getsize(model_path) / (1024**3):.1f} GB)"
        )
        return _model

    except Exception as e:
        logger.error(f"Failed to load Qwen model: {e}")
        _model_loaded = True
        return None


# ─── ChatML template (matches fine-tuning format) ────────────────────────────
SYSTEM_PROMPT = (
    "You are a medical lab interpreter. Analyze lab results based on the "
    "provided reference ranges and provide clinical interpretations with "
    "recommendations."
)


class QwenInferenceService:
    """Service for running inference on the fine-tuned Qwen model."""

    def __init__(self):
        self._model = None

    @property
    def model(self):
        if self._model is None:
            self._model = _load_model()
        return self._model

    def generate(self, prompt: str) -> str:
        """
        Generate an interpretation for a single biomarker prompt.

        The prompt should be in the training format:
            Patient: Male, 55 years old.
            Test: Hemoglobin (hemoglobin)
            Result: 10.2 g/dL
            Reference Range: 14.0-18.0 g/dL
            Critical Thresholds: Critical Low: 7.0 | Critical High: 20.0 g/dL

        Args:
            prompt: The user prompt (biomarker data in training format)

        Returns:
            Model response with Analysis, Interpretation, Recommendations, Conclusion
        """
        if self.model is None:
            raise RuntimeError(
                "Qwen model is not loaded. Check QWEN_MODEL_PATH in .env"
            )

        # Build ChatML-format input matching training template
        full_prompt = (
            f"<|im_start|>system\n{SYSTEM_PROMPT}\n<|im_end|>\n"
            f"<|im_start|>user\n{prompt}\n<|im_end|>\n"
            f"<|im_start|>assistant\n"
        )

        try:
            output = self.model(
                full_prompt,
                max_tokens=384,
                temperature=0.01,      # Near-deterministic for clinical accuracy
                top_p=0.95,
                stop=["<|im_end|>"],   # Stop at end of assistant response
                echo=False,            # Don't echo the prompt
            )

            response = output["choices"][0]["text"].strip()
            return response

        except Exception as e:
            logger.error(f"Qwen inference error: {e}")
            raise RuntimeError(f"Qwen inference failed: {str(e)}")

    @property
    def is_loaded(self) -> bool:
        """Check if the model is successfully loaded."""
        return self.model is not None


# ─── Singleton ────────────────────────────────────────────────────────────────
_service: Optional[QwenInferenceService] = None


def get_qwen_service() -> QwenInferenceService:
    """Get or create the singleton QwenInferenceService."""
    global _service
    if _service is None:
        _service = QwenInferenceService()
    return _service
