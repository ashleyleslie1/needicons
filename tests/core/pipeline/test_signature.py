"""Tests for processing signature encode/verify pipeline step."""
import pytest
from PIL import Image
import numpy as np
from needicons.core.pipeline.signature import encode, verify


@pytest.fixture
def textured_image():
    """A 512x512 image with varied pixel data (simulates real icon content)."""
    np.random.seed(42)
    arr = np.random.randint(40, 220, (512, 512, 3), dtype=np.uint8)
    return Image.fromarray(arr, "RGB")


@pytest.fixture
def icon_like_image():
    """A 512x512 image simulating an icon on transparent background."""
    img = Image.new("RGBA", (512, 512), (0, 0, 0, 0))
    # Draw a colorful shape in the center
    np.random.seed(99)
    arr = np.array(img)
    for y in range(128, 384):
        for x in range(128, 384):
            arr[y, x] = [
                int(80 + 120 * abs(np.sin(x * 0.05))),
                int(60 + 140 * abs(np.cos(y * 0.04))),
                int(100 + 100 * abs(np.sin((x + y) * 0.03))),
                255,
            ]
    return Image.fromarray(arr, "RGBA")


def test_encode_returns_new_image(textured_image):
    """Encoding should return a new image, not modify the original."""
    original_data = np.array(textured_image).copy()
    result = encode(textured_image)
    assert result is not textured_image
    assert np.array_equal(np.array(textured_image), original_data)


def test_verify_after_encode(textured_image):
    """A freshly encoded image should pass verification."""
    tagged = encode(textured_image)
    assert verify(tagged) is True


def test_verify_untagged_image(textured_image):
    """An image that was never encoded should fail verification."""
    assert verify(textured_image) is False


def test_custom_label(textured_image):
    """Verification with a different label should fail."""
    tagged = encode(textured_image, label="abc")
    assert verify(tagged, label="abc") is True
    assert verify(tagged, label="xyz") is False


def test_visual_similarity(textured_image):
    """Encoded image should be visually similar (small differences only)."""
    tagged = encode(textured_image)
    orig = np.array(textured_image).astype(float)
    enc = np.array(tagged).astype(float)
    diff = np.abs(orig[:, :, :3] - enc[:, :, :3])
    assert diff.mean() < 20, f"Mean pixel difference {diff.mean():.2f} too high"


def test_encode_preserves_alpha(icon_like_image):
    """Alpha channel should not be modified by encoding."""
    tagged = encode(icon_like_image)
    orig_alpha = np.array(icon_like_image)[:, :, 3]
    enc_alpha = np.array(tagged)[:, :, 3]
    assert np.array_equal(orig_alpha, enc_alpha)


def test_encode_rgb_mode(textured_image):
    """Should work with RGB images (no alpha)."""
    tagged = encode(textured_image)
    assert tagged.mode == "RGB"
    assert verify(tagged) is True


def test_survives_png_roundtrip(textured_image, tmp_path):
    """Signature should survive PNG save/load cycle."""
    tagged = encode(textured_image)
    path = tmp_path / "test.png"
    tagged.save(path, format="PNG")
    loaded = Image.open(path)
    assert verify(loaded) is True


def test_survives_webp_lossless_roundtrip(textured_image, tmp_path):
    """Signature should survive lossless WebP."""
    tagged = encode(textured_image)
    path = tmp_path / "test.webp"
    tagged.save(path, format="WEBP", lossless=True)
    loaded = Image.open(path)
    assert verify(loaded) is True


def test_too_small_image_returns_original():
    """Images below 256x256 should be returned unmodified."""
    img = Image.new("RGB", (128, 128), (100, 150, 200))
    tagged = encode(img)
    # Should be identical — too small to encode
    assert np.array_equal(np.array(img), np.array(tagged))
    assert verify(tagged) is False


def test_icon_with_alpha(icon_like_image):
    """Should work with RGBA icon images."""
    tagged = encode(icon_like_image)
    assert tagged.mode == "RGBA"
    assert verify(tagged) is True


def test_large_image():
    """Should handle larger images."""
    np.random.seed(7)
    arr = np.random.randint(30, 230, (1024, 1024, 3), dtype=np.uint8)
    img = Image.fromarray(arr, "RGB")
    tagged = encode(img)
    assert verify(tagged) is True
