"""Drop shadow pipeline step."""
from __future__ import annotations

import cv2
import numpy as np
from PIL import Image

from needicons.core.pipeline.base import PipelineStep


def _hex_to_rgba(hex_color: str) -> tuple[int, int, int, int]:
    h = hex_color.lstrip("#")
    if len(h) == 6:
        return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), 255)
    elif len(h) == 8:
        return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), int(h[6:8], 16))
    return (0, 0, 0, 255)


class DropShadowStep(PipelineStep):
    name = "drop_shadow"

    def can_skip(self, image: Image.Image, config: dict) -> bool:
        return not config.get("enabled", True)

    def process(self, image: Image.Image, config: dict) -> Image.Image:
        ox = config.get("offset_x", 0)
        oy = config.get("offset_y", 1)
        blur = config.get("blur_radius", 2)
        color = _hex_to_rgba(config.get("color", "#000000"))
        opacity = config.get("opacity", 1.0)

        arr = np.array(image)
        alpha = arr[:, :, 3].astype(np.float32) / 255.0

        h, w = alpha.shape
        shadow_alpha = np.zeros_like(alpha)
        src_y = slice(max(0, -oy), min(h, h - oy))
        src_x = slice(max(0, -ox), min(w, w - ox))
        dst_y = slice(max(0, oy), min(h, h + oy))
        dst_x = slice(max(0, ox), min(w, w + ox))
        shadow_alpha[dst_y, dst_x] = alpha[src_y, src_x]

        if blur > 0:
            ksize = blur * 2 + 1
            shadow_alpha = cv2.GaussianBlur(shadow_alpha, (ksize, ksize), 0)

        shadow_alpha *= opacity

        shadow = np.zeros((h, w, 4), dtype=np.uint8)
        shadow[:, :, 0] = color[0]
        shadow[:, :, 1] = color[1]
        shadow[:, :, 2] = color[2]
        shadow[:, :, 3] = (shadow_alpha * 255).astype(np.uint8)

        shadow_img = Image.fromarray(shadow, "RGBA")
        shadow_img.paste(image, (0, 0), image)
        return shadow_img
