"""Tests for denoise pipeline step."""
from PIL import Image
import numpy as np
from needicons.core.pipeline.denoise import DenoiseStep


def test_denoise_returns_rgba():
    img = Image.new("RGBA", (64, 64), (100, 100, 100, 255))
    step = DenoiseStep()
    result = step.process(img, {"strength": 5})
    assert result.mode == "RGBA"
    assert result.size == (64, 64)


def test_denoise_preserves_alpha():
    img = Image.new("RGBA", (64, 64), (100, 100, 100, 128))
    step = DenoiseStep()
    result = step.process(img, {"strength": 3})
    # Alpha should be preserved
    alpha = np.array(result.split()[3])
    assert np.all(alpha == 128)


def test_denoise_skip_zero_strength():
    step = DenoiseStep()
    assert step.can_skip(Image.new("RGBA", (1, 1)), {"strength": 0}) is True
    assert step.can_skip(Image.new("RGBA", (1, 1)), {"strength": 5}) is False
