"""Lasso-assisted background removal — segmentation strategies.

Provides GrabCut (always available via OpenCV), with optional SAM and CascadePSP
for higher-quality refinement. All strategies take an RGBA image + pixel-coordinate
polygon and return a grayscale mask (0=transparent, 255=keep).
"""
from __future__ import annotations

import cv2
import numpy as np
from PIL import Image


def get_available_strategies() -> list[str]:
    """Return list of installed segmentation strategies."""
    available = ["grabcut"]
    try:
        import segment_anything  # noqa: F401
        available.append("sam")
    except ImportError:
        pass
    try:
        import cascadepsp  # noqa: F401
        available.append("cascadepsp")
    except ImportError:
        pass
    return available


def refine_mask(
    image: Image.Image,
    polygon: list[tuple[int, int]],
    mode: str,
    strategy: str = "grabcut",
) -> Image.Image:
    """Compute a refined segmentation mask from image + polygon selection.

    Args:
        image: RGBA PIL image.
        polygon: List of (x, y) pixel coordinates defining the selection.
        mode: "remove" (selected region becomes transparent) or "protect" (selected region stays opaque).
        strategy: "grabcut", "sam", or "cascadepsp".

    Returns:
        Grayscale PIL image (mode "L"): 0=transparent, 255=keep.
    """
    available = get_available_strategies()
    if strategy not in available:
        raise ValueError(f"Strategy '{strategy}' not available. Installed: {available}")

    if strategy == "grabcut":
        return _grabcut_refine(image, polygon, mode)
    elif strategy == "sam":
        return _sam_refine(image, polygon, mode)
    elif strategy == "cascadepsp":
        return _cascadepsp_refine(image, polygon, mode)
    else:
        raise ValueError(f"Unknown strategy: {strategy}")


def apply_lasso_masks(
    image: Image.Image,
    masks_data: list[dict],
) -> Image.Image:
    """Apply a list of lasso mask operations to an RGBA image.

    Each entry in masks_data is a dict with keys: polygon, mode, strategy.
    Polygon coords are in pixel space (already scaled from normalized).

    Returns a new RGBA image with alpha modified by the masks.
    """
    if not masks_data:
        return image.copy()

    result = image.convert("RGBA")
    alpha = np.array(result.split()[3], dtype=np.float32)

    for mask_entry in masks_data:
        polygon = mask_entry["polygon"]
        mode = mask_entry["mode"]
        strategy = mask_entry["strategy"]

        refined = refine_mask(result, polygon, mode, strategy)
        refined_arr = np.array(refined, dtype=np.float32)

        if mode == "remove":
            # Where refined mask says 0 (background), force alpha to 0
            alpha = np.minimum(alpha, refined_arr)
        elif mode == "protect":
            # Where refined mask says 255 (foreground), force alpha to 255
            alpha = np.maximum(alpha, refined_arr)

    # Apply modified alpha
    result_arr = np.array(result)
    result_arr[:, :, 3] = alpha.clip(0, 255).astype(np.uint8)
    return Image.fromarray(result_arr)


def _grabcut_refine(
    image: Image.Image,
    polygon: list[tuple[int, int]],
    mode: str,
) -> Image.Image:
    """GrabCut-based segmentation. Always available via OpenCV."""
    img_rgba = image.convert("RGBA")
    img_rgb = np.array(img_rgba.convert("RGB"))
    h, w = img_rgb.shape[:2]

    # Create initial mask
    gc_mask = np.full((h, w), cv2.GC_PR_BGD, dtype=np.uint8)

    # Fill polygon region based on mode
    pts = np.array(polygon, dtype=np.int32).reshape((-1, 1, 2))

    if mode == "remove":
        # Polygon = definite background; outside = probable foreground
        gc_mask[:] = cv2.GC_PR_FGD
        cv2.fillPoly(gc_mask, [pts], cv2.GC_BGD)
    else:
        # protect: polygon = definite foreground; outside = probable background
        gc_mask[:] = cv2.GC_PR_BGD
        cv2.fillPoly(gc_mask, [pts], cv2.GC_FGD)

    # Run GrabCut
    bgd_model = np.zeros((1, 65), np.float64)
    fgd_model = np.zeros((1, 65), np.float64)
    cv2.grabCut(img_rgb, gc_mask, None, bgd_model, fgd_model, 5, cv2.GC_INIT_WITH_MASK)

    # Convert GrabCut mask to binary: FGD + PR_FGD = 255 (keep), rest = 0
    output_mask = np.where(
        (gc_mask == cv2.GC_FGD) | (gc_mask == cv2.GC_PR_FGD), 255, 0
    ).astype(np.uint8)

    return Image.fromarray(output_mask, mode="L")


def _sam_refine(
    image: Image.Image,
    polygon: list[tuple[int, int]],
    mode: str,
) -> Image.Image:
    """SAM (Segment Anything) based segmentation. Requires segment-anything package."""
    raise ValueError("SAM strategy not yet implemented. Install: pip install segment-anything")


def _cascadepsp_refine(
    image: Image.Image,
    polygon: list[tuple[int, int]],
    mode: str,
) -> Image.Image:
    """CascadePSP refinement. Runs GrabCut first, then refines edges with CascadePSP."""
    raise ValueError("CascadePSP strategy not yet implemented. Install: pip install cascadepsp")
