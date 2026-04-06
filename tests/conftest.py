import pytest
from pathlib import Path
from PIL import Image
import numpy as np


@pytest.fixture
def tmp_data_dir(tmp_path):
    """Temporary data directory for tests."""
    return tmp_path / "needicons-data"


@pytest.fixture
def solid_red_image():
    """A 256x256 solid red RGBA image (no transparency)."""
    img = Image.new("RGBA", (256, 256), (255, 0, 0, 255))
    return img


@pytest.fixture
def icon_on_white():
    """A 256x256 image with a 100x100 red square centered on white background."""
    img = Image.new("RGBA", (256, 256), (255, 255, 255, 255))
    for x in range(78, 178):
        for y in range(78, 178):
            img.putpixel((x, y), (255, 0, 0, 255))
    return img


@pytest.fixture
def icon_on_transparent():
    """A 256x256 image with a 100x100 red square centered on transparent background."""
    img = Image.new("RGBA", (256, 256), (0, 0, 0, 0))
    for x in range(78, 178):
        for y in range(78, 178):
            img.putpixel((x, y), (255, 0, 0, 255))
    return img


@pytest.fixture
def grid_image():
    """A 512x512 image with 4 colored squares in a 2x2 grid on white background."""
    img = Image.new("RGBA", (512, 512), (255, 255, 255, 255))
    colors = [(255, 0, 0, 255), (0, 255, 0, 255), (0, 0, 255, 255), (255, 255, 0, 255)]
    positions = [(50, 50), (300, 50), (50, 300), (300, 300)]
    for (px, py), color in zip(positions, colors):
        for x in range(px, px + 100):
            for y in range(py, py + 100):
                img.putpixel((x, y), color)
    return img
