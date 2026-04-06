"""Generation API endpoints."""
from __future__ import annotations
import io
from fastapi import APIRouter, Request, HTTPException
from PIL import Image
from needicons.core.models import GenerationMode, RequirementStatus, Candidate
from needicons.core.providers.base import GenerationConfig
from needicons.core.providers.openai import OpenAIProvider
from needicons.core.pipeline.detection import detect_icons
from needicons.core.pipeline.normalize import CenteringStep
from needicons.core.pipeline.background import BackgroundRemovalStep

router = APIRouter(tags=["generation"])


async def _generate_for_requirement(
    provider: OpenAIProvider,
    style_prompt: str,
    name: str,
    description: str,
    mode: GenerationMode,
) -> list[Image.Image]:
    config = GenerationConfig(
        style_prompt=style_prompt,
        subject=name,
        description=description or "",
        mode=mode,
    )
    raw_images = await provider.generate(config)

    all_icons = []
    for img in raw_images:
        if mode == GenerationMode.ECONOMY:
            icons = detect_icons(img)
            all_icons.extend(icons)
        else:
            all_icons.append(img)
    return all_icons


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


@router.post("/api/requirements/{req_id}/generate")
async def generate_for_requirement(req_id: str, request: Request):
    state = request.app.state.app_state
    body = await request.json()
    mode = GenerationMode(body.get("mode", "precision"))

    target_req = None
    target_pack = None
    for pack in state.packs.values():
        for req in pack.requirements:
            if req.id == req_id:
                target_req = req
                target_pack = pack
                break

    if not target_req:
        raise HTTPException(status_code=404, detail="Requirement not found")

    provider_config = state.config.get("provider", {})
    api_key = provider_config.get("api_key", "")
    if not api_key:
        raise HTTPException(status_code=400, detail="No API key configured")

    provider = OpenAIProvider(api_key=api_key)
    images = await _generate_for_requirement(
        provider=provider,
        style_prompt=target_pack.style_prompt,
        name=target_req.name,
        description=target_req.description or "",
        mode=mode,
    )

    for i, img in enumerate(images):
        origin = "single" if mode == GenerationMode.PRECISION else f"grid_{i}"
        source_path = f"images/{target_req.id}/raw/{origin}.png"
        preview_path = f"images/{target_req.id}/preview/{origin}.png"
        _save_image(img, source_path, state)
        preview = _make_preview(img)
        _save_image(preview, preview_path, state)

        candidate = Candidate(
            requirement_id=req_id,
            source_path=source_path,
            preview_path=preview_path,
            origin=origin,
        )
        target_req.candidates.append(candidate)

    target_req.status = RequirementStatus.GENERATED
    state.save_data()
    return target_req.model_dump()
