"""Tests for weight normalization with shape-aware fill."""
import numpy as np
from PIL import Image
from needicons.core.pipeline.normalize import WeightNormalizationStep, _content_bbox

SHAPE_FILL_MULTIPLIERS = {
    "none": 1.0,
    "square": 1.0,
    "rounded_rect": 0.92,
    "squircle": 0.85,
    "circle": 0.71,
}


def _make_test_image(content_size: int = 200, canvas_size: int = 256) -> Image.Image:
    """Create a transparent canvas with a centered opaque square."""
    img = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))
    offset = (canvas_size - content_size) // 2
    for y in range(offset, offset + content_size):
        for x in range(offset, offset + content_size):
            img.putpixel((x, y), (255, 0, 0, 255))
    return img


def test_weight_norm_no_shape_uses_base_fill():
    step = WeightNormalizationStep()
    img = _make_test_image(content_size=200, canvas_size=256)
    config = {"enabled": True, "target_fill": 0.7}
    result = step.process(img, config)
    bbox = _content_bbox(result)
    assert bbox is not None
    content_w = bbox[2] - bbox[0]
    expected_dim = int(256 * 0.7)
    assert abs(content_w - expected_dim) <= 2


def test_weight_norm_circle_reduces_fill():
    step = WeightNormalizationStep()
    img = _make_test_image(content_size=200, canvas_size=256)
    config = {"enabled": True, "target_fill": 0.7, "shape": "circle"}
    result = step.process(img, config)
    bbox = _content_bbox(result)
    assert bbox is not None
    content_w = bbox[2] - bbox[0]
    expected_dim = int(256 * 0.7 * 0.71)
    assert abs(content_w - expected_dim) <= 2


def test_weight_norm_squircle_reduces_fill():
    step = WeightNormalizationStep()
    img = _make_test_image(content_size=200, canvas_size=256)
    config = {"enabled": True, "target_fill": 0.7, "shape": "squircle"}
    result = step.process(img, config)
    bbox = _content_bbox(result)
    assert bbox is not None
    content_w = bbox[2] - bbox[0]
    expected_dim = int(256 * 0.7 * 0.85)
    assert abs(content_w - expected_dim) <= 2


def test_weight_norm_square_no_reduction():
    step = WeightNormalizationStep()
    img = _make_test_image(content_size=200, canvas_size=256)
    config = {"enabled": True, "target_fill": 0.7, "shape": "square"}
    result = step.process(img, config)
    bbox = _content_bbox(result)
    assert bbox is not None
    content_w = bbox[2] - bbox[0]
    expected_dim = int(256 * 0.7)
    assert abs(content_w - expected_dim) <= 2


def test_weight_norm_disabled_skips():
    step = WeightNormalizationStep()
    img = _make_test_image(content_size=200, canvas_size=256)
    config = {"enabled": False}
    assert step.can_skip(img, config) is True
