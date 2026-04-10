"""Smart selection tool — click a point, auto-expand to select the region.

Click on background → flood-fill expands to find connected similar pixels →
GrabCut refines the boundary. No manual polygon drawing needed.
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


def select_at_point(
    image: Image.Image,
    point: tuple[int, int],
    mode: str,
    strategy: str = "grabcut",
    tolerance: int = 32,
) -> Image.Image:
    """Select a region starting from a click point.

    Args:
        image: RGBA PIL image.
        point: (x, y) pixel coordinates where user clicked.
        mode: "remove" (region becomes transparent) or "protect" (region stays opaque).
        strategy: "grabcut", "sam", or "cascadepsp".
        tolerance: color distance tolerance for initial flood fill (0-255).

    Returns:
        Grayscale PIL image (mode "L"): 0=transparent, 255=keep.
    """
    available = get_available_strategies()
    if strategy not in available:
        raise ValueError(f"Strategy '{strategy}' not available. Installed: {available}")

    if strategy == "grabcut":
        return _grabcut_select(image, point, mode, tolerance)
    elif strategy == "sam":
        return _sam_select(image, point, mode)
    elif strategy == "cascadepsp":
        return _cascadepsp_select(image, point, mode, tolerance)
    else:
        raise ValueError(f"Unknown strategy: {strategy}")


def apply_lasso_masks(
    image: Image.Image,
    masks_data: list[dict],
) -> Image.Image:
    """Apply a list of point-based mask operations to an RGBA image.

    Each entry in masks_data is a dict with keys: point, mode, strategy, tolerance.

    Returns a new RGBA image with alpha modified by the masks.
    """
    if not masks_data:
        return image.copy()

    result = image.convert("RGBA")
    alpha = np.array(result.split()[3], dtype=np.float32)

    for mask_entry in masks_data:
        point = mask_entry["point"]
        mode = mask_entry["mode"]
        strategy = mask_entry["strategy"]
        tolerance = mask_entry.get("tolerance", 32)

        refined = select_at_point(result, tuple(point), mode, strategy, tolerance)
        refined_arr = np.array(refined, dtype=np.float32)

        if mode == "remove":
            alpha = np.minimum(alpha, refined_arr)
        elif mode == "protect":
            alpha = np.maximum(alpha, refined_arr)

    result_arr = np.array(result)
    result_arr[:, :, 3] = alpha.clip(0, 255).astype(np.uint8)
    return Image.fromarray(result_arr)


def _flood_fill_mask(image_rgb: np.ndarray, point: tuple[int, int], tolerance: int) -> np.ndarray:
    """Flood fill from a point to find connected similar-color region.

    Returns a binary mask: 255 where flood reached, 0 elsewhere.
    """
    h, w = image_rgb.shape[:2]
    x, y = point
    x = max(0, min(w - 1, x))
    y = max(0, min(h - 1, y))

    # OpenCV floodFill needs a mask 2px larger than image
    ff_mask = np.zeros((h + 2, w + 2), dtype=np.uint8)
    lo_diff = (tolerance, tolerance, tolerance)
    hi_diff = (tolerance, tolerance, tolerance)

    # Use positional args for OpenCV compatibility across versions
    cv2.floodFill(
        image_rgb.copy(), ff_mask, (x, y),
        (255, 255, 255),  # newVal
        lo_diff,  # loDiff
        hi_diff,  # upDiff
        cv2.FLOODFILL_MASK_ONLY | (255 << 8) | 4,  # flags
    )

    # Extract the inner mask (strip 1px border)
    return ff_mask[1:-1, 1:-1]


def _grabcut_select(
    image: Image.Image,
    point: tuple[int, int],
    mode: str,
    tolerance: int,
) -> Image.Image:
    """Click-to-select using flood fill + GrabCut refinement."""
    img_rgba = image.convert("RGBA")
    img_rgb = np.array(img_rgba.convert("RGB"))
    h, w = img_rgb.shape[:2]

    # Step 1: Flood fill from click point to find the seed region
    flood = _flood_fill_mask(img_rgb, point, tolerance)

    # Step 2: Build GrabCut initial mask from flood fill
    gc_mask = np.full((h, w), cv2.GC_PR_FGD, dtype=np.uint8)

    if mode == "remove":
        # Flooded area = definite background, rest = probable foreground
        gc_mask[flood > 0] = cv2.GC_BGD
    else:
        # Flooded area = definite foreground, rest = probable background
        gc_mask[:] = cv2.GC_PR_BGD
        gc_mask[flood > 0] = cv2.GC_FGD

    # Step 3: Run GrabCut to refine boundaries
    bgd_model = np.zeros((1, 65), np.float64)
    fgd_model = np.zeros((1, 65), np.float64)
    cv2.grabCut(img_rgb, gc_mask, None, bgd_model, fgd_model, 5, cv2.GC_INIT_WITH_MASK)

    # FGD + PR_FGD = 255 (keep), rest = 0 (remove)
    output_mask = np.where(
        (gc_mask == cv2.GC_FGD) | (gc_mask == cv2.GC_PR_FGD), 255, 0
    ).astype(np.uint8)

    return Image.fromarray(output_mask, mode="L")


_sam_predictor = None


def _get_sam_predictor():
    """Lazy-load SAM model and return a cached SamPredictor."""
    global _sam_predictor
    if _sam_predictor is not None:
        return _sam_predictor

    import os
    import torch
    from segment_anything import sam_model_registry, SamPredictor

    cache_dir = os.path.expanduser("~/.cache/needicons/models")
    checkpoint = os.path.join(cache_dir, "sam_vit_b_01ec64.pth")
    if not os.path.exists(checkpoint):
        raise ValueError(
            f"SAM checkpoint not found at {checkpoint}. "
            "Download from https://dl.fbaipublicfiles.com/segment_anything/sam_vit_b_01ec64.pth"
        )

    device = "cuda" if torch.cuda.is_available() else "cpu"
    sam = sam_model_registry["vit_b"](checkpoint=checkpoint)
    sam.to(device=device)
    _sam_predictor = SamPredictor(sam)
    return _sam_predictor


def _sam_select(
    image: Image.Image,
    point: tuple[int, int],
    mode: str,
) -> Image.Image:
    """SAM point-based selection. Uses Segment Anything Model."""
    predictor = _get_sam_predictor()

    img_rgba = image.convert("RGBA")
    img_rgb = np.array(img_rgba.convert("RGB"))

    predictor.set_image(img_rgb)

    input_point = np.array([[point[0], point[1]]])
    # Label 1 = foreground point, 0 = background point
    # For "remove" mode: user clicked on background, so label=0 (background)
    # For "protect" mode: user clicked on foreground, so label=1 (foreground)
    input_label = np.array([0 if mode == "remove" else 1])

    masks, scores, _ = predictor.predict(
        point_coords=input_point,
        point_labels=input_label,
        multimask_output=True,
    )

    # Pick the mask with highest score
    best_idx = np.argmax(scores)
    mask = masks[best_idx]

    h, w = img_rgb.shape[:2]
    if mode == "remove":
        # mask=True where SAM thinks the object is; invert for "remove" semantics
        # SAM labels background as the clicked region — but with label=0, SAM
        # returns the foreground mask. We want: 255=keep, 0=transparent
        # So if user clicked background (label=0), SAM gives foreground mask → keep that
        output_mask = np.where(mask, 255, 0).astype(np.uint8)
    else:
        # protect mode: mask is the protected region
        output_mask = np.where(mask, 255, 0).astype(np.uint8)

    return Image.fromarray(output_mask, mode="L")


def _cascadepsp_select(
    image: Image.Image,
    point: tuple[int, int],
    mode: str,
    tolerance: int,
) -> Image.Image:
    """GrabCut + CascadePSP refinement."""
    raise ValueError("CascadePSP strategy not yet implemented. Install: pip install cascadepsp")
