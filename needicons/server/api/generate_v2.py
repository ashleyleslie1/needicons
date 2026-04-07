"""Generation API v2 — style-aware, batch, HQ/Normal modes."""
from __future__ import annotations
import io
from fastapi import APIRouter, Request, HTTPException
from PIL import Image
from needicons.core.models import (
    GenerationMode, IconStyle, QualityMode,
    GenerationRecord, GenerationVariation, SavedIcon,
)
from needicons.core.providers.base import GenerationConfig
from needicons.core.providers.openai import OpenAIProvider
from needicons.core.pipeline.detection import detect_icons
from needicons.core.pipeline.normalize import CenteringStep
from needicons.core.pipeline.background import BackgroundRemovalStep

router = APIRouter(tags=["generate_v2"])


def _save_image(image: Image.Image, path: str, state) -> None:
    buf = io.BytesIO()
    image.save(buf, format="PNG")
    state.data_dir.joinpath(path).parent.mkdir(parents=True, exist_ok=True)
    with open(state.data_dir / path, "wb") as f:
        f.write(buf.getvalue())


def _make_preview(image: Image.Image) -> Image.Image:
    bg = BackgroundRemovalStep()
    if not bg.can_skip(image, {"enabled": True}):
        image = bg.process(image, {"model": "u2net", "alpha_matting": False})
    centering = CenteringStep()
    image = centering.process(image, {})
    return image.resize((256, 256), Image.LANCZOS)


async def _generate_hq(provider, name, prompt, style, style_prompt):
    """HQ: 4 separate API calls, each producing 1 icon = 4 variations."""
    images = []
    for _ in range(4):
        config = GenerationConfig(
            style_prompt=style_prompt, subject=name,
            description=prompt if prompt != name else "",
            mode=GenerationMode.PRECISION, style=style,
        )
        result = await provider.generate(config)
        images.extend(result)
    return images


async def _generate_normal(provider, name, prompt, style, style_prompt):
    """Normal: 1 API call with 2x2 grid, auto-split into 4 variations."""
    config = GenerationConfig(
        style_prompt=style_prompt, subject=name,
        description=prompt if prompt != name else "",
        mode=GenerationMode.ECONOMY, style=style,
    )
    raw_images = await provider.generate(config)
    all_icons = []
    for img in raw_images:
        icons = detect_icons(img)
        all_icons.extend(icons)
    return all_icons[:4]


@router.post("/api/generate")
async def generate_icons(request: Request):
    state = request.app.state.app_state
    body = await request.json()

    project_id = body.get("project_id")
    if project_id and project_id not in state.projects:
        raise HTTPException(status_code=404, detail="Project not found")

    prompts = body.get("prompts", [])
    if not prompts:
        raise HTTPException(status_code=400, detail="No prompts provided")

    style = IconStyle(body.get("style", "solid"))
    quality = QualityMode(body.get("quality", "normal"))

    provider_config = state.config.get("provider", {})
    api_key = provider_config.get("api_key", "")
    if not api_key:
        raise HTTPException(status_code=400, detail="No API key configured")

    default_model = provider_config.get("default_model", "dall-e-3")
    provider = OpenAIProvider(api_key=api_key, default_model=default_model)
    style_prompt = ""

    if project_id:
        project = state.projects[project_id]
        project.style_preference = style
        project.quality_preference = quality

    records = []
    for item in prompts:
        name = item.get("name", "")
        prompt = item.get("prompt", name)
        if not name:
            continue

        record = GenerationRecord(
            project_id=project_id or "", name=name, prompt=prompt,
            style=style, quality=quality,
        )

        try:
            if quality == QualityMode.HQ:
                images = await _generate_hq(provider, name, prompt, style, style_prompt)
            else:
                images = await _generate_normal(provider, name, prompt, style, style_prompt)
        except Exception as e:
            msg = str(e)
            if "401" in msg or "auth" in msg.lower() or "api key" in msg.lower():
                raise HTTPException(status_code=401, detail="Invalid API key. Check your key in Settings.")
            raise HTTPException(status_code=502, detail=f"Generation failed: {msg[:200]}")

        for i, img in enumerate(images):
            source_path = f"images/{record.id}/raw/v{i}.png"
            preview_path = f"images/{record.id}/preview/v{i}.png"
            _save_image(img, source_path, state)
            preview = _make_preview(img)
            _save_image(preview, preview_path, state)
            record.variations.append(GenerationVariation(
                index=i, source_path=source_path, preview_path=preview_path,
            ))

        state.generation_records[record.id] = record
        records.append(record.model_dump())

    state.save_data()
    return records


@router.post("/api/generations/{gen_id}/pick/{variation_index}")
async def pick_variation(gen_id: str, variation_index: int, request: Request):
    state = request.app.state.app_state
    record = state.generation_records.get(gen_id)
    if not record:
        raise HTTPException(status_code=404, detail="Generation record not found")

    variation = None
    for v in record.variations:
        if v.index == variation_index:
            variation = v
            break
    if not variation:
        raise HTTPException(status_code=404, detail="Variation not found")

    for v in record.variations:
        v.picked = False
    variation.picked = True

    if record.project_id:
        project = state.projects.get(record.project_id)
        if project:
            project.icons = [i for i in project.icons if not i.source_path.startswith(f"images/{record.id}/")]
            icon = SavedIcon(
                name=record.name, prompt=record.prompt,
                source_path=variation.source_path,
                preview_path=variation.preview_path,
                style=record.style,
            )
            project.icons.append(icon)

    state.save_data()
    return record.model_dump()
