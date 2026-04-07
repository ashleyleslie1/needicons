"""Tests for upscale pipeline step."""
from PIL import Image
from needicons.core.pipeline.upscale import UpscaleStep


def test_upscale_2x_lanczos():
    img = Image.new("RGBA", (64, 64), (100, 100, 100, 255))
    step = UpscaleStep()
    result = step.process(img, {"factor": 2})
    assert result.size == (128, 128)
    assert result.mode == "RGBA"


def test_upscale_4x_lanczos():
    img = Image.new("RGBA", (32, 32), (100, 100, 100, 255))
    step = UpscaleStep()
    result = step.process(img, {"factor": 4})
    assert result.size == (128, 128)


def test_upscale_skip_factor_1():
    step = UpscaleStep()
    assert step.can_skip(Image.new("RGBA", (1, 1)), {"factor": 1}) is True
    assert step.can_skip(Image.new("RGBA", (1, 1)), {"factor": 2}) is False
