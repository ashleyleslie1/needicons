import pytest
from PIL import Image
import numpy as np
from needicons.core.pipeline.edges import EdgeCleanupStep


def _make_fringe_image():
    """Image with semi-transparent fringe pixels around opaque content."""
    img = Image.new("RGBA", (100, 100), (0, 0, 0, 0))
    pixels = img.load()
    # Solid center
    for x in range(30, 70):
        for y in range(30, 70):
            pixels[x, y] = (255, 0, 0, 255)
    # Fringe ring (semi-transparent, color-shifted)
    for x in range(28, 72):
        for y in range(28, 72):
            if pixels[x, y][3] == 0:
                pixels[x, y] = (200, 200, 200, 128)
    return img


def test_edge_cleanup_has_name():
    step = EdgeCleanupStep()
    assert step.name == "edge_cleanup"


def test_edge_cleanup_returns_rgba():
    img = _make_fringe_image()
    step = EdgeCleanupStep()
    result = step.process(img, {"feather_radius": 1, "defringe": True})
    assert result.mode == "RGBA"
    assert result.size == img.size


def test_edge_cleanup_reduces_fringe():
    img = _make_fringe_image()
    step = EdgeCleanupStep()
    result = step.process(img, {"feather_radius": 1, "defringe": True})
    orig_alpha = np.array(img.split()[3])
    result_alpha = np.array(result.split()[3])
    assert not np.array_equal(orig_alpha, result_alpha)


def test_skip_when_disabled():
    step = EdgeCleanupStep()
    img = Image.new("RGBA", (10, 10), (255, 0, 0, 255))
    assert step.can_skip(img, {"enabled": False}) is True
