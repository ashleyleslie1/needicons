"""Tests for lasso mask data model and segmentation strategies."""
from needicons.core.models import LassoMask, GenerationRecord


def test_lasso_mask_create():
    mask = LassoMask(
        id="abc123",
        polygon=[(0.1, 0.2), (0.3, 0.15), (0.35, 0.4)],
        mode="remove",
        strategy="grabcut",
    )
    assert mask.id == "abc123"
    assert mask.mode == "remove"
    assert mask.strategy == "grabcut"
    assert len(mask.polygon) == 3


def test_lasso_mask_protect_mode():
    mask = LassoMask(
        id="def456",
        polygon=[(0.5, 0.5), (0.6, 0.5), (0.6, 0.6)],
        mode="protect",
        strategy="sam",
    )
    assert mask.mode == "protect"


def test_generation_record_lasso_masks_default_empty():
    record = GenerationRecord(
        project_id="p1",
        name="test",
        prompt="test prompt",
    )
    assert record.lasso_masks == []


def test_generation_record_with_lasso_masks():
    record = GenerationRecord(
        project_id="p1",
        name="test",
        prompt="test prompt",
        lasso_masks=[
            LassoMask(id="m1", polygon=[(0.1, 0.2)], mode="remove", strategy="grabcut"),
        ],
    )
    assert len(record.lasso_masks) == 1
    assert record.lasso_masks[0].id == "m1"


import numpy as np
from PIL import Image
from needicons.core.pipeline.lasso import (
    refine_mask,
    apply_lasso_masks,
    get_available_strategies,
)


def test_get_available_strategies_includes_grabcut():
    strategies = get_available_strategies()
    assert "grabcut" in strategies


def test_refine_mask_grabcut_returns_grayscale():
    img = Image.new("RGBA", (128, 128), (255, 255, 255, 255))
    for x in range(40, 88):
        for y in range(40, 88):
            img.putpixel((x, y), (255, 0, 0, 255))
    polygon = [(0, 0), (60, 0), (60, 60), (0, 60)]
    mask = refine_mask(img, polygon, mode="remove", strategy="grabcut")
    assert mask.mode == "L"
    assert mask.size == (128, 128)


def test_refine_mask_grabcut_remove_mode():
    # Create image with distinct foreground (green) and background (blue) regions
    img = Image.new("RGBA", (128, 128), (0, 0, 200, 255))  # blue background
    for x in range(40, 88):
        for y in range(40, 88):
            img.putpixel((x, y), (0, 200, 0, 255))  # green foreground
    # Mark top-left corner (blue region) as "remove"
    polygon = [(0, 0), (30, 0), (30, 30), (0, 30)]
    mask = refine_mask(img, polygon, mode="remove", strategy="grabcut")
    arr = np.array(mask)
    # The polygon area (blue) should be removed (low value)
    corner_val = arr[15, 15]
    assert corner_val < 128


def test_refine_mask_grabcut_protect_mode():
    img = Image.new("RGBA", (128, 128), (255, 255, 255, 255))
    for x in range(40, 88):
        for y in range(40, 88):
            img.putpixel((x, y), (255, 0, 0, 255))
    polygon = [(35, 35), (90, 35), (90, 90), (35, 90)]
    mask = refine_mask(img, polygon, mode="protect", strategy="grabcut")
    arr = np.array(mask)
    center_val = arr[64, 64]
    assert center_val > 128


def test_apply_lasso_masks_remove():
    img = Image.new("RGBA", (128, 128), (255, 255, 255, 255))
    for x in range(40, 88):
        for y in range(40, 88):
            img.putpixel((x, y), (255, 0, 0, 255))
    masks_data = [
        {"polygon": [(0, 0), (60, 0), (60, 60), (0, 60)], "mode": "remove", "strategy": "grabcut"},
    ]
    result = apply_lasso_masks(img, masks_data)
    assert result.mode == "RGBA"
    corner_alpha = result.getpixel((10, 10))[3]
    assert corner_alpha < 128


def test_apply_lasso_masks_empty_list():
    img = Image.new("RGBA", (128, 128), (255, 0, 0, 255))
    result = apply_lasso_masks(img, [])
    assert np.array_equal(np.array(img), np.array(result))


def test_refine_mask_unknown_strategy():
    img = Image.new("RGBA", (64, 64), (255, 255, 255, 255))
    try:
        refine_mask(img, [(0, 0), (10, 0), (10, 10)], "remove", "nonexistent")
        assert False, "Should have raised ValueError"
    except ValueError as e:
        assert "not available" in str(e).lower() or "not installed" in str(e).lower()


def test_apply_lasso_masks_protect():
    img = Image.new("RGBA", (128, 128), (255, 0, 0, 0))
    masks_data = [
        {"polygon": [(30, 30), (90, 30), (90, 90), (30, 90)], "mode": "protect", "strategy": "grabcut"},
    ]
    result = apply_lasso_masks(img, masks_data)
    center_alpha = result.getpixel((64, 64))[3]
    assert center_alpha > 0
