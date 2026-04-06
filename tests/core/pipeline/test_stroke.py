import pytest
import numpy as np
from PIL import Image
from needicons.core.pipeline.stroke import StrokeStep


def test_stroke_adds_outline(icon_on_transparent):
    step = StrokeStep()
    result = step.process(icon_on_transparent, {
        "width": 3, "color": "#FFFFFF", "position": "outer",
    })
    alpha = np.array(result.split()[3])
    orig_alpha = np.array(icon_on_transparent.split()[3])
    assert np.sum(alpha > 0) > np.sum(orig_alpha > 0)


def test_stroke_outer_expands():
    img = Image.new("RGBA", (100, 100), (0, 0, 0, 0))
    for x in range(40, 60):
        for y in range(40, 60):
            img.putpixel((x, y), (255, 0, 0, 255))
    step = StrokeStep()
    result = step.process(img, {"width": 5, "color": "#00FF00", "position": "outer"})
    r, g, b, a = result.getpixel((35, 50))
    assert g > 0 and a > 0


def test_stroke_skip_disabled():
    step = StrokeStep()
    assert step.can_skip(Image.new("RGBA", (10, 10)), {"enabled": False}) is True


def test_stroke_name():
    assert StrokeStep().name == "stroke"
