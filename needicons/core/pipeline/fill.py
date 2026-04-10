"""Background fill pipeline step with optional corner radius."""
from __future__ import annotations

import numpy as np
from PIL import Image, ImageDraw

from needicons.core.pipeline.base import PipelineStep


def _hex_to_rgba(hex_color: str) -> tuple[int, int, int, int]:
    h = hex_color.lstrip("#")
    if len(h) == 6:
        return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), 255)
    elif len(h) == 8:
        return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), int(h[6:8], 16))
    return (255, 255, 255, 255)


class BackgroundFillStep(PipelineStep):
    name = "background_fill"

    def can_skip(self, image: Image.Image, config: dict) -> bool:
        return config.get("type", "none") == "none"

    def process(self, image: Image.Image, config: dict) -> Image.Image:
        fill_type = config.get("type", "none")
        if fill_type == "none":
            return image

        w, h = image.size
        corner_radius = config.get("corner_radius", 0)

        if fill_type == "solid":
            color = _hex_to_rgba(config.get("color", "#FFFFFF"))
            bg = Image.new("RGBA", (w, h), color)
        elif fill_type == "gradient":
            bg = self._make_gradient(w, h, config)
        else:
            return image

        # Apply corner radius to the background
        if corner_radius > 0:
            mask = Image.new("L", (w, h), 0)
            draw = ImageDraw.Draw(mask)
            draw.rounded_rectangle([0, 0, w - 1, h - 1], radius=corner_radius, fill=255)
            bg.putalpha(mask)

        # Composite icon on top of background
        bg.paste(image, (0, 0), image)

        # Re-apply the rounded mask to clip everything
        if corner_radius > 0:
            final_alpha = bg.split()[3]
            combined = Image.fromarray(
                np.minimum(np.array(final_alpha), np.array(mask)), "L"
            )
            bg.putalpha(combined)

        return bg

    def _make_gradient(self, w: int, h: int, config: dict) -> Image.Image:
        stops = config.get("gradient_stops", ["#000000", "#FFFFFF"])
        if len(stops) < 2:
            stops = ["#000000", "#FFFFFF"]
        c1 = _hex_to_rgba(stops[0])
        c2 = _hex_to_rgba(stops[-1])
        arr = np.zeros((h, w, 4), dtype=np.uint8)
        for i in range(h):
            t = i / max(h - 1, 1)
            for c in range(4):
                arr[i, :, c] = int(c1[c] * (1 - t) + c2[c] * t)
        return Image.fromarray(arr, "RGBA")
