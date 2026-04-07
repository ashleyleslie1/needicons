"""Background removal pipeline step using rembg with GPU acceleration."""
from __future__ import annotations

import numpy as np
from PIL import Image

from needicons.core.pipeline.base import PipelineStep

# Cached rembg sessions keyed by (model, providers_tuple)
_session_cache: dict[tuple, object] = {}


def _get_onnx_providers(preference: str = "auto") -> list[str]:
    """Return ordered ONNX execution providers based on user preference."""
    try:
        import onnxruntime as ort
        available = ort.get_available_providers()
    except ImportError:
        return ["CPUExecutionProvider"]

    if preference == "cpu":
        return ["CPUExecutionProvider"]

    if preference == "directml":
        if "DmlExecutionProvider" in available:
            return ["DmlExecutionProvider", "CPUExecutionProvider"]
        return ["CPUExecutionProvider"]

    if preference == "cuda":
        if "CUDAExecutionProvider" in available:
            return ["CUDAExecutionProvider", "CPUExecutionProvider"]
        return ["CPUExecutionProvider"]

    # auto: try best available
    if "DmlExecutionProvider" in available:
        return ["DmlExecutionProvider", "CPUExecutionProvider"]
    if "CUDAExecutionProvider" in available:
        return ["CUDAExecutionProvider", "CPUExecutionProvider"]
    if "ROCMExecutionProvider" in available:
        return ["ROCMExecutionProvider", "CPUExecutionProvider"]
    return ["CPUExecutionProvider"]


def _get_session(model: str, providers: list[str]):
    """Get or create a cached rembg session with specific providers."""
    from rembg import new_session
    key = (model, tuple(providers))
    if key not in _session_cache:
        _session_cache[key] = new_session(model, providers=providers)
    return _session_cache[key]


def clear_session_cache():
    """Clear cached sessions (call when provider preference changes)."""
    _session_cache.clear()


def _has_transparency(image: Image.Image, threshold: float = 0.05) -> bool:
    """Check if image already has meaningful transparency."""
    if image.mode != "RGBA":
        return False
    alpha = np.array(image.split()[3])
    transparent_ratio = np.sum(alpha < 250) / alpha.size
    return bool(transparent_ratio > threshold)


class BackgroundRemovalStep(PipelineStep):
    name = "background_removal"

    def can_skip(self, image: Image.Image, config: dict) -> bool:
        if not config.get("enabled", True):
            return True
        return _has_transparency(image)

    def process(self, image: Image.Image, config: dict) -> Image.Image:
        from rembg import remove

        model = config.get("model", "u2net")
        gpu_provider = config.get("gpu_provider", "auto")
        providers = _get_onnx_providers(gpu_provider)
        session = _get_session(model, providers)

        kwargs: dict = {}
        if config.get("alpha_matting", False):
            kwargs["alpha_matting"] = True
            kwargs["alpha_matting_foreground_threshold"] = config.get(
                "alpha_matting_foreground_threshold", 240
            )
            kwargs["alpha_matting_background_threshold"] = config.get(
                "alpha_matting_background_threshold", 10
            )

        result = remove(image, session=session, **kwargs)
        return result.convert("RGBA")


def cleanup_background_residue(image: Image.Image) -> Image.Image:
    """Remove near-white pixels with partial transparency left by rembg."""
    arr = np.array(image, dtype=np.float32)
    rgb = arr[:, :, :3]
    alpha = arr[:, :, 3]
    brightness = rgb.mean(axis=2)
    bright_mask = brightness > 230
    fade = np.clip((brightness - 230) / 25, 0, 1)
    alpha[bright_mask] *= (1 - fade[bright_mask] * 0.8)
    arr[:, :, 3] = alpha
    return Image.fromarray(arr.astype(np.uint8))
