"""Tests for background removal pipeline step and strategies."""
import pytest
import numpy as np
from PIL import Image
from needicons.core.pipeline.background import (
    BackgroundRemovalStep,
    remove_background,
    _color_threshold_remove,
    _is_bimodal_alpha,
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
    result = remove_background(icon_on_white, level=-5)
    assert result.mode == "RGBA"
    assert result.size == (256, 256)


def test_remove_bg_clamped_above_100(icon_on_white):
    # This will use aggressive strategy but should not error
    # Skip if rembg not available
    pytest.importorskip("rembg")
    result = remove_background(icon_on_white, level=15)
    assert result.mode == "RGBA"


def test_lite_removes_white_corners(icon_on_white):
    result = remove_background(icon_on_white, level=2)
    corner_alpha = result.getpixel((0, 0))[3]
    assert corner_alpha < 50


def test_lite_preserves_red_center(icon_on_white):
    result = remove_background(icon_on_white, level=2)
    center_alpha = result.getpixel((128, 128))[3]
    assert center_alpha > 200


def test_lite_level_1(icon_on_white):
    result = remove_background(icon_on_white, level=1)
    corner_alpha = result.getpixel((0, 0))[3]
    assert corner_alpha < 100


def test_lite_boundary_level_3(icon_on_white):
    result = remove_background(icon_on_white, level=3)
    corner_alpha = result.getpixel((0, 0))[3]
    assert corner_alpha < 100


def test_rgb_input_returns_rgba():
    rgb_img = Image.new("RGB", (64, 64), (255, 255, 255))
    result = remove_background(rgb_img, level=2)
    assert result.mode == "RGBA"


def test_color_threshold_blue_bg():
    img = Image.new("RGBA", (128, 128), (0, 0, 200, 255))
    for x in range(40, 88):
        for y in range(40, 88):
            img.putpixel((x, y), (200, 0, 0, 255))
    result = _color_threshold_remove(img, level=2)
    corner_alpha = result.getpixel((0, 0))[3]
    center_alpha = result.getpixel((64, 64))[3]
    assert corner_alpha < 50
    assert center_alpha > 200


def test_color_threshold_preserves_transparency(icon_on_transparent):
    result = _color_threshold_remove(icon_on_transparent, level=2)
    corner_alpha = result.getpixel((0, 0))[3]
    assert corner_alpha == 0


def test_bimodal_alpha_clean_transparent():
    """Image with fully opaque foreground + fully transparent background is bimodal."""
    img = Image.new("RGBA", (128, 128), (0, 0, 0, 0))
    for x in range(30, 98):
        for y in range(30, 98):
            img.putpixel((x, y), (255, 0, 0, 255))
    assert _is_bimodal_alpha(img) is True


def test_bimodal_alpha_all_opaque():
    """Fully opaque image is bimodal (all pixels alpha > 245)."""
    img = Image.new("RGBA", (128, 128), (255, 255, 255, 255))
    assert _is_bimodal_alpha(img) is True


def test_bimodal_alpha_gradient_not_bimodal():
    """Image with gradual alpha gradient is NOT bimodal."""
    arr = np.zeros((128, 128, 4), dtype=np.uint8)
    arr[:, :, 0] = 200
    arr[:, :, 3] = np.linspace(0, 255, 128, dtype=np.uint8)[np.newaxis, :]
    img = Image.fromarray(arr)
    assert _is_bimodal_alpha(img) is False


def test_bimodal_alpha_partial_transparency():
    """Image where many pixels have mid-range alpha is NOT bimodal."""
    img = Image.new("RGBA", (128, 128), (100, 100, 100, 128))
    assert _is_bimodal_alpha(img) is False


def test_bimodal_alpha_rgb_input():
    """RGB image (no alpha) should return True (all pixels effectively opaque)."""
    img = Image.new("RGB", (128, 128), (255, 0, 0))
    assert _is_bimodal_alpha(img) is True


# --- Level-based remove_background() tests ---


def test_remove_bg_level_1_lite(icon_on_white):
    result = remove_background(icon_on_white, level=1)
    assert result.mode == "RGBA"
    corner_alpha = result.getpixel((0, 0))[3]
    assert corner_alpha < 50


def test_remove_bg_level_3_lite(icon_on_white):
    result = remove_background(icon_on_white, level=3)
    assert result.mode == "RGBA"
    corner_alpha = result.getpixel((0, 0))[3]
    assert corner_alpha < 50


def test_remove_bg_level_clamped_below(icon_on_white):
    result = remove_background(icon_on_white, level=0)
    assert result.mode == "RGBA"


def test_remove_bg_level_clamped_above(icon_on_white):
    pytest.importorskip("rembg")
    result = remove_background(icon_on_white, level=15)
    assert result.mode == "RGBA"


def test_remove_bg_bimodal_skip_at_low_level():
    img = Image.new("RGBA", (128, 128), (0, 0, 0, 0))
    for x in range(30, 98):
        for y in range(30, 98):
            img.putpixel((x, y), (255, 0, 0, 255))
    original_data = np.array(img)
    result = remove_background(img, level=5)
    result_data = np.array(result)
    np.testing.assert_array_equal(original_data, result_data)


def test_remove_bg_bimodal_no_matting_at_high_level():
    pytest.importorskip("rembg")
    img = Image.new("RGBA", (128, 128), (0, 0, 0, 0))
    for x in range(30, 98):
        for y in range(30, 98):
            img.putpixel((x, y), (255, 0, 0, 255))
    result = remove_background(img, level=9)
    assert result.mode == "RGBA"


def test_remove_bg_level_default_gpu_provider(icon_on_white):
    result = remove_background(icon_on_white, level=2)
    assert result.mode == "RGBA"
