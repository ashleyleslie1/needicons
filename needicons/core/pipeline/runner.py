"""Pipeline runner — executes steps in configured order."""
from __future__ import annotations

from PIL import Image

from needicons.core.pipeline.base import PipelineStep


class PipelineRunner:
    """Runs a sequence of PipelineSteps on an image."""

    def __init__(self, steps: list[PipelineStep]):
        self._steps = steps

    @property
    def step_names(self) -> list[str]:
        return [s.name for s in self._steps]

    def run(self, image: Image.Image, configs: dict[str, dict]) -> Image.Image:
        """Execute all steps on the image.

        Args:
            image: Input image (any mode, converted to RGBA).
            configs: Dict mapping step name -> config dict for that step.

        Returns:
            Processed RGBA image.
        """
        if image.mode != "RGBA":
            image = image.convert("RGBA")

        for step in self._steps:
            config = configs.get(step.name, {})
            if step.can_skip(image, config):
                continue
            image = step.process(image, config)

        return image
