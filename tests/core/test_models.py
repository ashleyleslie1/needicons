import pytest
from needicons.core.models import (
    ProcessingProfile,
    StrokeConfig,
    MaskConfig,
    FillConfig,
    OutputConfig,
    GenerationMode,
    IconStyle,
    QualityMode,
    Project,
    SavedIcon,
    GenerationRecord,
    GenerationVariation,
    PostProcessingSettings,
)


def test_processing_profile_defaults():
    profile = ProcessingProfile(name="Default")
    assert profile.background_removal.enabled is True
    assert profile.stroke.enabled is False
    assert profile.mask.shape == "none"
    assert profile.output.sizes == [256, 128, 64, 32]
    assert profile.output.formats == ["png"]


def test_processing_profile_custom():
    profile = ProcessingProfile(
        name="Custom",
        stroke=StrokeConfig(enabled=True, width=2, color="#FFFFFF", position="outer"),
        mask=MaskConfig(shape="rounded_rect", corner_radius=16),
        fill=FillConfig(type="solid", color="#2563EB"),
        output=OutputConfig(sizes=[256, 128], formats=["png", "webp"]),
    )
    assert profile.stroke.width == 2
    assert profile.mask.shape == "rounded_rect"
    assert profile.fill.color == "#2563EB"
    assert profile.output.sizes == [256, 128]


def test_generation_mode_enum():
    assert GenerationMode.PRECISION == "precision"
    assert GenerationMode.ECONOMY == "economy"


def test_icon_style_enum():
    assert IconStyle.SOLID == "solid"
    assert IconStyle.OUTLINE == "outline"
    assert IconStyle.COLOR == "color"
    assert IconStyle.FLAT == "flat"
    assert IconStyle.STICKER == "sticker"


def test_quality_mode_enum():
    assert QualityMode.HQ == "hq"
    assert QualityMode.NORMAL == "normal"


def test_project_creation():
    project = Project(name="Test Pack")
    assert project.name == "Test Pack"
    assert project.icons == []
    assert project.style_preference == IconStyle.SOLID
    assert project.quality_preference == QualityMode.NORMAL
    assert project.post_processing.stroke.enabled is False
    assert project.post_processing.padding.percent == 10.0


def test_saved_icon():
    icon = SavedIcon(name="tent", prompt="camping tent", source_path="images/test.png")
    assert icon.name == "tent"
    assert icon.style == IconStyle.SOLID
    assert icon.id is not None


def test_generation_record():
    record = GenerationRecord(project_id="p1", name="tent", prompt="tent")
    assert record.variations == []
    assert record.style == IconStyle.SOLID
    assert record.quality == QualityMode.NORMAL


def test_generation_variation():
    v = GenerationVariation(index=0, source_path="raw/v0.png", preview_path="preview/v0.png")
    assert v.picked is False
    assert v.index == 0


def test_generation_record_has_level_field():
    from needicons.core.models import GenerationRecord
    record = GenerationRecord(project_id="p1", name="Test", prompt="test")
    assert record.bg_removal_level == 0
    assert "bg_removal_applied" not in GenerationRecord.model_fields
    assert "bg_removal_aggressiveness" not in GenerationRecord.model_fields


def test_generation_record_request_id_field():
    from needicons.core.models import GenerationRecord
    record = GenerationRecord(project_id="p1", name="Test", prompt="test")
    assert record.bg_removal_request_id == ""


def test_generation_record_migrates_old_fields():
    from needicons.core.models import GenerationRecord
    data = {"project_id": "p1", "name": "OldIcon", "prompt": "old",
            "bg_removal_applied": True, "bg_removal_aggressiveness": 65}
    record = GenerationRecord(**data)
    assert 4 <= record.bg_removal_level <= 7


def test_generation_record_migrates_disabled():
    from needicons.core.models import GenerationRecord
    data = {"project_id": "p1", "name": "OldIcon", "prompt": "old",
            "bg_removal_applied": False, "bg_removal_aggressiveness": 50}
    record = GenerationRecord(**data)
    assert record.bg_removal_level == 0
