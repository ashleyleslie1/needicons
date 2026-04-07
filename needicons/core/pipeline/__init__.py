"""NeedIcons processing pipeline — all steps and runner."""
from needicons.core.pipeline.base import PipelineStep
from needicons.core.pipeline.runner import PipelineRunner
from needicons.core.pipeline.background import BackgroundRemovalStep
from needicons.core.pipeline.edges import EdgeCleanupStep
from needicons.core.pipeline.detection import detect_icons
from needicons.core.pipeline.normalize import WeightNormalizationStep, CenteringStep
from needicons.core.pipeline.color import ColorProcessingStep
from needicons.core.pipeline.stroke import StrokeStep
from needicons.core.pipeline.mask import ShapeMaskStep
from needicons.core.pipeline.fill import BackgroundFillStep
from needicons.core.pipeline.shadow import DropShadowStep
from needicons.core.pipeline.resize import ResizeStep, resize_multi
from needicons.core.pipeline.lasso import refine_mask, apply_lasso_masks, get_available_strategies


def build_default_pipeline() -> PipelineRunner:
    """Build the default processing pipeline with all steps in order."""
    return PipelineRunner(steps=[
        BackgroundRemovalStep(),
        EdgeCleanupStep(),
        WeightNormalizationStep(),
        CenteringStep(),
        ColorProcessingStep(),
        StrokeStep(),
        ShapeMaskStep(),
        BackgroundFillStep(),
        DropShadowStep(),
        ResizeStep(),
    ])


__all__ = [
    "PipelineStep",
    "PipelineRunner",
    "BackgroundRemovalStep",
    "EdgeCleanupStep",
    "detect_icons",
    "WeightNormalizationStep",
    "CenteringStep",
    "ColorProcessingStep",
    "StrokeStep",
    "ShapeMaskStep",
    "BackgroundFillStep",
    "DropShadowStep",
    "ResizeStep",
    "resize_multi",
    "build_default_pipeline",
    "refine_mask",
    "apply_lasso_masks",
    "get_available_strategies",
]
