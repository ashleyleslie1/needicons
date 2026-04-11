"""Processing signature — encodes and verifies pipeline metadata in image data.

Used to tag processed images with a verification signature so downstream
tools can confirm the image passed through the processing pipeline.
The signature is stored in the least-significant bits of the color channels
and does not affect visual quality.
"""
from __future__ import annotations
import hashlib
import struct
from PIL import Image
import numpy as np

# Fixed header that marks the start of signature data
_HEADER = b"\x89SIG"
_HEADER_BITS = len(_HEADER) * 8
_MAX_PAYLOAD = 128  # max bytes for signature payload


def _text_to_bits(data: bytes) -> list[int]:
    bits = []
    for byte in data:
        for i in range(7, -1, -1):
            bits.append((byte >> i) & 1)
    return bits


def _bits_to_bytes(bits: list[int]) -> bytes:
    result = bytearray()
    for i in range(0, len(bits), 8):
        byte = 0
        for bit in bits[i:i + 8]:
            byte = (byte << 1) | bit
        result.append(byte)
    return bytes(result)


def _compute_tag(label: str) -> bytes:
    """Derive a short tag from a label string."""
    return hashlib.sha256(label.encode()).digest()[:8]


def encode(image: Image.Image, label: str = "ndi") -> Image.Image:
    """Encode a processing signature into an image.

    Embeds a short tag derived from *label* into the least-significant bits
    of the RGB channels.  The image must be at least 64x64 and is returned
    as a new copy (the original is not modified).

    Parameters
    ----------
    image : PIL.Image.Image
        Source image (RGB or RGBA).
    label : str
        Identifier to embed.  Default ``"ndi"``.

    Returns
    -------
    PIL.Image.Image
        Image with the embedded signature.
    """
    img = image.copy().convert("RGBA")
    arr = np.array(img)
    h, w = arr.shape[:2]

    tag = _compute_tag(label)
    payload = _HEADER + struct.pack(">H", len(tag)) + tag
    bits = _text_to_bits(payload)
    total_bits = len(bits)

    # Need at least 3 bits per pixel (RGB channels), skip alpha
    capacity = h * w * 3
    if total_bits > capacity:
        return image  # image too small, return unmodified

    flat = arr[:, :, :3].reshape(-1)
    for i, bit in enumerate(bits):
        flat[i] = (flat[i] & 0xFE) | bit

    arr[:, :, :3] = flat.reshape(h, w, 3)

    result = Image.fromarray(arr, "RGBA")
    if image.mode == "RGB":
        result = result.convert("RGB")
    return result


def verify(image: Image.Image, label: str = "ndi") -> bool:
    """Check whether an image contains a valid processing signature.

    Parameters
    ----------
    image : PIL.Image.Image
        Image to check.
    label : str
        Expected label.

    Returns
    -------
    bool
        ``True`` if the signature matches.
    """
    img = image.convert("RGBA")
    arr = np.array(img)
    h, w = arr.shape[:2]

    flat = arr[:, :, :3].reshape(-1)
    capacity = len(flat)

    # Read header
    if capacity < _HEADER_BITS + 16:
        return False

    header_bits = [(flat[i] & 1) for i in range(_HEADER_BITS)]
    header = _bits_to_bytes(header_bits)
    if header != _HEADER:
        return False

    # Read length (2 bytes = 16 bits)
    offset = _HEADER_BITS
    len_bits = [(flat[offset + i] & 1) for i in range(16)]
    tag_len = struct.unpack(">H", _bits_to_bytes(len_bits))[0]
    if tag_len > _MAX_PAYLOAD or tag_len == 0:
        return False

    offset += 16
    tag_bit_len = tag_len * 8
    if offset + tag_bit_len > capacity:
        return False

    tag_bits = [(flat[offset + i] & 1) for i in range(tag_bit_len)]
    stored_tag = _bits_to_bytes(tag_bits)

    expected = _compute_tag(label)
    return stored_tag == expected
