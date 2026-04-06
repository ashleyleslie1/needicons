"""Background removal pipeline step using rembg."""
from __future__ import annotations

import numpy as np
from PIL import Image

from needicons.core.pipeline.base import PipelineStep


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
        from rembg import remove, new_session

        model = config.get("model", "u2net")
        session = new_session(model)

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
