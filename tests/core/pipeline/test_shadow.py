import pytest
import numpy as np
from PIL import Image
from needicons.core.pipeline.shadow import DropShadowStep


def test_shadow_adds_pixels(icon_on_transparent):
    step = DropShadowStep()
    result = step.process(icon_on_transparent, {
        "offset_x": 5, "offset_y": 5, "blur_radius": 3, "color": "#000000", "opacity": 1.0,
    })
    orig_alpha = np.array(icon_on_transparent.split()[3])
    result_alpha = np.array(result.split()[3])
    assert np.sum(result_alpha > 0) > np.sum(orig_alpha > 0)


def test_shadow_offset():
    img = Image.new("RGBA", (100, 100), (0, 0, 0, 0))
    for x in range(40, 60):
        for y in range(40, 60):
            img.putpixel((x, y), (255, 0, 0, 255))
    step = DropShadowStep()
    result = step.process(img, {
        "offset_x": 10, "offset_y": 10, "blur_radius": 0, "color": "#000000", "opacity": 1.0,
    })
    r, g, b, a = result.getpixel((65, 65))
    assert a > 0


def test_shadow_skip_disabled():
    step = DropShadowStep()
    assert step.can_skip(Image.new("RGBA", (10, 10)), {"enabled": False}) is True


def test_shadow_name():
    assert DropShadowStep().name == "drop_shadow"
