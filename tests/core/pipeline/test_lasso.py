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
