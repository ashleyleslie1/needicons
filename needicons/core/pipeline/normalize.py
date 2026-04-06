"""Visual weight normalization and centering pipeline steps."""
from __future__ import annotations

import numpy as np
from PIL import Image

from needicons.core.pipeline.base import PipelineStep


def _content_bbox(image: Image.Image) -> tuple[int, int, int, int] | None:
    """Get bounding box of non-transparent content. Returns (x1, y1, x2, y2) or None."""
    alpha = np.array(image.split()[3])
    rows = np.any(alpha > 0, axis=1)
    cols = np.any(alpha > 0, axis=0)
    if not np.any(rows) or not np.any(cols):
        return None
    y1, y2 = np.where(rows)[0][[0, -1]]
    x1, x2 = np.where(cols)[0][[0, -1]]
    return int(x1), int(y1), int(x2 + 1), int(y2 + 1)


class CenteringStep(PipelineStep):
    name = "centering"

    def can_skip(self, image: Image.Image, config: dict) -> bool:
        return False

    def process(self, image: Image.Image, config: dict) -> Image.Image:
        bbox = _content_bbox(image)
        if bbox is None:
            return image
        x1, y1, x2, y2 = bbox
        content = image.crop(bbox)
        cw, ch = content.size
        canvas = Image.new("RGBA", image.size, (0, 0, 0, 0))
        paste_x = (image.width - cw) // 2
        paste_y = (image.height - ch) // 2
        canvas.paste(content, (paste_x, paste_y))
        return canvas


class WeightNormalizationStep(PipelineStep):
    name = "weight_normalization"

    def can_skip(self, image: Image.Image, config: dict) -> bool:
        return not config.get("enabled", False)

    def process(self, image: Image.Image, config: dict) -> Image.Image:
        target_fill = config.get("target_fill", 0.7)
        bbox = _content_bbox(image)
        if bbox is None:
            return image
        x1, y1, x2, y2 = bbox
        content = image.crop(bbox)
        cw, ch = content.size
        canvas_w, canvas_h = image.size
        target_dim = int(min(canvas_w, canvas_h) * target_fill)
        scale = target_dim / max(cw, ch)
        if abs(scale - 1.0) < 0.05:
            return image
        new_w = max(1, int(cw * scale))
        new_h = max(1, int(ch * scale))
        resized = content.resize((new_w, new_h), Image.LANCZOS)
        canvas = Image.new("RGBA", image.size, (0, 0, 0, 0))
        paste_x = (canvas_w - new_w) // 2
        paste_y = (canvas_h - new_h) // 2
        canvas.paste(resized, (paste_x, paste_y))
        return canvas
