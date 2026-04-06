"""Stroke/outline pipeline step."""
from __future__ import annotations

import cv2
import numpy as np
from PIL import Image

from needicons.core.pipeline.base import PipelineStep


def _hex_to_rgba(hex_color: str) -> tuple[int, int, int, int]:
    h = hex_color.lstrip("#")
    if len(h) == 6:
        r, g, b = int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)
        return (r, g, b, 255)
    elif len(h) == 8:
        r, g, b, a = int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), int(h[6:8], 16)
        return (r, g, b, a)
    return (0, 0, 0, 255)


class StrokeStep(PipelineStep):
    name = "stroke"

    def can_skip(self, image: Image.Image, config: dict) -> bool:
        return not config.get("enabled", True)

    def process(self, image: Image.Image, config: dict) -> Image.Image:
        width = config.get("width", 2)
        color = _hex_to_rgba(config.get("color", "#000000"))
        position = config.get("position", "outer")

        arr = np.array(image)
        alpha = arr[:, :, 3]
        content_mask = (alpha > 128).astype(np.uint8)
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (width * 2 + 1, width * 2 + 1))

        if position == "outer":
            dilated = cv2.dilate(content_mask, kernel)
            stroke_mask = dilated - content_mask
        elif position == "inner":
            eroded = cv2.erode(content_mask, kernel)
            stroke_mask = content_mask - eroded
        else:  # center
            dilated = cv2.dilate(content_mask, kernel)
            eroded = cv2.erode(content_mask, kernel)
            stroke_mask = dilated - eroded

        result = arr.copy()
        stroke_pixels = stroke_mask > 0
        result[stroke_pixels, 0] = color[0]
        result[stroke_pixels, 1] = color[1]
        result[stroke_pixels, 2] = color[2]
        result[stroke_pixels, 3] = color[3]

        return Image.fromarray(result, "RGBA")
