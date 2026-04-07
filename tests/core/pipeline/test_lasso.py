"""Tests for smart selection tool (point-based) and data model."""
from needicons.core.models import LassoMask, GenerationRecord
import numpy as np
from PIL import Image
from needicons.core.pipeline.lasso import (
    select_at_point,
    apply_lasso_masks,
    get_available_strategies,
)


def test_lasso_mask_create():
    mask = LassoMask(
        id="abc123",
        point=(0.5, 0.5),
        mode="remove",
        strategy="grabcut",
    )
    assert mask.id == "abc123"
    assert mask.mode == "remove"
    assert mask.strategy == "grabcut"
    assert mask.point == (0.5, 0.5)


def test_lasso_mask_protect_mode():
    mask = LassoMask(
        id="def456",
        point=(0.3, 0.7),
        mode="protect",
        strategy="sam",
    )
    assert mask.mode == "protect"


def test_lasso_mask_tolerance_default():
    mask = LassoMask(id="t1", point=(0.5, 0.5), mode="remove", strategy="grabcut")
    assert mask.tolerance == 32


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
            LassoMask(id="m1", point=(0.1, 0.2), mode="remove", strategy="grabcut"),
        ],
    )
    assert len(record.lasso_masks) == 1
    assert record.lasso_masks[0].id == "m1"


def test_get_available_strategies_includes_grabcut():
    strategies = get_available_strategies()
    assert "grabcut" in strategies


def test_select_at_point_grabcut_returns_grayscale():
    img = Image.new("RGBA", (128, 128), (255, 255, 255, 255))
    for x in range(40, 88):
        for y in range(40, 88):
            img.putpixel((x, y), (255, 0, 0, 255))
    mask = select_at_point(img, (10, 10), mode="remove", strategy="grabcut")
    assert mask.mode == "L"
    assert mask.size == (128, 128)


def test_select_at_point_remove_mode():
    img = Image.new("RGBA", (128, 128), (0, 0, 200, 255))
    for x in range(40, 88):
        for y in range(40, 88):
            img.putpixel((x, y), (0, 200, 0, 255))
    mask = select_at_point(img, (10, 10), mode="remove", strategy="grabcut", tolerance=40)
    arr = np.array(mask)
    corner_val = arr[10, 10]
    center_val = arr[64, 64]
    assert corner_val < 128
    assert center_val > 128


def test_select_at_point_protect_mode():
    img = Image.new("RGBA", (128, 128), (255, 255, 255, 255))
    for x in range(40, 88):
        for y in range(40, 88):
            img.putpixel((x, y), (255, 0, 0, 255))
    mask = select_at_point(img, (64, 64), mode="protect", strategy="grabcut", tolerance=40)
    arr = np.array(mask)
    center_val = arr[64, 64]
    assert center_val > 128


def test_apply_lasso_masks_remove():
    img = Image.new("RGBA", (128, 128), (0, 0, 200, 255))
    for x in range(40, 88):
        for y in range(40, 88):
            img.putpixel((x, y), (0, 200, 0, 255))
    masks_data = [
        {"point": (10, 10), "mode": "remove", "strategy": "grabcut", "tolerance": 40},
    ]
    result = apply_lasso_masks(img, masks_data)
    assert result.mode == "RGBA"
    corner_alpha = result.getpixel((10, 10))[3]
    assert corner_alpha < 128


def test_apply_lasso_masks_empty_list():
    img = Image.new("RGBA", (128, 128), (255, 0, 0, 255))
    result = apply_lasso_masks(img, [])
    assert np.array_equal(np.array(img), np.array(result))


def test_select_unknown_strategy():
    img = Image.new("RGBA", (64, 64), (255, 255, 255, 255))
    try:
        select_at_point(img, (10, 10), "remove", "nonexistent")
        assert False, "Should have raised ValueError"
    except ValueError as e:
        assert "not available" in str(e).lower()
