"""Image provider abstract base class."""
from __future__ import annotations
from abc import ABC, abstractmethod
from PIL import Image
from pydantic import BaseModel
from needicons.core.models import GenerationMode, IconStyle


class GenerationConfig(BaseModel):
    style_prompt: str
    subject: str
    description: str = ""
    mode: GenerationMode = GenerationMode.PRECISION
    style: IconStyle = IconStyle.SOLID
    model: str = ""
    size: str = "1024x1024"


class ImageProvider(ABC):
    @abstractmethod
    async def generate(self, config: GenerationConfig) -> list[Image.Image]:
        """Generate images based on config. Returns list of RGBA PIL Images."""
        ...
