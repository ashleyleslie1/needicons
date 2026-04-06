import pytest
from PIL import Image
from needicons.core.pipeline.fill import BackgroundFillStep


def test_solid_fill(icon_on_transparent):
    step = BackgroundFillStep()
    result = step.process(icon_on_transparent, {"type": "solid", "color": "#0000FF"})
    r, g, b, a = result.getpixel((0, 0))
    assert b == 255 and a == 255


def test_no_fill_passes_through(icon_on_transparent):
    step = BackgroundFillStep()
    result = step.process(icon_on_transparent, {"type": "none"})
    assert result.getpixel((0, 0))[3] == 0


def test_fill_preserves_content(icon_on_transparent):
    step = BackgroundFillStep()
    result = step.process(icon_on_transparent, {"type": "solid", "color": "#00FF00"})
    r, g, b, a = result.getpixel((128, 128))
    assert r == 255 and g == 0


def test_fill_name():
    assert BackgroundFillStep().name == "background_fill"


def test_skip_when_none():
    step = BackgroundFillStep()
    assert step.can_skip(Image.new("RGBA", (10, 10)), {"type": "none"}) is True
