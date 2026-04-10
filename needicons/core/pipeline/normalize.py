"""Visual weight normalization and centering pipeline steps."""
from __future__ import annotations

import numpy as np
from PIL import Image

from needicons.core.pipeline.base import PipelineStep


def _content_bbox(image: Image.Image, threshold: int = 20) -> tuple[int, int, int, int] | None:
    """Get bounding box of visible content, ignoring near-transparent noise."""
    alpha = np.array(image.split()[3])
    rows = np.any(alpha > threshold, axis=1)
    cols = np.any(alpha > threshold, axis=0)
    if not np.any(rows) or not np.any(cols):
        return None
    y1, y2 = np.where(rows)[0][[0, -1]]
    x1, x2 = np.where(cols)[0][[0, -1]]
    return int(x1), int(y1), int(x2 + 1), int(y2 + 1)


def _center_of_mass(image: Image.Image) -> tuple[float, float] | None:
    """Compute center of visual mass based on alpha-weighted pixel positions."""
    alpha = np.array(image.split()[3], dtype=np.float64)
    total = alpha.sum()
    if total == 0:
        return None
    h, w = alpha.shape
    ys, xs = np.mgrid[0:h, 0:w]
    cx = float((xs * alpha).sum() / total)
    cy = float((ys * alpha).sum() / total)
    return cx, cy


class CenteringStep(PipelineStep):
    name = "centering"

    def can_skip(self, image: Image.Image, config: dict) -> bool:
        return config.get("skip", False)

    def process(self, image: Image.Image, config: dict) -> Image.Image:
        bbox = _content_bbox(image)
        if bbox is None:
            return image

        x1, y1, x2, y2 = bbox
        content = image.crop(bbox)
        cw, ch = content.size
        canvas_w, canvas_h = image.size

        # Compute center of mass within the cropped content
        com = _center_of_mass(content)
        if com is None:
            # Fallback: geometric center
            paste_x = (canvas_w - cw) // 2
            paste_y = (canvas_h - ch) // 2
        else:
            com_x, com_y = com
            # Place content so its center of mass aligns with canvas center,
            # but blend 50/50 with geometric center to avoid extreme shifts
            geo_cx, geo_cy = cw / 2, ch / 2
            blend_cx = (com_x + geo_cx) / 2
            blend_cy = (com_y + geo_cy) / 2
            paste_x = int((canvas_w / 2) - blend_cx)
            paste_y = int((canvas_h / 2) - blend_cy)

            # Clamp so content doesn't go off-canvas
            paste_x = max(0, min(canvas_w - cw, paste_x))
            paste_y = max(0, min(canvas_h - ch, paste_y))

        canvas = Image.new("RGBA", image.size, (0, 0, 0, 0))
        canvas.paste(content, (paste_x, paste_y))
        return canvas


_SHAPE_FILL_MULTIPLIERS = {
    "none": 1.0,
    "square": 1.0,
    "rounded_rect": 0.92,
    "squircle": 0.85,
    "circle": 0.71,
}


class WeightNormalizationStep(PipelineStep):
    name = "weight_normalization"

    def can_skip(self, image: Image.Image, config: dict) -> bool:
        return not config.get("enabled", False)

    def process(self, image: Image.Image, config: dict) -> Image.Image:
        shape = config.get("shape", "none")
        multiplier = _SHAPE_FILL_MULTIPLIERS.get(shape, 1.0)
        target_fill = config.get("target_fill", 0.7) * multiplier
        bbox = _content_bbox(image)
        if bbox is None:
            return image
        x1, y1, x2, y2 = bbox
        content = image.crop(bbox)
        cw, ch = content.size
        canvas_w, canvas_h = image.size

        # Scale based on the average of width and height so both square and
        # elongated icons get similar visual weight. Clamp to 95% of canvas
        # so nothing clips at edges.
        canvas_dim = min(canvas_w, canvas_h)
        target_dim = canvas_dim * target_fill
        avg_dim = (cw + ch) / 2
        scale = target_dim / avg_dim

        # Clamp so neither dimension exceeds 95% of canvas
        max_scale = (canvas_dim * 0.95) / max(cw, ch)
        scale = min(scale, max_scale)

        if abs(scale - 1.0) < 0.01:
            return image
        new_w = max(1, int(cw * scale))
        new_h = max(1, int(ch * scale))
        resized = content.resize((new_w, new_h), Image.LANCZOS)
        canvas = Image.new("RGBA", image.size, (0, 0, 0, 0))
        paste_x = (canvas_w - new_w) // 2
        paste_y = (canvas_h - new_h) // 2
        canvas.paste(resized, (paste_x, paste_y))
        return canvas
