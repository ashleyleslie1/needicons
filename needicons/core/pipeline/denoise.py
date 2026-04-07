"""Denoise pipeline step using OpenCV."""
from __future__ import annotations
import cv2
import numpy as np
from PIL import Image
from needicons.core.pipeline.base import PipelineStep


class DenoiseStep(PipelineStep):
    name = "denoise"

    def can_skip(self, image: Image.Image, config: dict) -> bool:
        return config.get("strength", 0) <= 0

    def process(self, image: Image.Image, config: dict) -> Image.Image:
        strength = max(1, min(10, config.get("strength", 5)))
        h_value = strength * 3

        img_rgba = image.convert("RGBA")
        r, g, b, a = img_rgba.split()

        # Convert RGB to numpy BGR for OpenCV
        rgb = Image.merge("RGB", (r, g, b))
        arr = cv2.cvtColor(np.array(rgb), cv2.COLOR_RGB2BGR)

        # Apply denoising
        denoised = cv2.fastNlMeansDenoisingColored(
            arr, None, h_value, h_value, 7, 21
        )

        # Convert back to PIL and restore alpha
        denoised_rgb = cv2.cvtColor(denoised, cv2.COLOR_BGR2RGB)
        result = Image.fromarray(denoised_rgb).convert("RGBA")
        result.putalpha(a)
        return result
