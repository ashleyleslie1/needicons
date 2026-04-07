"""Grid detection — splits multi-icon images into individual icons."""
from __future__ import annotations

import cv2
import numpy as np
from PIL import Image


def _split_quadrants(image: Image.Image, padding: int = 5) -> list[Image.Image]:
    """Split image into 4 equal quadrants (2x2 grid)."""
    w, h = image.size
    mid_x, mid_y = w // 2, h // 2
    quadrants = [
        image.crop((padding, padding, mid_x - padding, mid_y - padding)),          # top-left
        image.crop((mid_x + padding, padding, w - padding, mid_y - padding)),       # top-right
        image.crop((padding, mid_y + padding, mid_x - padding, h - padding)),       # bottom-left
        image.crop((mid_x + padding, mid_y + padding, w - padding, h - padding)),   # bottom-right
    ]
    return quadrants


def detect_icons(
    image: Image.Image,
    min_area_ratio: float = 0.01,
    padding: int = 10,
) -> list[Image.Image]:
    """Detect and extract individual icons from an image.

    Works on both white-background and transparent-background images.
    Returns a list of cropped RGBA images, one per detected icon.
    Falls back to quadrant splitting if contour detection finds fewer than 2 icons.
    """
    if image.mode != "RGBA":
        image = image.convert("RGBA")

    arr = np.array(image)
    total_area = arr.shape[0] * arr.shape[1]
    min_area = total_area * min_area_ratio

    alpha = arr[:, :, 3]
    has_transparency = np.sum(alpha < 250) > (total_area * 0.05)

    if has_transparency:
        binary = (alpha > 128).astype(np.uint8) * 255
    else:
        rgb = arr[:, :, :3].astype(np.float32)
        bg_samples = [rgb[0, 0], rgb[0, -1], rgb[-1, 0], rgb[-1, -1]]
        bg_color = np.median(bg_samples, axis=0)
        diff = np.linalg.norm(rgb - bg_color, axis=2).astype(np.float32)
        _, binary = cv2.threshold(diff, 20, 255, cv2.THRESH_BINARY)
        binary = binary.astype(np.uint8)

    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (15, 15))
    binary = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, kernel)

    contours, _ = cv2.findContours(binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    valid_contours = [c for c in contours if cv2.contourArea(c) >= min_area]

    # If contour detection finds fewer than 2 icons, fall back to quadrant split
    if len(valid_contours) < 2:
        return _split_quadrants(image)

    boxes = [cv2.boundingRect(c) for c in valid_contours]
    boxes.sort(key=lambda b: (b[1] // (image.height // 3), b[0]))

    icons = []
    for x, y, w, h in boxes:
        x1 = max(0, x - padding)
        y1 = max(0, y - padding)
        x2 = min(image.width, x + w + padding)
        y2 = min(image.height, y + h + padding)
        cropped = image.crop((x1, y1, x2, y2))
        icons.append(cropped)

    return icons if icons else _split_quadrants(image)
