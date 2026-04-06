import pytest
from PIL import Image
from needicons.core.pipeline.resize import ResizeStep, resize_multi


def test_resize_single_size():
    img = Image.new("RGBA", (256, 256), (255, 0, 0, 255))
    step = ResizeStep()
    result = step.process(img, {"sizes": [128]})
    assert result.size == (128, 128)


def test_resize_multi_returns_dict():
    img = Image.new("RGBA", (256, 256), (255, 0, 0, 255))
    results = resize_multi(img, sizes=[128, 64, 32])
    assert len(results) == 3
    assert results[128].size == (128, 128)
    assert results[64].size == (64, 64)
    assert results[32].size == (32, 32)


def test_resize_sharpens_small():
    img = Image.new("RGBA", (256, 256), (100, 100, 100, 255))
    results = resize_multi(img, sizes=[32], sharpen_below=48)
    assert results[32].size == (32, 32)


def test_resize_no_sharpen_large():
    img = Image.new("RGBA", (256, 256), (100, 100, 100, 255))
    results = resize_multi(img, sizes=[128], sharpen_below=48)
    assert results[128].size == (128, 128)


def test_resize_step_name():
    assert ResizeStep().name == "resize"
