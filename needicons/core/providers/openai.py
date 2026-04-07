"""OpenAI image generation provider (DALL-E 3, gpt-image-1.5, gpt-image-1-mini)."""
from __future__ import annotations
import base64
import io
from openai import AsyncOpenAI
from PIL import Image
from needicons.core.models import GenerationMode
from needicons.core.providers.base import GenerationConfig, ImageProvider

# Models that use the newer gpt-image API (transparent bg, output_format, n>1)
_GPT_IMAGE_MODELS = {"gpt-image-1", "gpt-image-1.5", "gpt-image-1-mini"}

_SYSTEM_PREFIX = (
    "You are generating icons for a consistent icon pack. "
    "The icon should have a clean, simple background for easy removal. "
    "Do not add text, labels, or watermarks."
)

_STYLE_PROMPTS = {
    "solid": "Filled, single-color icon. Bold silhouette style, flat fill, no gradients.",
    "outline": "Line-drawn, stroke-only icon. Clean outlines, no fill, uniform stroke weight.",
    "colorful": "Full-color, detailed icon. Rich colors, subtle shading, polished look.",
    "flat": "Minimal flat-design icon. Simple shapes, limited color palette, no shadows or gradients.",
    "sticker": "Sticker-style icon with slight 3D effect. Soft shadow, rounded feel, playful.",
}

_MOOD_PROMPTS = {
    "none": "",
    "cinematic": "Dramatic lighting, film-like depth and atmosphere.",
    "vibrant": "Saturated, energetic, eye-catching colors.",
    "dynamic": "Motion, energy, action-oriented composition.",
    "elegant": "Refined, polished, sophisticated aesthetic.",
    "minimal": "Clean lines, reduced detail, stripped back to essentials.",
}


def _build_single_prompt(config: GenerationConfig) -> str:
    """Prompt for a single icon (used by PRECISION mode and gpt-image ECONOMY)."""
    parts = [_SYSTEM_PREFIX]
    style_desc = _STYLE_PROMPTS.get(config.style.value, _STYLE_PROMPTS["solid"])
    parts.append(f"Style: {style_desc}")
    mood_desc = _MOOD_PROMPTS.get(config.mood, "")
    if mood_desc:
        parts.append(f"Mood: {mood_desc}")
    if config.style_prompt:
        parts.append(f"Additional style guide: {config.style_prompt}")
    subject = config.subject
    if config.description:
        subject = f"{config.subject}: {config.description}"
    parts.append(
        f"Generate exactly ONE icon of: {subject}. "
        "Single isolated object, centered on the canvas. "
        "Do not generate multiple icons or a grid."
    )
    return "\n".join(parts)


def _build_grid_prompt(config: GenerationConfig) -> str:
    """Prompt for a 2x2 grid (DALL-E only, since it doesn't support n>1)."""
    parts = [_SYSTEM_PREFIX]
    style_desc = _STYLE_PROMPTS.get(config.style.value, _STYLE_PROMPTS["solid"])
    parts.append(f"Style: {style_desc}")
    mood_desc = _MOOD_PROMPTS.get(config.mood, "")
    if mood_desc:
        parts.append(f"Mood: {mood_desc}")
    if config.style_prompt:
        parts.append(f"Additional style guide: {config.style_prompt}")
    subject = config.subject
    if config.description:
        subject = f"{config.subject}: {config.description}"
    parts.append(
        f"Generate exactly 4 variations of: {subject}. "
        "Arrange them in a 2x2 grid on a plain white background. "
        "Each cell contains one icon. Do not nest grids."
    )
    return "\n".join(parts)


class OpenAIProvider(ImageProvider):
    def __init__(self, api_key: str, default_model: str = "dall-e-3"):
        self._client = AsyncOpenAI(api_key=api_key)
        self._default_model = default_model

    def _is_gpt_image(self, model: str) -> bool:
        return model in _GPT_IMAGE_MODELS or model.startswith("gpt-image")

    async def generate(self, config: GenerationConfig) -> list[Image.Image]:
        model = config.model or self._default_model

        if self._is_gpt_image(model):
            return await self._generate_gpt_image(model, config)
        else:
            return await self._generate_dalle(model, config)

    async def _generate_dalle(self, model: str, config: GenerationConfig) -> list[Image.Image]:
        """DALL-E 3/2: n=1 only. Uses grid prompt for ECONOMY mode."""
        if config.mode == GenerationMode.ECONOMY:
            prompt = _build_grid_prompt(config)
        else:
            prompt = _build_single_prompt(config)

        kwargs = {
            "model": model,
            "prompt": prompt,
            "n": 1,
            "size": config.size,
            "response_format": "b64_json",
        }
        if config.api_quality:
            kwargs["quality"] = config.api_quality
        response = await self._client.images.generate(**kwargs)
        images = []
        for item in response.data:
            data = base64.b64decode(item.b64_json)
            images.append(Image.open(io.BytesIO(data)).convert("RGBA"))
        return images

    async def _generate_gpt_image(self, model: str, config: GenerationConfig) -> list[Image.Image]:
        """gpt-image-1.5 / gpt-image-1-mini: supports n>1, transparent bg."""
        prompt = _build_single_prompt(config)
        # ECONOMY: 4 images in one call. PRECISION: 1 image per call.
        n = 4 if config.mode == GenerationMode.ECONOMY else 1

        kwargs = {
            "model": model,
            "prompt": prompt,
            "n": n,
            "size": config.size,
            "background": "transparent",
            "output_format": "png",
        }
        if config.api_quality:
            kwargs["quality"] = config.api_quality
        response = await self._client.images.generate(**kwargs)
        images = []
        for item in response.data:
            if item.b64_json:
                data = base64.b64decode(item.b64_json)
                images.append(Image.open(io.BytesIO(data)).convert("RGBA"))
            elif getattr(item, "url", None):
                import httpx
                resp = httpx.get(item.url)
                images.append(Image.open(io.BytesIO(resp.content)).convert("RGBA"))
        return images
