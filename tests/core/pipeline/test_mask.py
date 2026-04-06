import pytest
import numpy as np
from PIL import Image
from needicons.core.pipeline.mask import ShapeMaskStep


def test_circle_mask():
    img = Image.new("RGBA", (100, 100), (255, 0, 0, 255))
    step = ShapeMaskStep()
    result = step.process(img, {"shape": "circle"})
    assert result.getpixel((0, 0))[3] == 0
    assert result.getpixel((99, 99))[3] == 0
    assert result.getpixel((50, 50))[3] == 255


def test_rounded_rect_mask():
    img = Image.new("RGBA", (100, 100), (255, 0, 0, 255))
    step = ShapeMaskStep()
    result = step.process(img, {"shape": "rounded_rect", "corner_radius": 20})
    assert result.getpixel((0, 0))[3] == 0
    assert result.getpixel((50, 50))[3] == 255
    assert result.getpixel((50, 0))[3] == 255


def test_square_mask():
    img = Image.new("RGBA", (100, 100), (255, 0, 0, 255))
    step = ShapeMaskStep()
    result = step.process(img, {"shape": "square"})
    assert result.getpixel((0, 0))[3] == 255


def test_none_mask_passes_through(icon_on_transparent):
    step = ShapeMaskStep()
    result = step.process(icon_on_transparent, {"shape": "none"})
    assert np.array_equal(np.array(result), np.array(icon_on_transparent))


def test_mask_name():
    assert ShapeMaskStep().name == "shape_mask"
