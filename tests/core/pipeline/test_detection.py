import pytest
from PIL import Image
from needicons.core.pipeline.detection import detect_icons


def test_detect_single_icon(icon_on_white):
    results = detect_icons(icon_on_white)
    assert len(results) == 1
    assert results[0].mode == "RGBA"


def test_detect_grid_4_icons(grid_image):
    results = detect_icons(grid_image)
    assert len(results) == 4
    for icon in results:
        assert icon.mode == "RGBA"
        assert icon.width > 50
        assert icon.height > 50


def test_detect_on_transparent(icon_on_transparent):
    results = detect_icons(icon_on_transparent)
    assert len(results) == 1


def test_detect_empty_image():
    empty = Image.new("RGBA", (256, 256), (255, 255, 255, 255))
    results = detect_icons(empty)
    assert len(results) == 1


def test_detect_returns_cropped():
    """Each detected icon should be cropped to its content, not full-size."""
    img = Image.new("RGBA", (512, 512), (255, 255, 255, 255))
    for x in range(50, 150):
        for y in range(50, 150):
            img.putpixel((x, y), (255, 0, 0, 255))
    results = detect_icons(img)
    assert len(results) >= 1
    assert results[0].width < 512
    assert results[0].height < 512
