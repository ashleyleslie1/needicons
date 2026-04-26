"""OpenRouter image generation provider.

Routes to image-capable chat models on openrouter.ai (OpenAI-compatible API).
Models exposed via this provider are prefixed with ``openrouter/`` in the
NeedIcons model catalog (e.g. ``openrouter/openai/gpt-5-image-mini``); the
prefix is stripped before sending to OpenRouter.
"""
from __future__ import annotations
import asyncio
import base64
import io
import httpx
from PIL import Image
from needicons.core.providers.base import GenerationConfig, ImageProvider

_API_BASE = "https://openrouter.ai/api/v1"
_MODEL_PREFIX = "openrouter/"

OPENROUTER_MODELS = {
    "openrouter/openai/gpt-5.4-image-2": {
        "label": "GPT-5.4 Image 2 (OpenRouter)",
        "description": "Newest OpenAI image model via OpenRouter",
    },
    "openrouter/openai/gpt-5-image": {
        "label": "GPT-5 Image (OpenRouter)",
        "description": "Full-quality OpenAI image model via OpenRouter",
    },
    "openrouter/openai/gpt-5-image-mini": {
        "label": "GPT-5 Image Mini (OpenRouter)",
        "description": "Fast, cheap OpenAI image model via OpenRouter",
    },
}

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


def _build_prompt(config: GenerationConfig) -> str:
    parts = [
        "Generate a single icon for an icon pack.",
        "Transparent background. No text, labels, or watermarks.",
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
    parts.append(f"Subject: {subject}. Single isolated object, centered.")
    return " ".join(parts)


def is_openrouter_model(model: str) -> bool:
    return model.startswith(_MODEL_PREFIX)


def strip_prefix(model: str) -> str:
    return model[len(_MODEL_PREFIX):] if model.startswith(_MODEL_PREFIX) else model


def _decode_image_field(image_url: str) -> Image.Image:
    """Accept either ``data:image/...;base64,...`` data URLs or plain HTTPS URLs."""
    if image_url.startswith("data:"):
        _, _, payload = image_url.partition(",")
        data = base64.b64decode(payload)
        return Image.open(io.BytesIO(data)).convert("RGBA")
    resp = httpx.get(image_url, timeout=60)
    resp.raise_for_status()
    return Image.open(io.BytesIO(resp.content)).convert("RGBA")


class OpenRouterProvider(ImageProvider):
    def __init__(self, api_key: str, default_model: str = "openrouter/openai/gpt-5-image-mini"):
        self._api_key = api_key
        self._default_model = default_model

    async def _one_call(self, model: str, prompt: str) -> Image.Image | None:
        payload = {
            "model": strip_prefix(model),
            "messages": [{"role": "user", "content": prompt}],
            "modalities": ["image", "text"],
        }
        headers = {
            "Authorization": f"Bearer {self._api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://needicons.local",
            "X-Title": "NeedIcons",
        }
        async with httpx.AsyncClient(timeout=180) as client:
            resp = await client.post(
                f"{_API_BASE}/chat/completions",
                headers=headers,
                json=payload,
            )

        if resp.status_code != 200:
            try:
                err = resp.json().get("error", {}).get("message", resp.text)
            except Exception:
                err = resp.text
            raise RuntimeError(f"OpenRouter API error {resp.status_code}: {err}")

        body = resp.json()
        choices = body.get("choices") or []
        if not choices:
            return None
        message = choices[0].get("message", {})
        images = message.get("images") or []
        if not images:
            return None
        first = images[0]
        url = first.get("image_url", {}).get("url") if isinstance(first, dict) else None
        if not url:
            return None
        return _decode_image_field(url)

    async def generate(self, config: GenerationConfig) -> list[Image.Image]:
        model = config.model or self._default_model
        prompt = _build_prompt(config)
        # OpenRouter chat completions don't support n>1 for images, so we issue
        # parallel calls for variation count. The pipeline normally wraps a
        # single call per variation already, but generate() is also used by
        # callers that want a list, so default to 1 image.
        results = await asyncio.gather(
            self._one_call(model, prompt),
            return_exceptions=False,
        )
        return [img for img in results if img is not None]

    async def generate_stream(self, config: GenerationConfig):
        """No partial streaming on the image endpoint — yield the final image only."""
        images = await self.generate(config)
        if images:
            yield (None, images[0])
