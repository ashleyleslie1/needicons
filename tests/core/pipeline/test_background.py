"""Tests for background removal pipeline step and strategies."""
import pytest
import numpy as np
from PIL import Image
from needicons.core.pipeline.background import (
    BackgroundRemovalStep,
    remove_background,
    _color_threshold_remove,
)


def test_skip_if_already_transparent(icon_on_transparent):
    step = BackgroundRemovalStep()
    assert step.can_skip(icon_on_transparent, {"enabled": True}) is True


def test_does_not_skip_opaque(icon_on_white):
    step = BackgroundRemovalStep()
    assert step.can_skip(icon_on_white, {"enabled": True}) is False


def test_skip_if_disabled(icon_on_white):
    step = BackgroundRemovalStep()
    assert step.can_skip(icon_on_white, {"enabled": False}) is True


def test_process_removes_background(icon_on_white):
    step = BackgroundRemovalStep()
    result = step.process(icon_on_white, {"model": "u2net", "alpha_matting": False})
    # Corner pixel (was white) should now have low alpha
    corner_alpha = result.getpixel((0, 0))[3]
    # Center pixel (was red) should retain high alpha
    center_alpha = result.getpixel((128, 128))[3]
    assert center_alpha > corner_alpha


def test_has_correct_name():
    step = BackgroundRemovalStep()
    assert step.name == "background_removal"


# --- remove_background() multi-strategy tests ---


def test_remove_bg_clamped_below_zero(icon_on_white):
    result = remove_background(icon_on_white, -5)
    assert result.mode == "RGBA"
    assert result.size == (256, 256)


def test_remove_bg_clamped_above_100(icon_on_white):
    # This will use aggressive strategy but should not error
    # Skip if rembg not available
    pytest.importorskip("rembg")
    result = remove_background(icon_on_white, 150)
    assert result.mode == "RGBA"


def test_lite_removes_white_corners(icon_on_white):
    result = remove_background(icon_on_white, 15)
    corner_alpha = result.getpixel((0, 0))[3]
    assert corner_alpha < 50


def test_lite_preserves_red_center(icon_on_white):
    result = remove_background(icon_on_white, 15)
    center_alpha = result.getpixel((128, 128))[3]
    assert center_alpha > 200


def test_lite_zero_aggressiveness(icon_on_white):
    result = remove_background(icon_on_white, 0)
    corner_alpha = result.getpixel((0, 0))[3]
    assert corner_alpha < 100


def test_lite_boundary_30(icon_on_white):
    result = remove_background(icon_on_white, 30)
    corner_alpha = result.getpixel((0, 0))[3]
    assert corner_alpha < 100


def test_rgb_input_returns_rgba():
    rgb_img = Image.new("RGB", (64, 64), (255, 255, 255))
    result = remove_background(rgb_img, 10)
    assert result.mode == "RGBA"


def test_color_threshold_blue_bg():
    img = Image.new("RGBA", (128, 128), (0, 0, 200, 255))
    for x in range(40, 88):
        for y in range(40, 88):
            img.putpixel((x, y), (200, 0, 0, 255))
    result = _color_threshold_remove(img, 20)
    corner_alpha = result.getpixel((0, 0))[3]
    center_alpha = result.getpixel((64, 64))[3]
    assert corner_alpha < 50
    assert center_alpha > 200


def test_color_threshold_preserves_transparency(icon_on_transparent):
    result = _color_threshold_remove(icon_on_transparent, 15)
    corner_alpha = result.getpixel((0, 0))[3]
    assert corner_alpha == 0
