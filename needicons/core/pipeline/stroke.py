"""Stroke/outline pipeline step with anti-aliased edges."""
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
        alpha = arr[:, :, 3].astype(np.float32) / 255.0

        # Use distance transform for smooth anti-aliased edges
        content_mask = (alpha > 0.5).astype(np.uint8)

        if position == "outer":
            # Distance from content edge outward
            inv_mask = 1 - content_mask
            dist = cv2.distanceTransform(inv_mask, cv2.DIST_L2, 5)
            # Stroke region: within 'width' pixels of the content edge
            stroke_alpha = np.clip(1.0 - (dist - width + 1), 0, 1)
            # Only in the non-content area
            stroke_alpha *= (1.0 - alpha)
        elif position == "inner":
            dist = cv2.distanceTransform(content_mask, cv2.DIST_L2, 5)
            stroke_alpha = np.clip(1.0 - (dist - width + 1), 0, 1)
            stroke_alpha *= alpha
        else:  # center
            half = width / 2
            inv_mask = 1 - content_mask
            dist_out = cv2.distanceTransform(inv_mask, cv2.DIST_L2, 5)
            dist_in = cv2.distanceTransform(content_mask, cv2.DIST_L2, 5)
            stroke_alpha_out = np.clip(1.0 - (dist_out - half + 1), 0, 1) * (1.0 - alpha)
            stroke_alpha_in = np.clip(1.0 - (dist_in - half + 1), 0, 1) * alpha
            stroke_alpha = np.maximum(stroke_alpha_out, stroke_alpha_in)

        # Composite stroke under the original content
        result = arr.copy().astype(np.float32)
        stroke_r = np.full_like(alpha, color[0], dtype=np.float32)
        stroke_g = np.full_like(alpha, color[1], dtype=np.float32)
        stroke_b = np.full_like(alpha, color[2], dtype=np.float32)

        # Blend: stroke behind content
        sa = stroke_alpha * (color[3] / 255.0)
        orig_alpha = alpha
        # For outer stroke: place stroke pixels where there's no content
        combined_alpha = np.clip(orig_alpha + sa * (1.0 - orig_alpha), 0, 1)

        # Where stroke is visible (sa > 0 and orig_alpha < 1)
        blend = sa * (1.0 - orig_alpha)
        safe_combined = np.where(combined_alpha > 0, combined_alpha, 1.0)

        result[:, :, 0] = (result[:, :, 0] * orig_alpha + stroke_r * blend) / safe_combined
        result[:, :, 1] = (result[:, :, 1] * orig_alpha + stroke_g * blend) / safe_combined
        result[:, :, 2] = (result[:, :, 2] * orig_alpha + stroke_b * blend) / safe_combined
        result[:, :, 3] = combined_alpha * 255.0

        return Image.fromarray(np.clip(result, 0, 255).astype(np.uint8), "RGBA")
