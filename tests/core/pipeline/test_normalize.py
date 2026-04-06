import pytest
import numpy as np
from PIL import Image
from needicons.core.pipeline.normalize import WeightNormalizationStep, CenteringStep


def _make_offset_icon():
    """Small icon in top-left corner on transparent canvas."""
    img = Image.new("RGBA", (256, 256), (0, 0, 0, 0))
    for x in range(10, 60):
        for y in range(10, 60):
            img.putpixel((x, y), (255, 0, 0, 255))
    return img


def test_centering_centers_content():
    img = _make_offset_icon()
    step = CenteringStep()
    result = step.process(img, {})
    alpha = np.array(result.split()[3])
    rows = np.any(alpha > 0, axis=1)
    cols = np.any(alpha > 0, axis=0)
    y_min, y_max = np.where(rows)[0][[0, -1]]
    x_min, x_max = np.where(cols)[0][[0, -1]]
    center_x = (x_min + x_max) / 2
    center_y = (y_min + y_max) / 2
    assert abs(center_x - 128) < 2
    assert abs(center_y - 128) < 2


def test_weight_normalization_scales():
    img = _make_offset_icon()
    step = WeightNormalizationStep()
    result = step.process(img, {"target_fill": 0.5, "enabled": True})
    alpha = np.array(result.split()[3])
    fill = np.sum(alpha > 0) / alpha.size
    assert fill > 0.1


def test_weight_normalization_skip_disabled():
    step = WeightNormalizationStep()
    assert step.can_skip(Image.new("RGBA", (10, 10)), {"enabled": False}) is True


def test_centering_name():
    assert CenteringStep().name == "centering"


def test_weight_normalization_name():
    assert WeightNormalizationStep().name == "weight_normalization"
