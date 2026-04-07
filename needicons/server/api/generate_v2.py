"""Generation API v2 — style-aware, batch, HQ/Normal modes with persistent background jobs."""
from __future__ import annotations
import asyncio
import io
import json
from fastapi import APIRouter, Request, HTTPException
from fastapi.responses import StreamingResponse
from PIL import Image
from needicons.core.models import (
    GenerationMode, IconStyle, QualityMode,
    GenerationRecord, GenerationVariation, SavedIcon, _new_id,
)
from needicons.core.providers.base import GenerationConfig
from needicons.core.providers.openai import OpenAIProvider
from needicons.core.pipeline.detection import detect_icons
from needicons.core.pipeline.normalize import CenteringStep, WeightNormalizationStep
from needicons.core.pipeline.background import BackgroundRemovalStep, cleanup_background_residue, remove_background
from needicons.core.pipeline.denoise import DenoiseStep
from needicons.core.pipeline.color import ColorProcessingStep
from needicons.core.pipeline.edges import EdgeCleanupStep
from needicons.core.pipeline.upscale import UpscaleStep
from needicons.core.pipeline.lasso import apply_lasso_masks, get_available_strategies, refine_mask
from needicons.server.api.settings import get_api_key
from needicons.core.prompt_enhance import enhance_prompt

router = APIRouter(tags=["generate_v2"])


def _save_image(state, image: Image.Image, path: str) -> None:
    buf = io.BytesIO()
    image.save(buf, format="PNG")
    state.data_dir.joinpath(path).parent.mkdir(parents=True, exist_ok=True)
    with open(state.data_dir / path, "wb") as f:
        f.write(buf.getvalue())


def _make_preview(image: Image.Image, gpu_provider: str = "auto") -> Image.Image:
    bg = BackgroundRemovalStep()
    if not bg.can_skip(image, {"enabled": True}):
        image = bg.process(image, {
            "model": "isnet-general-use",
            "alpha_matting": True,
            "alpha_matting_foreground_threshold": 240,
            "alpha_matting_background_threshold": 20,
            "gpu_provider": gpu_provider,
        })
        # Clean up near-white residual pixels that rembg sometimes leaves
        image = cleanup_background_residue(image)
    # Normalize size so all icons fill ~80% of the preview canvas uniformly
    wn = WeightNormalizationStep()
    image = wn.process(image, {"enabled": True, "target_fill": 0.80})
    centering = CenteringStep()
    image = centering.process(image, {})
    return image.resize((256, 256), Image.LANCZOS)


async def _generate_hq(provider, name, prompt, style, style_prompt, api_quality="", mood=""):
    images = []
    for _ in range(4):
        config = GenerationConfig(
            style_prompt=style_prompt, subject=name,
            description=prompt if prompt != name else "",
            mode=GenerationMode.PRECISION, style=style, api_quality=api_quality, mood=mood,
        )
        result = await provider.generate(config)
        images.extend(result)
    return images, images


async def _generate_normal(provider, name, prompt, style, style_prompt, api_quality="", mood=""):
    config = GenerationConfig(
        style_prompt=style_prompt, subject=name,
        description=prompt if prompt != name else "",
        mode=GenerationMode.ECONOMY, style=style, api_quality=api_quality, mood=mood,
    )
    raw_images = await provider.generate(config)
    if len(raw_images) >= 4:
        return raw_images[:4], raw_images
    # Single composite image (e.g. DALL-E 2x2 grid).
    # Split into quadrants first, then remove background per icon.
    # This is more reliable than running rembg on the full composite
    # (which treats 4 icons as one scene and produces bad masks).
    all_icons = []
    for img in raw_images:
        icons = detect_icons(img)
        all_icons.extend(icons)
    return all_icons[:4], raw_images


def _emit(job: dict, event_type: str, data: dict):
    """Append an SSE event to a job's event list (in-memory only)."""
    job["events"].append({"type": event_type, **data})


async def _run_generation(state, job: dict):
    """Background task: generate icons and emit events. Skips already-completed prompts."""
    params = job["params"]
    prompts = params["prompts"]
    style = IconStyle(params["style"])
    quality = QualityMode(params["quality"])
    project_id = params.get("project_id", "")
    default_model = params["model"]
    api_quality = params.get("api_quality", "")
    mood = params.get("mood", "")
    ai_enhance = params.get("ai_enhance", False)
    style_prompt = ""
    completed_idx = job.get("completed_idx", -1)
    gpu_provider = state.config.get("gpu", {}).get("provider", "auto")

    api_key = get_api_key(state)
    if not api_key:
        _emit(job, "error", {"message": "No API key configured"})
        job["status"] = "failed"
        await asyncio.sleep(5)
        state.jobs.pop(job["id"], None)
        state.save_jobs()
        return

    provider = OpenAIProvider(api_key=api_key, default_model=default_model)
    total = len(prompts)

    for idx, item in enumerate(prompts):
        # Skip already completed prompts (for resume)
        if idx <= completed_idx:
            continue

        name = item["name"]
        prompt = item.get("prompt", name)

        _emit(job, "progress", {"index": idx, "total": total, "name": name, "status": "generating"})

        if ai_enhance and api_key:
            try:
                enhanced = await enhance_prompt(
                    subject=item["name"],
                    description=item.get("prompt", ""),
                    style=style.value,
                    mood=mood,
                    style_prompt=style_prompt,
                    api_key=api_key,
                )
                if enhanced:
                    item["prompt"] = enhanced
                    prompt = enhanced
            except Exception:
                pass  # Fall back to static prompt on failure

        record = GenerationRecord(
            project_id=project_id, name=name, prompt=prompt,
            style=style, quality=quality, model=default_model, api_quality=api_quality,
            mood=mood, ai_enhance=ai_enhance,
        )

        try:
            if quality == QualityMode.HQ:
                images, raw_images = await _generate_hq(provider, name, prompt, style, style_prompt, api_quality=api_quality, mood=mood)
            else:
                images, raw_images = await _generate_normal(provider, name, prompt, style, style_prompt, api_quality=api_quality, mood=mood)
        except Exception as e:
            msg = str(e)
            if "401" in msg or "auth" in msg.lower() or "api key" in msg.lower():
                _emit(job, "error", {"message": "Invalid API key. Check your key in Settings."})
                job["status"] = "failed"
                await asyncio.sleep(5)
                state.jobs.pop(job["id"], None)
                state.save_jobs()
                return
            _emit(job, "error", {"message": f"Generation failed: {msg[:200]}", "name": name})
            job["completed_idx"] = idx
            state.save_jobs()
            continue

        _emit(job, "progress", {"index": idx, "total": total, "name": name, "status": "processing"})

        # Save original API response for debug
        for ri, raw_img in enumerate(raw_images):
            raw_path = f"images/{record.id}/original/r{ri}.png"
            _save_image(state, raw_img, raw_path)
        record.original_count = len(raw_images)

        for i, img in enumerate(images):
            source_path = f"images/{record.id}/raw/v{i}.png"
            preview_path = f"images/{record.id}/preview/v{i}.png"
            _save_image(state, img, source_path)
            preview = _make_preview(img, gpu_provider)
            _save_image(state, preview, preview_path)
            record.variations.append(GenerationVariation(
                index=i, source_path=source_path, preview_path=preview_path,
            ))

        state.generation_records[record.id] = record
        job["completed_idx"] = idx
        state.save_data()

        _emit(job, "record", record.model_dump(mode="json"))

    _emit(job, "done", {"total": total})
    job["status"] = "completed"
    # Clean up after a short delay (let SSE clients read final events)
    await asyncio.sleep(5)
    state.jobs.pop(job["id"], None)
    state.save_jobs()


def resume_jobs(state):
    """Resume any jobs that were interrupted (called on app startup)."""
    for job in state.jobs.values():
        if job.get("status") == "resumable":
            job["status"] = "running"
            asyncio.create_task(_run_generation(state, job))


def _reprocess_variation(original: Image.Image, record, gpu_provider: str = "auto") -> Image.Image:
    """Chain all active tools in fixed order from the original image."""
    img = original.copy()

    # 1. BG Removal
    if record.bg_removal_level > 0:
        img = remove_background(img, record.bg_removal_level, gpu_provider)

    # 1.5 Lasso Masks
    if record.lasso_masks:
        w, h = img.size
        masks_data = []
        for lm in record.lasso_masks:
            pixel_polygon = [(int(x * w), int(y * h)) for x, y in lm.polygon]
            masks_data.append({
                "polygon": pixel_polygon,
                "mode": lm.mode,
                "strategy": lm.strategy,
            })
        img = apply_lasso_masks(img, masks_data)

    # 2. Denoise
    if record.denoise_strength > 0:
        step = DenoiseStep()
        img = step.process(img, {"strength": record.denoise_strength})

    # 3. Color Adjust
    if record.color_brightness != 0 or record.color_contrast != 0 or record.color_saturation != 0:
        step = ColorProcessingStep()
        img = step.process(img, {
            "brightness": record.color_brightness,
            "contrast": record.color_contrast,
            "saturation": record.color_saturation,
        })

    # 4. Edge Cleanup
    if record.edge_feather > 0:
        step = EdgeCleanupStep()
        img = step.process(img, {"enabled": True, "feather_radius": record.edge_feather, "defringe": True})

    # 5. Upscale
    if record.upscale_factor > 1:
        step = UpscaleStep()
        img = step.process(img, {"factor": record.upscale_factor})

    return img


def _ensure_originals_saved(state, record):
    """Save originals if not already saved."""
    for variation in record.variations:
        original_path = f"images/{record.id}/original/r{variation.index}.png"
        full_original = state.data_dir / original_path
        if not full_original.exists():
            raw_path = state.data_dir / variation.source_path
            if raw_path.exists():
                full_original.parent.mkdir(parents=True, exist_ok=True)
                import shutil
                shutil.copy2(raw_path, full_original)


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
    api_quality = body.get("api_quality", "")
    mood = body.get("mood", "")
    ai_enhance = body.get("ai_enhance", False)

    api_key = get_api_key(state)
    if not api_key:
        raise HTTPException(status_code=400, detail="No API key configured")

    provider_config = state.config.get("provider", {})
    default_model = provider_config.get("default_model", "dall-e-3")

    if project_id:
        project = state.projects[project_id]
        project.style_preference = style
        project.quality_preference = quality

    valid_prompts = [p for p in prompts if p.get("name")]

    job_id = _new_id()
    job = {
        "id": job_id,
        "status": "running",
        "project_id": project_id,
        "params": {
            "prompts": valid_prompts,
            "style": style.value,
            "quality": quality.value,
            "model": default_model,
            "project_id": project_id,
            "api_quality": api_quality,
            "mood": mood,
            "ai_enhance": ai_enhance,
        },
        "completed_idx": -1,
        "events": [],
    }
    state.jobs[job_id] = job
    state.save_jobs()

    asyncio.create_task(_run_generation(state, job))

    return {"job_id": job_id, "total": len(valid_prompts)}


@router.get("/api/generate/jobs/{job_id}/stream")
async def stream_generation(job_id: str, request: Request):
    """SSE stream for a generation job. Reconnectable — replays all past events then streams new ones."""
    state = request.app.state.app_state
    job = state.jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    async def event_stream():
        last_idx = 0
        while True:
            if await request.is_disconnected():
                break
            events = job["events"]
            if len(events) > last_idx:
                for event in events[last_idx:]:
                    event_type = event.get("type", "message")
                    yield f"event: {event_type}\ndata: {json.dumps(event)}\n\n"
                last_idx = len(events)
            if job["status"] in ("completed", "failed"):
                break
            await asyncio.sleep(0.3)

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@router.get("/api/generate/active")
async def get_active_jobs(request: Request):
    """Return any running/resumable generation jobs."""
    state = request.app.state.app_state
    active = [
        {"job_id": j["id"], "project_id": j.get("project_id"), "status": j["status"]}
        for j in state.jobs.values()
        if j.get("status") in ("running", "resumable")
    ]
    return active


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


@router.post("/api/generations/{gen_id}/unpick")
async def unpick_variation(gen_id: str, request: Request):
    state = request.app.state.app_state
    record = state.generation_records.get(gen_id)
    if not record:
        raise HTTPException(status_code=404, detail="Generation record not found")

    for v in record.variations:
        v.picked = False

    if record.project_id:
        project = state.projects.get(record.project_id)
        if project:
            project.icons = [i for i in project.icons if not i.source_path.startswith(f"images/{record.id}/")]

    state.save_data()
    return record.model_dump()


@router.delete("/api/generations/{gen_id}")
async def delete_generation(gen_id: str, request: Request):
    state = request.app.state.app_state
    record = state.generation_records.get(gen_id)
    if not record:
        raise HTTPException(status_code=404, detail="Generation record not found")

    if record.project_id:
        project = state.projects.get(record.project_id)
        if project:
            project.icons = [i for i in project.icons if not i.source_path.startswith(f"images/{record.id}/")]

    del state.generation_records[gen_id]
    state.save_data()
    return {"status": "deleted"}


@router.post("/api/generations/{gen_id}/remove-bg")
async def remove_generation_bg(gen_id: str, request: Request):
    """Apply or remove background removal. level 0=restore, 1-10=process. request_id for staleness."""
    state = request.app.state.app_state
    record = state.generation_records.get(gen_id)
    if not record:
        raise HTTPException(status_code=404, detail="Generation record not found")

    body = await request.json()
    level = max(0, min(10, body.get("level", 5)))
    request_id = body.get("request_id", "")
    gpu_provider = state.config.get("gpu", {}).get("provider", "auto")

    # Store request_id so we can detect stale requests
    if request_id:
        record.bg_removal_request_id = request_id
        state.save_data()

    if level == 0:
        from needicons.core.pipeline.normalize import CenteringStep, WeightNormalizationStep
        for variation in record.variations:
            original_path = f"images/{record.id}/original/r{variation.index}.png"
            full_original = state.data_dir / original_path
            if full_original.exists():
                raw_img = Image.open(full_original).convert("RGBA")
                _save_image(state, raw_img, variation.source_path)
                wn = WeightNormalizationStep()
                preview = wn.process(raw_img, {"enabled": True, "target_fill": 0.80})
                centering = CenteringStep()
                preview = centering.process(preview, {})
                preview = preview.resize((256, 256), Image.LANCZOS)
                _save_image(state, preview, variation.preview_path)
        record.bg_removal_level = 0
        state.save_data()
        return record.model_dump()

    loop = asyncio.get_event_loop()
    for variation in record.variations:
        if request_id and record.bg_removal_request_id != request_id:
            return record.model_dump()

        raw_path = state.data_dir / variation.source_path
        if not raw_path.exists():
            continue

        original_path = f"images/{record.id}/original/r{variation.index}.png"
        full_original = state.data_dir / original_path
        if full_original.exists():
            raw_img = Image.open(full_original).convert("RGBA")
        else:
            raw_img = Image.open(raw_path).convert("RGBA")

        processed = await loop.run_in_executor(
            None, remove_background, raw_img, level, gpu_provider
        )

        if request_id and record.bg_removal_request_id != request_id:
            return record.model_dump()

        _save_image(state, processed, variation.source_path)

        from needicons.core.pipeline.normalize import CenteringStep, WeightNormalizationStep
        wn = WeightNormalizationStep()
        processed = wn.process(processed, {"enabled": True, "target_fill": 0.80})
        centering = CenteringStep()
        preview = centering.process(processed, {})
        preview = preview.resize((256, 256), Image.LANCZOS)
        _save_image(state, preview, variation.preview_path)

    record.bg_removal_level = level
    state.save_data()
    return record.model_dump()


@router.post("/api/generations/{gen_id}/color-adjust")
async def color_adjust_generation(gen_id: str, request: Request):
    state = request.app.state.app_state
    record = state.generation_records.get(gen_id)
    if not record:
        raise HTTPException(status_code=404, detail="Generation record not found")

    body = await request.json()
    request_id = body.get("request_id", "")
    record.color_brightness = max(-100, min(100, body.get("brightness", 0)))
    record.color_contrast = max(-100, min(100, body.get("contrast", 0)))
    record.color_saturation = max(-100, min(100, body.get("saturation", 0)))

    gpu_provider = state.config.get("gpu", {}).get("provider", "auto")
    _ensure_originals_saved(state, record)

    loop = asyncio.get_event_loop()
    for variation in record.variations:
        original_path = f"images/{record.id}/original/r{variation.index}.png"
        full_original = state.data_dir / original_path
        if not full_original.exists():
            continue
        original = Image.open(full_original).convert("RGBA")
        processed = await loop.run_in_executor(None, _reprocess_variation, original, record, gpu_provider)
        _save_image(state, processed, variation.source_path)
        wn = WeightNormalizationStep()
        preview = wn.process(processed, {"enabled": True, "target_fill": 0.80})
        centering = CenteringStep()
        preview = centering.process(preview, {})
        preview = preview.resize((256, 256), Image.LANCZOS)
        _save_image(state, preview, variation.preview_path)

    state.save_data()
    return record.model_dump()


@router.post("/api/generations/{gen_id}/edge-cleanup")
async def edge_cleanup_generation(gen_id: str, request: Request):
    state = request.app.state.app_state
    record = state.generation_records.get(gen_id)
    if not record:
        raise HTTPException(status_code=404, detail="Generation record not found")

    body = await request.json()
    record.edge_feather = max(0, min(10, body.get("feather", 0)))

    gpu_provider = state.config.get("gpu", {}).get("provider", "auto")
    _ensure_originals_saved(state, record)

    loop = asyncio.get_event_loop()
    for variation in record.variations:
        original_path = f"images/{record.id}/original/r{variation.index}.png"
        full_original = state.data_dir / original_path
        if not full_original.exists():
            continue
        original = Image.open(full_original).convert("RGBA")
        processed = await loop.run_in_executor(None, _reprocess_variation, original, record, gpu_provider)
        _save_image(state, processed, variation.source_path)
        wn = WeightNormalizationStep()
        preview = wn.process(processed, {"enabled": True, "target_fill": 0.80})
        centering = CenteringStep()
        preview = centering.process(preview, {})
        preview = preview.resize((256, 256), Image.LANCZOS)
        _save_image(state, preview, variation.preview_path)

    state.save_data()
    return record.model_dump()


@router.post("/api/generations/{gen_id}/upscale")
async def upscale_generation(gen_id: str, request: Request):
    state = request.app.state.app_state
    record = state.generation_records.get(gen_id)
    if not record:
        raise HTTPException(status_code=404, detail="Generation record not found")

    body = await request.json()
    factor = body.get("factor", 2)
    if factor not in (2, 4):
        factor = 2
    record.upscale_factor = factor

    gpu_provider = state.config.get("gpu", {}).get("provider", "auto")
    _ensure_originals_saved(state, record)

    loop = asyncio.get_event_loop()
    for variation in record.variations:
        original_path = f"images/{record.id}/original/r{variation.index}.png"
        full_original = state.data_dir / original_path
        if not full_original.exists():
            continue
        original = Image.open(full_original).convert("RGBA")
        processed = await loop.run_in_executor(None, _reprocess_variation, original, record, gpu_provider)
        _save_image(state, processed, variation.source_path)
        wn = WeightNormalizationStep()
        preview = wn.process(processed, {"enabled": True, "target_fill": 0.80})
        centering = CenteringStep()
        preview = centering.process(preview, {})
        preview = preview.resize((256, 256), Image.LANCZOS)
        _save_image(state, preview, variation.preview_path)

    state.save_data()
    return record.model_dump()


@router.post("/api/generations/{gen_id}/denoise")
async def denoise_generation(gen_id: str, request: Request):
    state = request.app.state.app_state
    record = state.generation_records.get(gen_id)
    if not record:
        raise HTTPException(status_code=404, detail="Generation record not found")

    body = await request.json()
    record.denoise_strength = max(0, min(10, body.get("strength", 0)))

    gpu_provider = state.config.get("gpu", {}).get("provider", "auto")
    _ensure_originals_saved(state, record)

    loop = asyncio.get_event_loop()
    for variation in record.variations:
        original_path = f"images/{record.id}/original/r{variation.index}.png"
        full_original = state.data_dir / original_path
        if not full_original.exists():
            continue
        original = Image.open(full_original).convert("RGBA")
        processed = await loop.run_in_executor(None, _reprocess_variation, original, record, gpu_provider)
        _save_image(state, processed, variation.source_path)
        wn = WeightNormalizationStep()
        preview = wn.process(processed, {"enabled": True, "target_fill": 0.80})
        centering = CenteringStep()
        preview = centering.process(preview, {})
        preview = preview.resize((256, 256), Image.LANCZOS)
        _save_image(state, preview, variation.preview_path)

    state.save_data()
    return record.model_dump()
