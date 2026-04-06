import pytest
from PIL import Image
from needicons.core.pipeline.color import ColorProcessingStep


def test_color_overlay_monochrome():
    img = Image.new("RGBA", (10, 10), (255, 0, 0, 255))
    step = ColorProcessingStep()
    result = step.process(img, {"overlay_color": "#0000FF"})
    r, g, b, a = result.getpixel((5, 5))
    assert b > r


def test_brightness_increase():
    img = Image.new("RGBA", (10, 10), (100, 100, 100, 255))
    step = ColorProcessingStep()
    result = step.process(img, {"brightness": 50})
    r, g, b, a = result.getpixel((5, 5))
    assert r > 100


def test_brightness_decrease():
    img = Image.new("RGBA", (10, 10), (100, 100, 100, 255))
    step = ColorProcessingStep()
    result = step.process(img, {"brightness": -50})
    r, g, b, a = result.getpixel((5, 5))
    assert r < 100


def test_no_change_default():
    img = Image.new("RGBA", (10, 10), (100, 50, 25, 255))
    step = ColorProcessingStep()
    result = step.process(img, {})
    assert result.getpixel((5, 5)) == (100, 50, 25, 255)


def test_color_name():
    assert ColorProcessingStep().name == "color"


def test_skip_when_all_defaults():
    step = ColorProcessingStep()
    img = Image.new("RGBA", (10, 10))
    assert step.can_skip(img, {
        "overlay_color": None, "brightness": 0, "contrast": 0, "saturation": 0
    }) is True
