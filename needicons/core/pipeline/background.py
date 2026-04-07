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


def _is_bimodal_alpha(image: Image.Image, threshold: float = 0.80) -> bool:
    """Check if alpha channel is bimodal (clean transparency — most pixels fully opaque or fully transparent).

    Returns True if >= threshold fraction of pixels have alpha < 10 or alpha > 245.
    This detects images that already have clean transparency and don't need aggressive BG removal.
    Also returns True for fully opaque or RGB images (all pixels count as alpha > 245).
    """
    if image.mode != "RGBA":
        return True  # No alpha channel = all pixels effectively opaque = bimodal
    alpha = np.array(image.split()[3])
    extreme_ratio = np.sum((alpha < 10) | (alpha > 245)) / alpha.size
    return bool(extreme_ratio >= threshold)


def _color_threshold_remove(image: Image.Image, level: int) -> Image.Image:
    """Lite strategy (levels 1-3): detect bg color from corners, remove within color distance."""
    arr = np.array(image.convert("RGBA"), dtype=np.float32)
    h, w = arr.shape[:2]
    patch = 5
    corners = [
        arr[:patch, :patch, :3],
        arr[:patch, w-patch:, :3],
        arr[h-patch:, :patch, :3],
        arr[h-patch:, w-patch:, :3],
    ]
    corner_pixels = np.concatenate([c.reshape(-1, 3) for c in corners], axis=0)
    bg_color = np.median(corner_pixels, axis=0)
    tolerance = 20 + (level - 1) * 30
    rgb = arr[:, :, :3]
    dist = np.sqrt(np.sum((rgb - bg_color) ** 2, axis=2))
    inner = tolerance * 0.7
    alpha_factor = np.clip((dist - inner) / (tolerance - inner + 1e-6), 0, 1)
    new_alpha = arr[:, :, 3] * alpha_factor
    arr[:, :, 3] = new_alpha
    return Image.fromarray(arr.astype(np.uint8))


def _rembg_medium_remove(image: Image.Image, level: int, gpu_provider: str = "auto") -> Image.Image:
    """Medium strategy (levels 4-7): rembg isnet-general-use + alpha matting.

    Falls back to no-matting if the system lacks sufficient memory for pymatting.
    """
    from rembg import remove
    fg_threshold = int(240 - (level - 4) * 15)
    bg_threshold = int(10 + (level - 4) * 12)
    providers = _get_onnx_providers(gpu_provider)
    session = _get_session("isnet-general-use", providers)
    try:
        result = remove(
            image, session=session, alpha_matting=True,
            alpha_matting_foreground_threshold=fg_threshold,
            alpha_matting_background_threshold=bg_threshold,
        )
    except MemoryError:
        result = remove(image, session=session, alpha_matting=False)
    return result.convert("RGBA")


def _rembg_medium_remove_no_matting(image: Image.Image, gpu_provider: str = "auto") -> Image.Image:
    """Medium strategy without alpha matting: rembg isnet-general-use."""
    from rembg import remove
    providers = _get_onnx_providers(gpu_provider)
    session = _get_session("isnet-general-use", providers)
    result = remove(image, session=session, alpha_matting=False)
    return result.convert("RGBA")


def _rembg_aggressive_remove(image: Image.Image, level: int, gpu_provider: str = "auto") -> Image.Image:
    """Aggressive strategy (levels 8-10): rembg u2net + tight alpha matting.

    Falls back to no-matting if the system lacks sufficient memory for pymatting.
    """
    from rembg import remove
    fg_threshold = int(220 - (level - 8) * 20)
    bg_threshold = int(30 + (level - 8) * 15)
    providers = _get_onnx_providers(gpu_provider)
    session = _get_session("u2net", providers)
    try:
        result = remove(
            image, session=session, alpha_matting=True,
            alpha_matting_foreground_threshold=fg_threshold,
            alpha_matting_background_threshold=bg_threshold,
        )
    except MemoryError:
        result = remove(image, session=session, alpha_matting=False)
    return result.convert("RGBA")


def _rembg_aggressive_remove_no_matting(image: Image.Image, gpu_provider: str = "auto") -> Image.Image:
    """Aggressive strategy without alpha matting: rembg u2net."""
    from rembg import remove
    providers = _get_onnx_providers(gpu_provider)
    session = _get_session("u2net", providers)
    result = remove(image, session=session, alpha_matting=False)
    return result.convert("RGBA")


def remove_background(image: Image.Image, level: int, gpu_provider: str = "auto") -> Image.Image:
    """Remove background using strategy based on level (1-10).

    1-3: Color threshold (fast, for solid backgrounds); skips if alpha is already bimodal
    4-7: rembg isnet-general-use + alpha matting; skips if alpha is already bimodal
    8-10: rembg u2net; uses no-matting variant if alpha is already bimodal

    Bimodal skip only applies when the image already has meaningful transparency —
    fully opaque images are always processed.
    """
    level = max(1, min(10, level))
    image = image.convert("RGBA")
    # Only treat as bimodal (skip-worthy) if the image already has *some* transparency
    has_transparency = _has_transparency(image)
    bimodal = has_transparency and _is_bimodal_alpha(image)
    if level <= 3:
        if bimodal:
            return image
        return _color_threshold_remove(image, level)
    elif level <= 7:
        if bimodal:
            return image
        return _rembg_medium_remove(image, level, gpu_provider)
    else:
        if bimodal:
            return _rembg_aggressive_remove_no_matting(image, gpu_provider)
        return _rembg_aggressive_remove(image, level, gpu_provider)


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

        try:
            result = remove(image, session=session, **kwargs)
        except MemoryError:
            result = remove(image, session=session, alpha_matting=False)
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
