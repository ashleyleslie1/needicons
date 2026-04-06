"""Resize + sharpen pipeline step."""
from __future__ import annotations

from PIL import Image, ImageFilter

from needicons.core.pipeline.base import PipelineStep


def resize_multi(
    image: Image.Image,
    sizes: list[int],
    sharpen_below: int = 48,
) -> dict[int, Image.Image]:
    results = {}
    for size in sizes:
        resized = image.resize((size, size), Image.LANCZOS)
        if size <= sharpen_below:
            resized = resized.filter(ImageFilter.UnsharpMask(radius=1, percent=80, threshold=0))
        results[size] = resized
    return results


class ResizeStep(PipelineStep):
    """Resize to the smallest target size (for preview). Use resize_multi for export."""
    name = "resize"

    def can_skip(self, image: Image.Image, config: dict) -> bool:
        sizes = config.get("sizes", [])
        return len(sizes) == 0

    def process(self, image: Image.Image, config: dict) -> Image.Image:
        sizes = config.get("sizes", [256])
        sharpen_below = config.get("sharpen_below", 48)
        target = min(sizes)
        resized = image.resize((target, target), Image.LANCZOS)
        if target <= sharpen_below:
            resized = resized.filter(ImageFilter.UnsharpMask(radius=1, percent=80, threshold=0))
        return resized
