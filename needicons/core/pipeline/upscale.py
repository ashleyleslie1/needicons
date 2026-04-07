"""Upscale pipeline step using Real-ESRGAN (optional) or Pillow LANCZOS fallback."""
from __future__ import annotations
import logging
from PIL import Image
from needicons.core.pipeline.base import PipelineStep

logger = logging.getLogger(__name__)


def _try_realesrgan(image: Image.Image, factor: int) -> Image.Image | None:
    """Try Real-ESRGAN upscale. Returns None if not available."""
    try:
        from realesrgan_ncnn_py import Realesrgan
        upscaler = Realesrgan(gpuid=0, scale=factor)
        import numpy as np
        arr = np.array(image)
        result = upscaler.process(arr)
        return Image.fromarray(result)
    except ImportError:
        return None
    except Exception as e:
        logger.warning(f"Real-ESRGAN failed, falling back to LANCZOS: {e}")
        return None


class UpscaleStep(PipelineStep):
    name = "upscale"

    def can_skip(self, image: Image.Image, config: dict) -> bool:
        return config.get("factor", 1) <= 1

    def process(self, image: Image.Image, config: dict) -> Image.Image:
        factor = config.get("factor", 2)
        if factor not in (2, 4):
            factor = 2

        # Try Real-ESRGAN first
        result = _try_realesrgan(image, factor)
        if result is not None:
            return result

        # Fallback to LANCZOS
        logger.info(f"Using LANCZOS fallback for {factor}x upscale")
        w, h = image.size
        return image.resize((w * factor, h * factor), Image.LANCZOS)
