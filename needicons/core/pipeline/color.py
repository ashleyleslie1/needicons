"""Color processing pipeline step."""
from __future__ import annotations

import numpy as np
from PIL import Image, ImageEnhance

from needicons.core.pipeline.base import PipelineStep


def _hex_to_rgb(hex_color: str) -> tuple[int, int, int]:
    h = hex_color.lstrip("#")
    return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))


class ColorProcessingStep(PipelineStep):
    name = "color"

    def can_skip(self, image: Image.Image, config: dict) -> bool:
        return (
            config.get("overlay_color") is None
            and config.get("brightness", 0) == 0
            and config.get("contrast", 0) == 0
            and config.get("saturation", 0) == 0
        )

    def process(self, image: Image.Image, config: dict) -> Image.Image:
        result = image.copy()
        alpha = result.split()[3]

        overlay = config.get("overlay_color")
        if overlay:
            gray = result.convert("L")
            r, g, b = _hex_to_rgb(overlay)
            arr = np.array(gray, dtype=np.float32) / 255.0
            colored = np.stack([
                (arr * r).astype(np.uint8),
                (arr * g).astype(np.uint8),
                (arr * b).astype(np.uint8),
            ], axis=-1)
            result = Image.fromarray(colored, "RGB").convert("RGBA")
            result.putalpha(alpha)

        brightness = config.get("brightness", 0)
        if brightness != 0:
            factor = 1.0 + (brightness / 100.0)
            rgb = result.convert("RGB")
            rgb = ImageEnhance.Brightness(rgb).enhance(factor)
            result = rgb.convert("RGBA")
            result.putalpha(alpha)

        contrast = config.get("contrast", 0)
        if contrast != 0:
            factor = 1.0 + (contrast / 100.0)
            rgb = result.convert("RGB")
            rgb = ImageEnhance.Contrast(rgb).enhance(factor)
            result = rgb.convert("RGBA")
            result.putalpha(alpha)

        saturation = config.get("saturation", 0)
        if saturation != 0:
            factor = 1.0 + (saturation / 100.0)
            rgb = result.convert("RGB")
            rgb = ImageEnhance.Color(rgb).enhance(factor)
            result = rgb.convert("RGBA")
            result.putalpha(alpha)

        return result
