"""Domain models for NeedIcons."""
from __future__ import annotations

import datetime
import uuid
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


def _new_id() -> str:
    return uuid.uuid4().hex[:12]


class GenerationMode(str, Enum):
    PRECISION = "precision"
    ECONOMY = "economy"


class JobStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


# --- Processing Profile Configs ---


class BackgroundRemovalConfig(BaseModel):
    enabled: bool = True
    model: str = "u2net"
    alpha_matting: bool = True
    alpha_matting_foreground_threshold: int = 240
    alpha_matting_background_threshold: int = 10


class EdgeCleanupConfig(BaseModel):
    enabled: bool = True
    feather_radius: int = 1
    defringe: bool = True


class WeightNormalizationConfig(BaseModel):
    enabled: bool = False
    target_fill: float = 0.7


class ColorConfig(BaseModel):
    overlay_color: Optional[str] = None
    brightness: int = 0
    contrast: int = 0
    saturation: int = 0
    batch_normalize: bool = False


class StrokeConfig(BaseModel):
    enabled: bool = False
    width: int = 2
    color: str = "#000000"
    position: str = "outer"  # inner | outer | center


class MaskConfig(BaseModel):
    shape: str = "none"  # none | circle | square | rounded_rect | squircle
    corner_radius: int = 16


class FillConfig(BaseModel):
    type: str = "none"  # none | solid | gradient
    color: str = "#FFFFFF"
    gradient_stops: Optional[list[str]] = None
    gradient_angle: int = 0


class ShadowConfig(BaseModel):
    enabled: bool = False
    offset_x: int = 0
    offset_y: int = 1
    blur_radius: int = 2
    color: str = "#00000040"
    opacity: float = 1.0


class PaddingConfig(BaseModel):
    percent: Optional[float] = None
    pixels: Optional[int] = None


class OutputConfig(BaseModel):
    sizes: list[int] = Field(default_factory=lambda: [256, 128, 64, 32])
    formats: list[str] = Field(default_factory=lambda: ["png"])
    sharpen_below: int = 48


class StepConfig(BaseModel):
    """Union of all step configs, used for generic pipeline step interface."""
    pass


# --- Domain Models ---


class ProcessingProfile(BaseModel):
    id: str = Field(default_factory=_new_id)
    name: str
    style_prompt: str = ""
    background_removal: BackgroundRemovalConfig = Field(default_factory=BackgroundRemovalConfig)
    edge_cleanup: EdgeCleanupConfig = Field(default_factory=EdgeCleanupConfig)
    weight_normalization: WeightNormalizationConfig = Field(default_factory=WeightNormalizationConfig)
    color: ColorConfig = Field(default_factory=ColorConfig)
    stroke: StrokeConfig = Field(default_factory=StrokeConfig)
    mask: MaskConfig = Field(default_factory=MaskConfig)
    fill: FillConfig = Field(default_factory=FillConfig)
    shadow: ShadowConfig = Field(default_factory=ShadowConfig)
    padding: PaddingConfig = Field(default_factory=PaddingConfig)
    output: OutputConfig = Field(default_factory=OutputConfig)



class Job(BaseModel):
    id: str = Field(default_factory=_new_id)
    type: str  # "generation" | "processing" | "export"
    status: JobStatus = JobStatus.PENDING
    progress: float = 0.0
    result: Optional[str] = None
    error: Optional[str] = None


# --- UX Redesign Models ---


class IconStyle(str, Enum):
    SOLID = "solid"
    OUTLINE = "outline"
    COLOR = "color"
    FLAT = "flat"
    STICKER = "sticker"


class QualityMode(str, Enum):
    HQ = "hq"
    NORMAL = "normal"


class PostProcessingSettings(BaseModel):
    stroke: StrokeConfig = Field(default_factory=StrokeConfig)
    mask: MaskConfig = Field(default_factory=MaskConfig)
    fill: FillConfig = Field(default_factory=FillConfig)
    shadow: ShadowConfig = Field(default_factory=ShadowConfig)
    padding: PaddingConfig = Field(default_factory=lambda: PaddingConfig(percent=10.0))


class SavedIcon(BaseModel):
    id: str = Field(default_factory=_new_id)
    name: str
    prompt: str
    source_path: str
    preview_path: str = ""
    style: IconStyle = IconStyle.SOLID
    created_at: str = Field(default_factory=lambda: datetime.datetime.utcnow().isoformat())


class GenerationVariation(BaseModel):
    index: int
    source_path: str
    preview_path: str
    picked: bool = False


class GenerationRecord(BaseModel):
    id: str = Field(default_factory=_new_id)
    project_id: str
    name: str
    prompt: str
    style: IconStyle = IconStyle.SOLID
    quality: QualityMode = QualityMode.NORMAL
    model: str = ""
    api_quality: str = ""
    variations: list[GenerationVariation] = Field(default_factory=list)
    original_count: int = 0  # number of raw API response images saved for debug
    bg_removal_applied: bool = False
    bg_removal_aggressiveness: int = 50
    created_at: str = Field(default_factory=lambda: datetime.datetime.utcnow().isoformat())


class Project(BaseModel):
    id: str = Field(default_factory=_new_id)
    name: str
    post_processing: PostProcessingSettings = Field(default_factory=PostProcessingSettings)
    style_preference: IconStyle = IconStyle.SOLID
    quality_preference: QualityMode = QualityMode.NORMAL
    icons: list[SavedIcon] = Field(default_factory=list)
