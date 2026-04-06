"""Shape mask pipeline step."""
from __future__ import annotations

import cv2
import numpy as np
from PIL import Image, ImageDraw

from needicons.core.pipeline.base import PipelineStep


def _make_circle_mask(w: int, h: int) -> Image.Image:
    mask = Image.new("L", (w, h), 0)
    draw = ImageDraw.Draw(mask)
    draw.ellipse([0, 0, w - 1, h - 1], fill=255)
    return mask


def _make_rounded_rect_mask(w: int, h: int, radius: int) -> Image.Image:
    mask = Image.new("L", (w, h), 0)
    draw = ImageDraw.Draw(mask)
    draw.rounded_rectangle([0, 0, w - 1, h - 1], radius=radius, fill=255)
    return mask


def _make_squircle_mask(w: int, h: int) -> Image.Image:
    radius = int(min(w, h) * 0.22)
    return _make_rounded_rect_mask(w, h, radius)


class ShapeMaskStep(PipelineStep):
    name = "shape_mask"

    def can_skip(self, image: Image.Image, config: dict) -> bool:
        return config.get("shape", "none") == "none"

    def process(self, image: Image.Image, config: dict) -> Image.Image:
        shape = config.get("shape", "none")
        if shape == "none":
            return image

        w, h = image.size
        if shape == "circle":
            mask = _make_circle_mask(w, h)
        elif shape == "rounded_rect":
            radius = config.get("corner_radius", 16)
            mask = _make_rounded_rect_mask(w, h, radius)
        elif shape == "squircle":
            mask = _make_squircle_mask(w, h)
        elif shape == "square":
            mask = Image.new("L", (w, h), 255)
        else:
            return image

        result = image.copy()
        existing_alpha = result.split()[3]
        combined = Image.fromarray(
            np.minimum(np.array(existing_alpha), np.array(mask)), "L"
        )
        result.putalpha(combined)
        return result
