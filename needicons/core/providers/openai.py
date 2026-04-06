"""OpenAI image generation provider (GPT-4o + DALL-E 3)."""
from __future__ import annotations
import base64
import io
from openai import AsyncOpenAI
from PIL import Image
from needicons.core.models import GenerationMode
from needicons.core.providers.base import GenerationConfig, ImageProvider


_SYSTEM_PREFIX = (
    "You are generating icons for a consistent icon pack. "
    "The icon should have a clean, simple background for easy removal. "
    "Do not add text, labels, or watermarks."
)


def _build_prompt(config: GenerationConfig) -> str:
    parts = [_SYSTEM_PREFIX]
    if config.style_prompt:
        parts.append(f"Style guide: {config.style_prompt}")

    subject = config.subject
    if config.description:
        subject = f"{config.subject}: {config.description}"

    if config.mode == GenerationMode.PRECISION:
        parts.append(
            f"Generate exactly ONE icon of: {subject}. "
            "Single isolated object, centered on the canvas. "
            "Do not generate multiple icons or a grid."
        )
    else:
        parts.append(
            f"Generate exactly FOUR distinct icons of: {subject} "
            "arranged in a 2x2 grid. Each should be a distinct variation."
        )

    return "\n".join(parts)


class OpenAIProvider(ImageProvider):
    def __init__(self, api_key: str, default_model: str = "gpt-4o"):
        self._client = AsyncOpenAI(api_key=api_key)
        self._default_model = default_model

    async def generate(self, config: GenerationConfig) -> list[Image.Image]:
        prompt = _build_prompt(config)
        model = config.model or self._default_model

        response = await self._client.images.generate(
            model=model,
            prompt=prompt,
            n=1,
            size=config.size,
            response_format="b64_json",
        )

        images = []
        for item in response.data:
            data = base64.b64decode(item.b64_json)
            img = Image.open(io.BytesIO(data)).convert("RGBA")
            images.append(img)

        return images
