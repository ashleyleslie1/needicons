"""Processing signature — encodes and verifies pipeline metadata in image data.

Used to tag processed images with a verification signature so downstream
tools can confirm the image passed through the processing pipeline.
Uses frequency-domain embedding (DWT-DCT-SVD) which survives lossy
compression and format conversion.  Redundant encoding with majority
voting provides resilience against quality degradation.
"""
from __future__ import annotations
from PIL import Image
import numpy as np

# Minimum image dimension required by the encoder
_MIN_SIZE = 256
_REPEATS = 8  # Redundancy factor for error correction


def encode(image: Image.Image, label: str = "ndi") -> Image.Image:
    """Encode a processing signature into an image.

    Embeds a repeated tag derived from *label* into the frequency domain.
    The image must be at least 256x256.

    Parameters
    ----------
    image : PIL.Image.Image
        Source image (RGB or RGBA).
    label : str
        Identifier to embed (short string).

    Returns
    -------
    PIL.Image.Image
        Image with the embedded signature.
    """
    from imwatermark import WatermarkEncoder

    original_mode = image.mode
    has_alpha = original_mode == "RGBA"

    if has_alpha:
        alpha = image.split()[3]
        rgb = image.convert("RGB")
    else:
        alpha = None
        rgb = image.convert("RGB")

    arr = np.array(rgb)
    h, w = arr.shape[:2]
    if h < _MIN_SIZE or w < _MIN_SIZE:
        return image

    # Repeat the tag for error resilience via majority voting on decode
    tag = label.encode("utf-8") * _REPEATS

    encoder = WatermarkEncoder()
    encoder.set_watermark("bytes", tag)
    encoded = encoder.encode(arr, "dwtDctSvd")

    result = Image.fromarray(encoded, "RGB")
    if has_alpha and alpha is not None:
        result = result.convert("RGBA")
        result.putalpha(alpha)

    return result


def verify(image: Image.Image, label: str = "ndi") -> bool:
    """Check whether an image contains a valid processing signature.

    Uses majority voting across repeated segments to tolerate
    partial corruption from lossy compression.

    Parameters
    ----------
    image : PIL.Image.Image
        Image to check.
    label : str
        Expected label.

    Returns
    -------
    bool
        ``True`` if the signature matches with sufficient confidence.
    """
    from imwatermark import WatermarkDecoder

    rgb = image.convert("RGB")
    arr = np.array(rgb)
    h, w = arr.shape[:2]
    if h < _MIN_SIZE or w < _MIN_SIZE:
        return False

    tag_bytes = label.encode("utf-8")
    tag_len = len(tag_bytes)
    total_len = tag_len * _REPEATS

    decoder = WatermarkDecoder("bytes", total_len * 8)
    try:
        extracted = decoder.decode(arr, "dwtDctSvd")
    except Exception:
        return False

    # Split into segments and vote per byte position
    votes = [0] * tag_len
    for r in range(_REPEATS):
        segment = extracted[r * tag_len : (r + 1) * tag_len]
        for i in range(min(tag_len, len(segment))):
            if segment[i] == tag_bytes[i]:
                votes[i] += 1

    # Require majority of repeats to match for each byte
    threshold = _REPEATS // 2
    return all(v > threshold for v in votes)
