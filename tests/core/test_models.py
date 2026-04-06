import pytest
from needicons.core.models import (
    Pack,
    Requirement,
    Candidate,
    ProcessingProfile,
    StepConfig,
    BackgroundRemovalConfig,
    StrokeConfig,
    MaskConfig,
    FillConfig,
    ShadowConfig,
    ColorConfig,
    OutputConfig,
    RequirementStatus,
    GenerationMode,
)


def test_pack_creation():
    pack = Pack(name="Test Pack", style_prompt="flat minimalist icons")
    assert pack.name == "Test Pack"
    assert pack.style_prompt == "flat minimalist icons"
    assert pack.requirements == []
    assert pack.profile_id is None
    assert pack.id is not None


def test_requirement_creation():
    req = Requirement(name="tent", description="camping tent, triangular")
    assert req.name == "tent"
    assert req.description == "camping tent, triangular"
    assert req.status == RequirementStatus.PENDING
    assert req.candidates == []


def test_requirement_default_description():
    req = Requirement(name="backpack")
    assert req.description is None
    assert req.status == RequirementStatus.PENDING


def test_candidate_creation():
    cand = Candidate(
        requirement_id="req-123",
        source_path="data/raw/abc.png",
        preview_path="data/preview/abc.png",
        origin="single",
    )
    assert cand.selected is False
    assert cand.origin == "single"


def test_candidate_grid_origin():
    cand = Candidate(
        requirement_id="req-123",
        source_path="data/raw/abc.png",
        preview_path="data/preview/abc.png",
        origin="grid_0",
    )
    assert cand.origin == "grid_0"


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


def test_requirement_status_transitions():
    assert RequirementStatus.PENDING == "pending"
    assert RequirementStatus.GENERATED == "generated"
    assert RequirementStatus.ACCEPTED == "accepted"
