"""Tests for processing signature encode/verify pipeline step."""
import pytest
from PIL import Image
import numpy as np
from needicons.core.pipeline.signature import encode, verify


def test_encode_returns_new_image(solid_red_image):
    """Encoding should return a new image, not modify the original."""
    original_data = np.array(solid_red_image).copy()
    result = encode(solid_red_image)
    assert result is not solid_red_image
    assert np.array_equal(np.array(solid_red_image), original_data)


def test_verify_after_encode(solid_red_image):
    """A freshly encoded image should pass verification."""
    tagged = encode(solid_red_image)
    assert verify(tagged) is True


def test_verify_untagged_image(solid_red_image):
    """An image that was never encoded should fail verification."""
    assert verify(solid_red_image) is False


def test_custom_label(solid_red_image):
    """Verification with a different label should fail."""
    tagged = encode(solid_red_image, label="alpha")
    assert verify(tagged, label="alpha") is True
    assert verify(tagged, label="beta") is False


def test_visual_similarity(solid_red_image):
    """Encoded image should be visually identical (max 1 LSB difference per channel)."""
    tagged = encode(solid_red_image)
    orig = np.array(solid_red_image)
    enc = np.array(tagged)
    diff = np.abs(orig.astype(int) - enc.astype(int))
    assert diff.max() <= 1, f"Max pixel difference {diff.max()} exceeds 1"


def test_encode_preserves_alpha():
    """Alpha channel should not be modified by encoding."""
    img = Image.new("RGBA", (128, 128), (100, 150, 200, 180))
    tagged = encode(img)
    orig_alpha = np.array(img)[:, :, 3]
    enc_alpha = np.array(tagged)[:, :, 3]
    assert np.array_equal(orig_alpha, enc_alpha)


def test_encode_rgb_mode():
    """Should work with RGB images (no alpha)."""
    img = Image.new("RGB", (128, 128), (100, 150, 200))
    tagged = encode(img)
    assert tagged.mode == "RGB"
    assert verify(tagged) is True


def test_survives_png_roundtrip(tmp_path):
    """Signature should survive PNG save/load cycle."""
    img = Image.new("RGBA", (256, 256), (80, 120, 200, 255))
    tagged = encode(img)
    path = tmp_path / "test.png"
    tagged.save(path, format="PNG")
    loaded = Image.open(path)
    assert verify(loaded) is True


def test_does_not_survive_jpeg_roundtrip(tmp_path):
    """JPEG compression destroys LSB data — verification should fail."""
    img = Image.new("RGB", (256, 256), (80, 120, 200))
    tagged = encode(img)
    path = tmp_path / "test.jpg"
    tagged.save(path, format="JPEG", quality=85)
    loaded = Image.open(path)
    assert verify(loaded) is False


def test_large_image():
    """Should handle larger images without issues."""
    img = Image.new("RGBA", (1024, 1024), (50, 100, 150, 255))
    tagged = encode(img)
    assert verify(tagged) is True


def test_small_image():
    """Should handle minimum-size images."""
    img = Image.new("RGBA", (64, 64), (200, 100, 50, 255))
    tagged = encode(img)
    assert verify(tagged) is True
