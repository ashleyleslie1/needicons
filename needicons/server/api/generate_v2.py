"""Generation API v2 — style-aware, batch, HQ/Normal modes with persistent background jobs."""
from __future__ import annotations
import asyncio
import io
import json
import logging
from datetime import datetime, timezone
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
from needicons.core.pipeline.lasso import apply_lasso_masks, get_available_strategies, select_at_point
from needicons.server.api.settings import get_api_key
from needicons.core.prompt_enhance import enhance_prompt

router = APIRouter(tags=["generate_v2"])


def _save_image(state, image: Image.Image, path: str) -> None:
    buf = io.BytesIO()
    image.save(buf, format="PNG")
    state.data_dir.joinpath(path).parent.mkdir(parents=True, exist_ok=True)
    with open(state.data_dir / path, "wb") as f:
        f.write(buf.getvalue())


_GPT_IMAGE_MODELS = {"gpt-image-1", "gpt-image-1.5", "gpt-image-1-mini"}
_STABILITY_MODELS = {"sd3.5-flash", "sd3.5-medium", "sd3.5-large-turbo", "sd3.5-large"}


def _is_gpt_image_model(model: str) -> bool:
    return model in _GPT_IMAGE_MODELS or model.startswith("gpt-image")


def _is_stability_model(model: str) -> bool:
    return model in _STABILITY_MODELS or model.startswith("sd3")


def _is_openrouter_model(model: str) -> bool:
    return model.startswith("openrouter/")


def _make_preview(image: Image.Image, gpu_provider: str = "auto", model: str = "") -> Image.Image:
    # GPT Image models already output transparent PNGs — skip BG removal
    if not _is_gpt_image_model(model):
        bg = BackgroundRemovalStep()
        if not bg.can_skip(image, {"enabled": True}):
            image = bg.process(image, {
                "model": "isnet-general-use",
                "alpha_matting": True,
                "alpha_matting_foreground_threshold": 240,
                "alpha_matting_background_threshold": 20,
                "gpu_provider": gpu_provider,
            })
            image = cleanup_background_residue(image)
    # Normalize size so all icons fill ~80% of the preview canvas uniformly
    wn = WeightNormalizationStep()
    image = wn.process(image, {"enabled": True, "target_fill": 0.90})
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


_BATCH_SIZE = 10  # Max concurrent API calls per generation job


async def _generate_one_streaming(provider, config):
    """Generate one icon via streaming, collecting partials. Returns (partials_list, final_image)."""
    partials = []
    final = None
    async for partial_b64, final_img in provider.generate_stream(config):
        if partial_b64 is not None:
            partials.append(partial_b64)
        if final_img is not None:
            final = final_img
    return partials, final


_BATCH_LIMIT_DEFAULT = 100  # Max icons per batch without explicit confirmation


async def _generate_one(state, job, provider, queue_item, total, style, quality, style_prompt,
                         project_id, default_model, api_quality, mood, ai_enhance, gpu_provider,
                         n_variations=4):
    """Generate a single icon (one prompt) with partial image streaming + retry. Returns (idx, record) or (idx, None) on failure."""
    idx = queue_item["idx"]
    name = queue_item["name"]
    prompt = queue_item["prompt"]
    queue_id = queue_item["id"]
    now = datetime.now(timezone.utc).isoformat()

    # Mark as generating in queue
    state._db.update_queue_item(queue_id, status="generating", updated_at=now)
    _emit(job, "queue_update", {"queue_id": queue_id, "status": "generating"})

    _emit(job, "progress", {"index": idx, "total": total, "name": name,
           "status": "enhancing" if ai_enhance else "generating",
           "style": style.value, "model": default_model, "mood": mood})

    api_key = get_api_key(state)
    if ai_enhance and api_key:
        try:
            enhanced = await enhance_prompt(
                subject=name,
                description=prompt if prompt != name else "",
                style=style.value,
                mood=mood,
                style_prompt=style_prompt,
                api_key=api_key,
            )
            if enhanced:
                prompt = enhanced
        except Exception as e:
            logging.warning(f"AI enhance failed: {e}")

    if ai_enhance:
        _emit(job, "progress", {"index": idx, "total": total, "name": name,
               "status": "generating", "style": style.value, "model": default_model, "mood": mood})

    record = GenerationRecord(
        project_id=project_id, name=name, prompt=prompt,
        style=style, quality=quality, model=default_model, api_quality=api_quality,
        mood=mood, ai_enhance=ai_enhance,
    )

    try:
        variation_results: list[Image.Image | None] = [None] * n_variations

        async def _stream_variation(vi: int):
            config = GenerationConfig(
                style_prompt=style_prompt, subject=name,
                description=prompt if prompt != name else "",
                mode=GenerationMode.PRECISION, style=style,
                api_quality=api_quality, mood=mood,
            )
            try:
                async for partial_b64, final_img in provider.generate_stream(config):
                    if partial_b64 is not None:
                        _emit(job, "partial_image", {
                            "index": idx, "variation": vi,
                            "image": partial_b64,
                        })
                    if final_img is not None:
                        variation_results[vi] = final_img
            except Exception:
                result = await provider.generate(config)
                if result:
                    variation_results[vi] = result[0]

        # IMPORTANT: keep partial successes when individual variations fail.
        # A credit-exhaustion (or any) error mid-icon must not throw away the
        # variations that already completed — the API was already charged.
        var_results = await asyncio.gather(
            *[_stream_variation(vi) for vi in range(n_variations)],
            return_exceptions=True,
        )
        var_excs = [r for r in var_results if isinstance(r, BaseException)]

        images = [img for img in variation_results if img is not None]
        if not images:
            # Nothing salvageable. If every variation failed with an auth-class
            # error, escalate so the whole job aborts (bad key isn't worth
            # retrying). Otherwise mark this icon as failed and move on.
            if var_excs and all(
                any(s in str(e).lower() for s in ("401", "auth", "api key"))
                for e in var_excs
            ):
                raise var_excs[0]
            raise RuntimeError("All variations returned empty results")
        raw_images = list(images)
    except Exception as e:
        msg = str(e)
        state._db.update_queue_item(queue_id, attempts=queue_item.get("attempts", 0) + 1,
                                    updated_at=datetime.now(timezone.utc).isoformat())

        if "401" in msg or "auth" in msg.lower() or "api key" in msg.lower():
            raise  # Auth errors bubble up to stop the whole job

        # No automatic retry — mark as failed, user retries manually
        now = datetime.now(timezone.utc).isoformat()
        state._db.update_queue_item(queue_id, status="failed", error=msg[:500], updated_at=now)
        _emit(job, "queue_update", {"queue_id": queue_id, "status": "failed", "error": msg[:200]})
        _emit(job, "error", {"message": f"Generation failed: {msg[:200]}", "name": name})
        return (idx, None)

    _emit(job, "progress", {"index": idx, "total": total, "name": name,
           "status": "processing", "style": style.value, "model": default_model, "mood": mood})

    for ri, raw_img in enumerate(raw_images):
        raw_path = f"images/{record.id}/original/r{ri}.png"
        _save_image(state, raw_img, raw_path)
    record.original_count = len(raw_images)

    for i, img in enumerate(images[:4]):
        source_path = f"images/{record.id}/raw/v{i}.png"
        preview_path = f"images/{record.id}/preview/v{i}.png"
        _save_image(state, img, source_path)
        preview = _make_preview(img, gpu_provider, model=record.model)
        _save_image(state, preview, preview_path)
        record.variations.append(GenerationVariation(
            index=i, source_path=source_path, preview_path=preview_path,
        ))

    # Mark queue item as completed
    now = datetime.now(timezone.utc).isoformat()
    state._db.update_queue_item(queue_id, status="completed", record_id=record.id, updated_at=now)
    _emit(job, "queue_update", {"queue_id": queue_id, "status": "completed", "record_id": record.id})

    return (idx, record)


async def _run_generation(state, job: dict):
    """Background task: generate icons in batches of 10 concurrent API calls, driven by queue."""
    params = job["params"]
    style = IconStyle(params["style"])
    quality = QualityMode(params["quality"])
    project_id = params.get("project_id", "")
    default_model = params["model"]
    api_quality = params.get("api_quality", "")
    mood = params.get("mood", "")
    ai_enhance = params.get("ai_enhance", False)
    n_variations = params.get("variations", 4)
    style_prompt = ""
    gpu_provider = state.config.get("gpu", {}).get("provider", "auto")

    if _is_stability_model(default_model):
        from needicons.server.api.settings import get_stability_key
        from needicons.core.providers.stability import StabilityProvider
        api_key = get_stability_key(state)
        if not api_key:
            _emit(job, "error", {"message": "No Stability AI API key configured"})
            job["status"] = "failed"
            await asyncio.sleep(5)
            state.jobs.pop(job["id"], None)
            state.save_jobs()
            return
        provider = StabilityProvider(api_key=api_key, default_model=default_model)
        # Stability doesn't support AI enhance
        ai_enhance = False
    elif _is_openrouter_model(default_model):
        from needicons.server.api.settings import get_openrouter_key, get_api_key
        from needicons.core.providers.openrouter import OpenRouterProvider
        api_key = get_openrouter_key(state)
        if not api_key:
            _emit(job, "error", {"message": "No OpenRouter API key configured"})
            job["status"] = "failed"
            await asyncio.sleep(5)
            state.jobs.pop(job["id"], None)
            state.save_jobs()
            return
        provider = OpenRouterProvider(api_key=api_key, default_model=default_model)
        # AI enhance still uses the OpenAI key if present; otherwise skip.
        if ai_enhance and not get_api_key(state):
            ai_enhance = False
    else:
        api_key = get_api_key(state)
        if not api_key:
            _emit(job, "error", {"message": "No OpenAI API key configured"})
            job["status"] = "failed"
            await asyncio.sleep(5)
            state.jobs.pop(job["id"], None)
            state.save_jobs()
            return
        provider = OpenAIProvider(api_key=api_key, default_model=default_model)

    # Load pending items from queue (supports resume after crash)
    remaining = state._db.get_pending_queue_items(job["id"])
    total = job.get("total", len(remaining))

    # Process in batches of _BATCH_SIZE
    for batch_start in range(0, len(remaining), _BATCH_SIZE):
        batch = remaining[batch_start:batch_start + _BATCH_SIZE]

        try:
            results = await asyncio.gather(*[
                _generate_one(state, job, provider, qi, total, style, quality,
                              style_prompt, project_id, default_model, api_quality,
                              mood, ai_enhance, gpu_provider, n_variations)
                for qi in batch
            ], return_exceptions=True)
        except Exception:
            results = []

        # Process all results first — successful records must be persisted
        # even if a sibling in the same batch raised an auth error. Otherwise
        # icons that did generate cleanly become orphans (images on disk,
        # queue marked completed, but no GenerationRecord in the UI).
        auth_msg = None
        for result in results:
            if isinstance(result, Exception):
                msg = str(result)
                if "401" in msg or "auth" in msg.lower() or "api key" in msg.lower():
                    auth_msg = msg
                continue

            idx, record = result
            if record:
                state.generation_records[record.id] = record
                _emit(job, "record", record.model_dump(mode="json"))

            job["completed_idx"] = idx

        # Synchronous save — must land before any abort path returns.
        state.save_data()
        state.save_jobs()

        if auth_msg:
            _emit(job, "error", {"message": "Invalid API key. Check your key in Settings."})
            job["status"] = "failed"
            await asyncio.sleep(5)
            state.jobs.pop(job["id"], None)
            state.save_jobs()
            return

    # Compute final stats from queue
    all_items = state._db.get_queue_items(job["id"])
    completed_count = sum(1 for i in all_items if i["status"] == "completed")
    failed_count = sum(1 for i in all_items if i["status"] == "failed")

    _emit(job, "done", {"total": total, "completed": completed_count, "failed": failed_count})
    job["status"] = "completed"
    # Clean up job after a short delay (let SSE clients read final events)
    # Queue data stays in SQLite for retry/review
    await asyncio.sleep(5)
    state.jobs.pop(job["id"], None)
    state.save_jobs()


def resume_jobs(state):
    """Check for interrupted jobs on startup. Does NOT auto-resume — logs info only.

    Auto-resuming caused runaway API costs when servers restarted repeatedly.
    Users must explicitly retry via the UI or API.
    """
    for job in list(state.jobs.values()):
        if job.get("status") == "resumable":
            queue_items = state._db.get_queue_items(job["id"])
            pending = sum(1 for qi in queue_items if qi["status"] in ("pending", "generating"))
            if pending > 0:
                logging.info(f"Job {job['id']} has {pending} unfinished items. Use retry UI to resume.")
            # Mark as paused, not running — user must explicitly resume
            job["status"] = "paused"
            for qi in queue_items:
                if qi["status"] == "generating":
                    state._db.update_queue_item(qi["id"], status="pending",
                                                updated_at=datetime.now(timezone.utc).isoformat())
            state.save_jobs()


def _reprocess_variation(original: Image.Image, record, gpu_provider: str = "auto") -> Image.Image:
    """Chain all active tools in fixed order from the original image."""
    img = original.copy()

    # 1. BG Removal
    if record.bg_removal_level > 0:
        img = remove_background(img, record.bg_removal_level, gpu_provider)

    # 1.5 Smart Selection Masks (point-based)
    if record.lasso_masks:
        w, h = img.size
        masks_data = []
        for lm in record.lasso_masks:
            pixel_point = (int(lm.point[0] * w), int(lm.point[1] * h))
            masks_data.append({
                "point": pixel_point,
                "mode": lm.mode,
                "strategy": lm.strategy,
                "tolerance": lm.tolerance,
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
    variations = max(1, min(4, body.get("variations", 4)))

    provider_config = state.config.get("provider", {})
    default_model = body.get("model", "")
    if not default_model:
        default_model = provider_config.get("default_model", "gpt-image-1-mini")

    # Validate API key based on selected model
    if _is_stability_model(default_model):
        from needicons.server.api.settings import get_stability_key
        if not get_stability_key(state):
            raise HTTPException(status_code=400, detail="No Stability AI API key configured")
    elif _is_openrouter_model(default_model):
        from needicons.server.api.settings import get_openrouter_key
        if not get_openrouter_key(state):
            raise HTTPException(status_code=400, detail="No OpenRouter API key configured")
    else:
        if not get_api_key(state):
            raise HTTPException(status_code=400, detail="No OpenAI API key configured")

    if project_id:
        project = state.projects[project_id]
        project.style_preference = style
        project.quality_preference = quality

    valid_prompts = [p for p in prompts if p.get("name")]

    # Safety limit — prevent accidental massive API spend
    max_icons = state.config.get("generation", {}).get("max_batch_size", 100)
    if len(valid_prompts) > max_icons:
        confirmed = body.get("confirm_large_batch", False)
        if not confirmed:
            est_cost = len(valid_prompts) * variations * 0.04  # rough estimate
            raise HTTPException(
                status_code=400,
                detail=f"Batch too large: {len(valid_prompts)} icons x {variations} variations. "
                       f"Estimated cost: ~${est_cost:.0f}. "
                       f"Set max_batch_size in config or pass confirm_large_batch=true to proceed."
            )

    job_id = _new_id()
    now = datetime.now(timezone.utc).isoformat()

    # Insert all prompts into generation queue for persistence/recovery
    queue_items = []
    for idx, item in enumerate(valid_prompts):
        queue_items.append({
            "id": _new_id(),
            "job_id": job_id,
            "project_id": project_id or "",
            "idx": idx,
            "name": item["name"],
            "prompt": item.get("prompt", item["name"]),
            "style": style.value,
            "model": default_model,
            "api_quality": api_quality,
            "mood": mood,
            "ai_enhance": ai_enhance,
            "variations": variations,
            "status": "pending",
            "created_at": now,
            "updated_at": now,
        })
    state._db.insert_queue_items(queue_items)

    job = {
        "id": job_id,
        "status": "running",
        "project_id": project_id,
        "total": len(valid_prompts),
        "params": {
            "prompts": valid_prompts,
            "style": style.value,
            "quality": quality.value,
            "model": default_model,
            "project_id": project_id,
            "api_quality": api_quality,
            "mood": mood,
            "ai_enhance": ai_enhance,
            "variations": variations,
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


@router.get("/api/generate/queue/{job_id}")
async def get_queue_status(job_id: str, request: Request):
    """Get per-icon queue status for a generation job."""
    state = request.app.state.app_state
    items = state._db.get_queue_items(job_id)
    if not items:
        raise HTTPException(status_code=404, detail="No queue items found for this job")
    summary = {
        "job_id": job_id,
        "total": len(items),
        "completed": sum(1 for i in items if i["status"] == "completed"),
        "failed": sum(1 for i in items if i["status"] == "failed"),
        "pending": sum(1 for i in items if i["status"] in ("pending", "generating")),
        "items": items,
    }
    return summary


@router.post("/api/generate/queue/{item_id}/retry")
async def retry_queue_item(item_id: str, request: Request):
    """Retry a single failed queue item."""
    state = request.app.state.app_state
    item = state._db.get_queue_item(item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Queue item not found")
    if item["status"] != "failed":
        raise HTTPException(status_code=400, detail="Only failed items can be retried")

    # Reset item to pending
    now = datetime.now(timezone.utc).isoformat()
    state._db.update_queue_item(item_id, status="pending", error=None, updated_at=now)

    # Check if a job exists for this; if not, create one
    job_id = item["job_id"]
    job = state.jobs.get(job_id)
    if not job or job.get("status") not in ("running",):
        # Create a new retry job
        job = {
            "id": job_id,
            "status": "running",
            "project_id": item["project_id"],
            "total": 1,
            "params": {
                "prompts": [{"name": item["name"], "prompt": item["prompt"]}],
                "style": item["style"],
                "quality": "normal",
                "model": item["model"],
                "project_id": item["project_id"],
                "api_quality": item.get("api_quality", ""),
                "mood": item.get("mood", ""),
                "ai_enhance": bool(item.get("ai_enhance", 0)),
                "variations": item.get("variations", 4),
            },
            "completed_idx": -1,
            "events": [],
        }
        state.jobs[job_id] = job
        state.save_jobs()
        asyncio.create_task(_run_generation(state, job))

    return {"status": "retrying", "job_id": job_id, "item_id": item_id}


@router.post("/api/generate/queue/{job_id}/retry-all")
async def retry_all_failed(job_id: str, request: Request):
    """Retry all failed items in a job's queue."""
    state = request.app.state.app_state
    items = state._db.get_queue_items(job_id)
    failed = [i for i in items if i["status"] == "failed"]
    if not failed:
        raise HTTPException(status_code=400, detail="No failed items to retry")

    now = datetime.now(timezone.utc).isoformat()
    for item in failed:
        state._db.update_queue_item(item["id"], status="pending", error=None, updated_at=now)

    # Create/reuse job
    job = state.jobs.get(job_id)
    if not job or job.get("status") not in ("running",):
        first = failed[0]
        job = {
            "id": job_id,
            "status": "running",
            "project_id": first["project_id"],
            "total": len(failed),
            "params": {
                "prompts": [{"name": i["name"], "prompt": i["prompt"]} for i in failed],
                "style": first["style"],
                "quality": "normal",
                "model": first["model"],
                "project_id": first["project_id"],
                "api_quality": first.get("api_quality", ""),
                "mood": first.get("mood", ""),
                "ai_enhance": bool(first.get("ai_enhance", 0)),
                "variations": first.get("variations", 4),
            },
            "completed_idx": -1,
            "events": [],
        }
        state.jobs[job_id] = job
        state.save_jobs()
        asyncio.create_task(_run_generation(state, job))

    return {"status": "retrying", "job_id": job_id, "count": len(failed)}


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

    # Respond immediately, save to disk in background
    result = record.model_dump()
    asyncio.create_task(asyncio.to_thread(state.save_data))
    return result


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

    result = record.model_dump()
    asyncio.create_task(asyncio.to_thread(state.save_data))
    return result


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
    asyncio.create_task(asyncio.to_thread(state.save_data))
    return {"status": "deleted"}


@router.post("/api/generations/delete-duplicates")
async def delete_duplicate_generations(request: Request):
    """Preview or execute duplicate deletion. Never deletes entries with picks."""
    state = request.app.state.app_state
    body = await request.json()
    project_id = body.get("project_id", "")
    dry_run = body.get("dry_run", False)
    exclude_names = set(n.lower() for n in body.get("exclude_names", []))

    # Group records by lowercase name
    by_name: dict[str, list] = {}
    for rec_id, record in state.generation_records.items():
        if project_id and record.project_id != project_id:
            continue
        key = record.name.lower()
        by_name.setdefault(key, []).append(record)

    to_delete = []
    preview: list[dict] = []
    for name, records in by_name.items():
        if len(records) < 2:
            continue
        if name in exclude_names:
            continue
        # Never delete entries with a pick — only delete unpicked duplicates
        picked = [r for r in records if any(v.picked for v in r.variations)]
        unpicked = [r for r in records if not any(v.picked for v in r.variations)]

        if picked:
            # Keep all picked, delete unpicked duplicates
            deletable = unpicked
        else:
            # No picks — keep the newest, delete the rest
            newest = max(records, key=lambda r: r.created_at)
            deletable = [r for r in records if r.id != newest.id]

        for r in deletable:
            to_delete.append(r.id)

        if deletable:
            preview.append({
                "name": records[0].name,
                "total": len(records),
                "keeping": len(records) - len(deletable),
                "deleting": len(deletable),
                "has_picks": len(picked) > 0,
            })

    if dry_run:
        return {
            "dry_run": True,
            "would_delete": len(to_delete),
            "duplicate_names": len(preview),
            "preview": preview,
        }

    # Execute deletion
    for gen_id in to_delete:
        record = state.generation_records.get(gen_id)
        if record and record.project_id:
            project = state.projects.get(record.project_id)
            if project:
                project.icons = [i for i in project.icons if not i.source_path.startswith(f"images/{gen_id}/")]
        if gen_id in state.generation_records:
            del state.generation_records[gen_id]

    if to_delete:
        asyncio.create_task(asyncio.to_thread(state.save_data))

    return {"deleted": len(to_delete), "kept": len(by_name), "preview": preview}


@router.post("/api/generations/delete-group-duplicates")
async def delete_group_duplicates(request: Request):
    """Delete duplicates for a specific icon name."""
    state = request.app.state.app_state
    body = await request.json()
    project_id = body.get("project_id", "")
    name = body.get("name", "").lower()
    mode = body.get("mode", "keep_picked")  # "keep_picked" or "keep_newest_only"

    if not name:
        raise HTTPException(status_code=400, detail="Name is required")

    # Find all records with this name
    matching = [
        r for r in state.generation_records.values()
        if r.name.lower() == name and (not project_id or r.project_id == project_id)
    ]

    if len(matching) < 2:
        return {"deleted": 0, "kept": len(matching)}

    to_delete = []
    if mode == "keep_newest_only":
        # Keep only the newest, delete everything else
        newest = max(matching, key=lambda r: r.created_at)
        to_delete = [r.id for r in matching if r.id != newest.id]
    else:
        # Keep all picked + newest unpicked
        picked = [r for r in matching if any(v.picked for v in r.variations)]
        unpicked = [r for r in matching if not any(v.picked for v in r.variations)]
        if picked:
            # Delete all unpicked
            to_delete = [r.id for r in unpicked]
        else:
            # No picks — keep newest, delete rest
            newest = max(matching, key=lambda r: r.created_at)
            to_delete = [r.id for r in matching if r.id != newest.id]

    for gen_id in to_delete:
        record = state.generation_records.get(gen_id)
        if record and record.project_id:
            project = state.projects.get(record.project_id)
            if project:
                project.icons = [i for i in project.icons if not i.source_path.startswith(f"images/{gen_id}/")]
        if gen_id in state.generation_records:
            del state.generation_records[gen_id]

    if to_delete:
        asyncio.create_task(asyncio.to_thread(state.save_data))

    return {"deleted": len(to_delete), "kept": len(matching) - len(to_delete)}


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
        asyncio.create_task(asyncio.to_thread(state.save_data))

    if level == 0:
        from needicons.core.pipeline.normalize import CenteringStep, WeightNormalizationStep
        for variation in record.variations:
            original_path = f"images/{record.id}/original/r{variation.index}.png"
            full_original = state.data_dir / original_path
            if full_original.exists():
                raw_img = Image.open(full_original).convert("RGBA")
                _save_image(state, raw_img, variation.source_path)
                wn = WeightNormalizationStep()
                preview = wn.process(raw_img, {"enabled": True, "target_fill": 0.90})
                centering = CenteringStep()
                preview = centering.process(preview, {})
                preview = preview.resize((256, 256), Image.LANCZOS)
                _save_image(state, preview, variation.preview_path)
        record.bg_removal_level = 0
        asyncio.create_task(asyncio.to_thread(state.save_data))
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
        processed = wn.process(processed, {"enabled": True, "target_fill": 0.90})
        centering = CenteringStep()
        preview = centering.process(processed, {})
        preview = preview.resize((256, 256), Image.LANCZOS)
        _save_image(state, preview, variation.preview_path)

    record.bg_removal_level = level
    asyncio.create_task(asyncio.to_thread(state.save_data))
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
        preview = wn.process(processed, {"enabled": True, "target_fill": 0.90})
        centering = CenteringStep()
        preview = centering.process(preview, {})
        preview = preview.resize((256, 256), Image.LANCZOS)
        _save_image(state, preview, variation.preview_path)

    asyncio.create_task(asyncio.to_thread(state.save_data))
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
        preview = wn.process(processed, {"enabled": True, "target_fill": 0.90})
        centering = CenteringStep()
        preview = centering.process(preview, {})
        preview = preview.resize((256, 256), Image.LANCZOS)
        _save_image(state, preview, variation.preview_path)

    asyncio.create_task(asyncio.to_thread(state.save_data))
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
        preview = wn.process(processed, {"enabled": True, "target_fill": 0.90})
        centering = CenteringStep()
        preview = centering.process(preview, {})
        preview = preview.resize((256, 256), Image.LANCZOS)
        _save_image(state, preview, variation.preview_path)

    asyncio.create_task(asyncio.to_thread(state.save_data))
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
        preview = wn.process(processed, {"enabled": True, "target_fill": 0.90})
        centering = CenteringStep()
        preview = centering.process(preview, {})
        preview = preview.resize((256, 256), Image.LANCZOS)
        _save_image(state, preview, variation.preview_path)

    asyncio.create_task(asyncio.to_thread(state.save_data))
    return record.model_dump()


@router.get("/api/generation-tools/strategies")
async def get_lasso_strategies():
    """Return list of installed segmentation strategies for lasso tool."""
    return {"strategies": get_available_strategies()}


@router.post("/api/generations/{gen_id}/lasso-mask")
async def add_lasso_mask(gen_id: str, request: Request):
    """Add a lasso mask selection to a generation record."""
    state = request.app.state.app_state
    record = state.generation_records.get(gen_id)
    if not record:
        raise HTTPException(status_code=404, detail="Generation record not found")

    body = await request.json()
    point = body.get("point")
    mode = body.get("mode", "remove")
    strategy = body.get("strategy", "grabcut")
    tolerance = max(1, min(255, body.get("tolerance", 32)))

    if not point or len(point) != 2:
        raise HTTPException(status_code=400, detail="Point must be [x, y] in normalized 0-1 coords")

    if mode not in ("remove", "protect"):
        raise HTTPException(status_code=400, detail="Mode must be 'remove' or 'protect'")

    available = get_available_strategies()
    if strategy not in available:
        raise HTTPException(status_code=400, detail=f"Strategy '{strategy}' not installed. Available: {available}")

    from needicons.core.models import LassoMask
    mask_id = _new_id()
    lasso_mask = LassoMask(
        id=mask_id,
        point=(float(point[0]), float(point[1])),
        mode=mode,
        strategy=strategy,
        tolerance=tolerance,
    )
    record.lasso_masks.append(lasso_mask)

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
        preview = wn.process(processed, {"enabled": True, "target_fill": 0.90})
        centering = CenteringStep()
        preview = centering.process(preview, {})
        preview = preview.resize((256, 256), Image.LANCZOS)
        _save_image(state, preview, variation.preview_path)

    asyncio.create_task(asyncio.to_thread(state.save_data))
    return {"mask_id": mask_id, "record": record.model_dump()}


@router.delete("/api/generations/{gen_id}/lasso-mask/{mask_id}")
async def delete_lasso_mask(gen_id: str, mask_id: str, request: Request):
    """Remove a lasso mask from a generation record and reprocess."""
    state = request.app.state.app_state
    record = state.generation_records.get(gen_id)
    if not record:
        raise HTTPException(status_code=404, detail="Generation record not found")

    original_len = len(record.lasso_masks)
    record.lasso_masks = [m for m in record.lasso_masks if m.id != mask_id]
    if len(record.lasso_masks) == original_len:
        raise HTTPException(status_code=404, detail="Mask not found")

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
        preview = wn.process(processed, {"enabled": True, "target_fill": 0.90})
        centering = CenteringStep()
        preview = centering.process(preview, {})
        preview = preview.resize((256, 256), Image.LANCZOS)
        _save_image(state, preview, variation.preview_path)

    asyncio.create_task(asyncio.to_thread(state.save_data))
    return record.model_dump()


@router.post("/api/generations/{gen_id}/refine")
async def refine_variation(gen_id: str, request: Request):
    """Refine a variation with streaming partial images via SSE."""
    state = request.app.state.app_state
    record = state.generation_records.get(gen_id)
    if not record:
        raise HTTPException(status_code=404, detail="Generation record not found")

    body = await request.json()
    prompt = body.get("prompt", "").strip()
    variation_index = body.get("variation_index", 0)

    if not prompt:
        raise HTTPException(status_code=400, detail="Prompt is required")

    variation = next((v for v in record.variations if v.index == variation_index), None)
    if not variation:
        raise HTTPException(status_code=404, detail="Variation not found")

    api_key = get_api_key(state)
    if not api_key:
        raise HTTPException(status_code=400, detail="No API key configured")

    provider_config = state.config.get("provider", {})
    default_model = provider_config.get("default_model", "gpt-image-1-mini")

    source_path = state.data_dir / variation.source_path
    if not source_path.exists():
        raise HTTPException(status_code=404, detail="Source image not found")

    source_image = Image.open(source_path).convert("RGBA")
    provider = OpenAIProvider(api_key=api_key, default_model=default_model)

    async def stream_refine():
        try:
            async for partial_b64, final_image in provider.edit_stream(source_image, prompt):
                if partial_b64 is not None:
                    yield f"event: partial\ndata: {json.dumps({'image': partial_b64})}\n\n"
                if final_image is not None:
                    # Save final image
                    record.refine_version = getattr(record, "refine_version", 0) + 1
                    _save_image(state, final_image, variation.source_path)
                    wn = WeightNormalizationStep()
                    preview = wn.process(final_image, {"enabled": True, "target_fill": 0.90})
                    centering = CenteringStep()
                    preview = centering.process(preview, {})
                    preview = preview.resize((256, 256), Image.LANCZOS)
                    _save_image(state, preview, variation.preview_path)
                    asyncio.create_task(asyncio.to_thread(state.save_data))
                    yield f"event: done\ndata: {json.dumps({'record': record.model_dump()})}\n\n"
        except Exception as e:
            yield f"event: error\ndata: {json.dumps({'detail': str(e)})}\n\n"

    return StreamingResponse(stream_refine(), media_type="text/event-stream")


@router.post("/api/generations/{gen_id}/remove-bg-stability")
async def remove_bg_stability(gen_id: str, request: Request):
    """Remove background using Stability AI API for all variations of a generation."""
    state = request.app.state.app_state
    record = state.generation_records.get(gen_id)
    if not record:
        raise HTTPException(status_code=404, detail="Generation record not found")

    from needicons.server.api.settings import get_stability_key
    from needicons.core.providers.stability import StabilityProvider

    api_key = get_stability_key(state)
    if not api_key:
        raise HTTPException(status_code=400, detail="No Stability AI API key configured")

    provider = StabilityProvider(api_key=api_key)

    for variation in record.variations:
        source_path = state.data_dir / variation.source_path
        if not source_path.exists():
            continue
        img = Image.open(source_path).convert("RGBA")
        processed = await provider.remove_background(img)
        _save_image(state, processed, variation.source_path)
        # Update preview
        from needicons.core.pipeline.normalize import WeightNormalizationStep, CenteringStep
        wn = WeightNormalizationStep()
        preview = wn.process(processed, {"enabled": True, "target_fill": 0.90})
        centering = CenteringStep()
        preview = centering.process(preview, {})
        preview = preview.resize((256, 256), Image.LANCZOS)
        _save_image(state, preview, variation.preview_path)

    asyncio.create_task(asyncio.to_thread(state.save_data))
    return record.model_dump()


@router.post("/api/projects/{project_id}/remove-bg-stability")
async def remove_bg_stability_bulk(project_id: str, request: Request):
    """Remove backgrounds for all icons in a project using Stability AI API."""
    state = request.app.state.app_state
    project = state.projects.get(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    from needicons.server.api.settings import get_stability_key
    from needicons.core.providers.stability import StabilityProvider

    api_key = get_stability_key(state)
    if not api_key:
        raise HTTPException(status_code=400, detail="No Stability AI API key configured")

    provider = StabilityProvider(api_key=api_key)
    processed_count = 0

    for icon in project.icons:
        source_path = state.data_dir / icon.source_path
        if not source_path.exists():
            continue
        img = Image.open(source_path).convert("RGBA")
        processed = await provider.remove_background(img)
        _save_image(state, processed, icon.source_path)
        # Update preview
        preview_path = icon.preview_path
        from needicons.core.pipeline.normalize import WeightNormalizationStep, CenteringStep
        wn = WeightNormalizationStep()
        preview = wn.process(processed, {"enabled": True, "target_fill": 0.90})
        centering = CenteringStep()
        preview = centering.process(preview, {})
        preview = preview.resize((256, 256), Image.LANCZOS)
        _save_image(state, preview, preview_path)
        processed_count += 1

    asyncio.create_task(asyncio.to_thread(state.save_data))
    return {"status": "ok", "processed": processed_count, "total": len(project.icons)}
