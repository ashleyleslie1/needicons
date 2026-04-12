"""Stability AI image generation provider (SD 3.5 models)."""
from __future__ import annotations
import io
import httpx
from PIL import Image
from needicons.core.providers.base import GenerationConfig, ImageProvider

_API_BASE = "https://api.stability.ai"

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

# Map our style names to Stability style_preset where applicable
_STYLE_PRESET_MAP = {
    "solid": None,
    "outline": "line-art",
    "colorful": "digital-art",
    "flat": None,
    "sticker": "3d-model",
}

STABILITY_MODELS = {
    "sd3.5-flash": {"label": "SD 3.5 Flash", "credits": 2.5},
    "sd3.5-medium": {"label": "SD 3.5 Medium", "credits": 3.5},
    "sd3.5-large-turbo": {"label": "SD 3.5 Large Turbo", "credits": 4},
    "sd3.5-large": {"label": "SD 3.5 Large", "credits": 6.5},
}


def _build_prompt(config: GenerationConfig) -> str:
    parts = [
        "Generate a single icon for an icon pack.",
        "Clean, simple design. No text, labels, or watermarks.",
    ]
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
    parts.append(f"Subject: {subject}. Single isolated object, centered, on a plain white background.")
    return " ".join(parts)


class StabilityProvider(ImageProvider):
    def __init__(self, api_key: str, default_model: str = "sd3.5-flash"):
        self._api_key = api_key
        self._default_model = default_model

    async def generate(self, config: GenerationConfig) -> list[Image.Image]:
        model = config.model or self._default_model
        prompt = _build_prompt(config)
        negative_prompt = "text, words, letters, labels, watermark, signature, blurry, low quality, multiple objects, grid"

        style_preset = _STYLE_PRESET_MAP.get(config.style.value)

        data = {
            "prompt": prompt,
            "negative_prompt": negative_prompt,
            "model": model,
            "output_format": "png",
            "aspect_ratio": "1:1",
        }
        if style_preset:
            data["style_preset"] = style_preset

        async with httpx.AsyncClient(timeout=120) as client:
            resp = await client.post(
                f"{_API_BASE}/v2beta/stable-image/generate/sd3",
                headers={
                    "authorization": f"Bearer {self._api_key}",
                    "accept": "image/*",
                },
                data=data,
                files={"none": ("", b"")},  # Required for multipart/form-data
            )

        if resp.status_code != 200:
            error = resp.text
            try:
                error = resp.json().get("message", resp.text)
            except Exception:
                pass
            raise RuntimeError(f"Stability API error {resp.status_code}: {error}")

        img = Image.open(io.BytesIO(resp.content)).convert("RGBA")
        return [img]

    async def generate_stream(self, config: GenerationConfig):
        """Stability doesn't support streaming — generate and yield final result."""
        images = await self.generate(config)
        if images:
            yield (None, images[0])

    async def remove_background(self, image: Image.Image) -> Image.Image:
        """Remove background using Stability's API endpoint."""
        buf = io.BytesIO()
        image.save(buf, format="PNG")
        buf.seek(0)

        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(
                f"{_API_BASE}/v2beta/stable-image/edit/remove-background",
                headers={
                    "authorization": f"Bearer {self._api_key}",
                    "accept": "image/*",
                },
                files={"image": ("image.png", buf, "image/png")},
                data={"output_format": "png"},
            )

        if resp.status_code != 200:
            error = resp.text
            try:
                error = resp.json().get("message", resp.text)
            except Exception:
                pass
            raise RuntimeError(f"Stability BG removal error {resp.status_code}: {error}")

        return Image.open(io.BytesIO(resp.content)).convert("RGBA")

    async def remove_background_batch(self, images: list[Image.Image]) -> list[Image.Image]:
        """Remove backgrounds from multiple images concurrently."""
        import asyncio
        results = await asyncio.gather(
            *[self.remove_background(img) for img in images],
            return_exceptions=True,
        )
        output = []
        for r in results:
            if isinstance(r, Exception):
                raise r
            output.append(r)
        return output
