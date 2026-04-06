"""Pipeline step abstract base class."""
from __future__ import annotations

from abc import ABC, abstractmethod
from PIL import Image


class PipelineStep(ABC):
    """Base class for all image processing pipeline steps.

    Each step takes an RGBA image + config dict, returns a processed RGBA image.
    """
    name: str

    @abstractmethod
    def process(self, image: Image.Image, config: dict) -> Image.Image:
        """Process the image according to config. Returns new image."""
        ...

    def can_skip(self, image: Image.Image, config: dict) -> bool:
        """Return True if this step should be skipped for the given image/config."""
        return not config.get("enabled", True)
