"""Pipeline preview and export API endpoints."""
from __future__ import annotations
import asyncio
import hashlib
import io
import json
import pathlib
from fastapi import APIRouter, Request, HTTPException
from fastapi.responses import Response
from PIL import Image
from needicons.core.pipeline import build_default_pipeline
from needicons.core.export.packager import build_zip
from needicons.core.models import ProcessingProfile

router = APIRouter(tags=["pipeline"])

_refresh_jobs: dict[str, dict] = {}
_export_jobs: dict[str, dict] = {}


def _profile_to_configs(profile, gpu_provider: str = "auto") -> dict[str, dict]:
    """Convert a ProcessingProfile to pipeline runner configs dict."""
    bg_config = profile.background_removal.model_dump()
    bg_config["gpu_provider"] = gpu_provider

    wn_config = profile.weight_normalization.model_dump()
    shape = profile.mask.shape
    # Only re-normalize and re-center when a shape mask is active —
    # the icon needs to fit inside the shape. Otherwise icons were
    # already normalized/centered at generation time.
    if shape != "none":
        wn_config["enabled"] = True
        wn_config["shape"] = shape
    centering_config = {"skip": shape == "none"}

    return {
        "background_removal": bg_config,
        "edge_cleanup": profile.edge_cleanup.model_dump(),
        "weight_normalization": wn_config,
        "centering": centering_config,
        "color": profile.color.model_dump(),
        "stroke": profile.stroke.model_dump(),
        "shape_mask": profile.mask.model_dump(),
        "background_fill": {**profile.fill.model_dump(), "corner_radius": profile.mask.corner_radius},
        "drop_shadow": profile.shadow.model_dump(),
        "resize": profile.output.model_dump(),
    }


def _project_settings_to_profile(project) -> ProcessingProfile:
    """Build a ProcessingProfile from project post-processing settings."""
    pp = project.post_processing
    profile = ProcessingProfile(
        name=f"_{project.name}_export",
        stroke=pp.stroke,
        mask=pp.mask,
        fill=pp.fill,
        shadow=pp.shadow,
        padding=pp.padding,
    )
    # Only enable weight normalization when a shape mask is active —
    # the icon needs to fit inside the shape. Otherwise skip it since
    # normalization was already applied at generation time.
    if pp.mask.shape != "none":
        profile.weight_normalization.enabled = True
        profile.weight_normalization.target_fill = 0.88
    else:
        profile.weight_normalization.enabled = False
    # Reset padding to 0 — padding was removed from UI
    profile.padding.percent = 0
    profile.padding.pixels = None
    return profile


def _settings_hash(project, icon_id: str) -> str:
    """Hash project post-processing settings + icon ID for cache key."""
    key = json.dumps({
        "icon": icon_id,
        "pp": project.post_processing.model_dump(mode="json"),
    }, sort_keys=True)
    return hashlib.sha256(key.encode()).hexdigest()[:16]


def _render_preview_sync(source_file, project, cache_dir, cache_file, gpu_provider: str = "auto") -> bytes:
    """Synchronous preview rendering — called from thread pool."""
    profile = _project_settings_to_profile(project)
    profile.background_removal.enabled = False
    profile.edge_cleanup.enabled = False
    profile.output.sizes = [256]
    profile.output.formats = ["png"]

    pipeline = build_default_pipeline()
    configs = _profile_to_configs(profile, gpu_provider)

    img = Image.open(source_file).convert("RGBA")
    if img.width > 512 or img.height > 512:
        img.thumbnail((512, 512), Image.LANCZOS)

    # If outer stroke is active, scale content to leave room for stroke pixels
    stroke_cfg = configs.get("stroke", {})
    if stroke_cfg.get("enabled") and stroke_cfg.get("position", "outer") == "outer":
        stroke_w = stroke_cfg.get("width", 2)
        w, h = img.size
        # Scale content so stroke fits without clipping
        import numpy as np
        arr = np.array(img)
        alpha = arr[:, :, 3]
        rows_any = np.any(alpha > 0, axis=1)
        cols_any = np.any(alpha > 0, axis=0)
        if np.any(rows_any) and np.any(cols_any):
            y1, y2 = int(np.where(rows_any)[0][0]), int(np.where(rows_any)[0][-1])
            x1, x2 = int(np.where(cols_any)[0][0]), int(np.where(cols_any)[0][-1])
            margin = min(x1, y1, w - x2 - 1, h - y2 - 1)
            needed = stroke_w + 2
            if margin < needed:
                cw, ch = x2 - x1 + 1, y2 - y1 + 1
                avail = min(w, h) - needed * 2
                scale = avail / max(cw, ch)
                if scale < 1.0 and scale > 0.5:
                    content = img.crop((x1, y1, x2 + 1, y2 + 1))
                    nw, nh = int(cw * scale), int(ch * scale)
                    content = content.resize((nw, nh), Image.LANCZOS)
                    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
                    img.paste(content, ((w - nw) // 2, (h - nh) // 2))

    result = pipeline.run(img, configs)

    if isinstance(result, dict):
        img_out = result.get(256, img)
    else:
        img_out = result

    buf = io.BytesIO()
    img_out.save(buf, format="PNG")
    png_bytes = buf.getvalue()

    cache_dir.mkdir(parents=True, exist_ok=True)
    cache_file.write_bytes(png_bytes)

    return png_bytes


def _has_active_effects(project) -> bool:
    """Check if any post-processing effects are actually enabled."""
    pp = project.post_processing
    if pp.stroke.enabled:
        return True
    if pp.shadow.enabled:
        return True
    if pp.mask.shape != "none":
        return True
    if pp.fill.type != "none":
        return True
    return False


@router.get("/api/projects/{project_id}/icons/{icon_id}/preview")
async def preview_icon(project_id: str, icon_id: str, request: Request):
    state = request.app.state.app_state
    project = state.projects.get(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    icon = next((i for i in project.icons if i.id == icon_id), None)
    if not icon:
        raise HTTPException(status_code=404, detail="Icon not found")

    preview_file = state.data_dir / icon.preview_path
    source_file = state.data_dir / icon.source_path

    # If no effects are active, serve the original generation preview directly —
    # no pipeline, no resizing, exact original bytes
    if not _has_active_effects(project):
        if preview_file.exists():
            return Response(
                content=preview_file.read_bytes(),
                media_type="image/png",
                headers={"Cache-Control": "no-cache, no-store", "Pragma": "no-cache"},
            )

    # Shape is only used when background fill is active (for corner radius)
    if project.post_processing.fill.type == "none":
        project.post_processing.mask.shape = "none"

    input_file = preview_file if preview_file.exists() else source_file
    if not input_file.exists():
        raise HTTPException(status_code=404, detail="Source image not found")

    cache_key = _settings_hash(project, icon_id)
    cache_dir = state.data_dir / "cache" / "previews"
    cache_file = cache_dir / f"{cache_key}.png"
    if cache_file.exists():
        return Response(
            content=cache_file.read_bytes(),
            media_type="image/png",
            headers={"Cache-Control": "no-cache, no-store"},
        )

    gpu_provider = state.config.get("gpu", {}).get("provider", "auto")
    png_bytes = await asyncio.to_thread(
        _render_preview_sync, input_file, project, cache_dir, cache_file, gpu_provider
    )

    return Response(content=png_bytes, media_type="image/png")


@router.post("/api/projects/{project_id}/refresh-previews")
async def refresh_previews(project_id: str, request: Request):
    state = request.app.state.app_state
    project = state.projects.get(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    if not project.icons:
        return {"status": "no_icons", "total": 0}

    # Clear preview cache for this project
    cache_dir = state.data_dir / "cache" / "previews"
    if cache_dir.exists():
        for icon in project.icons:
            cache_key = _settings_hash(project, icon.id)
            cache_file = cache_dir / f"{cache_key}.png"
            if cache_file.exists():
                cache_file.unlink()

    from needicons.core.models import _new_id
    job_id = _new_id()
    _refresh_jobs[job_id] = {"status": "running", "total": len(project.icons), "completed": 0}

    asyncio.create_task(_run_refresh(state, project, job_id))
    return {"status": "started", "job_id": job_id, "total": len(project.icons)}


async def _run_refresh(state, project, job_id: str):
    job = _refresh_jobs.get(job_id)
    if not job:
        return
    cache_dir = state.data_dir / "cache" / "previews"
    gpu_provider = state.config.get("gpu", {}).get("provider", "auto")

    for icon in project.icons:
        preview_file = state.data_dir / icon.preview_path
        source_file = state.data_dir / icon.source_path
        input_file = preview_file if preview_file.exists() else source_file
        if not input_file.exists():
            job["completed"] += 1
            continue
        cache_key = _settings_hash(project, icon.id)
        cache_file = cache_dir / f"{cache_key}.png"
        try:
            await asyncio.to_thread(
                _render_preview_sync, input_file, project, cache_dir, cache_file, gpu_provider
            )
        except Exception:
            pass
        job["completed"] += 1

    job["status"] = "completed"
    await asyncio.sleep(30)
    _refresh_jobs.pop(job_id, None)


@router.get("/api/projects/{project_id}/refresh-previews/{job_id}")
async def refresh_status(project_id: str, job_id: str):
    job = _refresh_jobs.get(job_id)
    if not job:
        return {"status": "not_found"}
    return {"status": job["status"], "completed": job["completed"], "total": job["total"]}


@router.head("/api/projects/{project_id}/icons/{icon_id}/export-preview")
@router.get("/api/projects/{project_id}/icons/{icon_id}/export-preview")
async def export_preview(project_id: str, icon_id: str, request: Request):
    """Preview a single icon in any export format (png, webp, svg)."""
    state = request.app.state.app_state
    project = state.projects.get(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    icon = next((i for i in project.icons if i.id == icon_id), None)
    if not icon:
        raise HTTPException(status_code=404, detail="Icon not found")

    fmt = request.query_params.get("format", "svg")
    size = int(request.query_params.get("size", "512"))
    svg_smoothing = int(request.query_params.get("svg_smoothing", "3"))  # 1-5 scale

    source_file = state.data_dir / icon.source_path
    if not source_file.exists():
        raise HTTPException(status_code=404, detail="Source not found")

    from needicons.core.pipeline.normalize import WeightNormalizationStep, CenteringStep
    from needicons.core.export.packager import _raster_to_svg

    img = Image.open(source_file).convert("RGBA")
    wn = WeightNormalizationStep()
    img = wn.process(img, {"enabled": True, "target_fill": 0.95})
    centering = CenteringStep()
    img = centering.process(img, {})

    if fmt == "svg":
        from needicons.core.export.packager import optimize_svg, svg_to_react, svg_to_react_native
        svg_optimize = request.query_params.get("optimize", "false") == "true"
        svg_format = request.query_params.get("svg_format", "raw")  # raw, react, react-native

        svg_str = _raster_to_svg(img, smoothing=svg_smoothing)
        if svg_optimize:
            svg_str = optimize_svg(svg_str)

        if svg_format == "react":
            name = icon.name.replace(" ", "").replace("-", "").capitalize() + "Icon"
            content = svg_to_react(svg_str, name)
            media_type = "text/javascript"
        elif svg_format == "react-native":
            name = icon.name.replace(" ", "").replace("-", "").capitalize() + "Icon"
            content = svg_to_react_native(svg_str, name)
            media_type = "text/javascript"
        else:
            content = svg_str
            media_type = "image/svg+xml"

        content_bytes = content.encode("utf-8")
        return Response(content=content_bytes, media_type=media_type,
                        headers={
                            "Cache-Control": "no-cache",
                            "X-File-Size": str(len(content_bytes)),
                        })
    else:
        from needicons.core.pipeline.signature import encode as _sign
        img = img.resize((size, size), Image.LANCZOS)
        quality_level = request.query_params.get("quality", "lossless")
        quality_map = {"high": 90, "medium": 75, "low": 50}
        buf = io.BytesIO()
        if fmt == "webp":
            if quality_level in quality_map:
                img.save(buf, format="WEBP", quality=quality_map[quality_level])
            else:
                img.save(buf, format="WEBP", lossless=True)
            media = "image/webp"
        else:
            # Tag with processing signature before export
            img = _sign(img)
            if quality_level in quality_map:
                img_rgb = img.convert("RGBA")
                img_rgb.save(buf, format="PNG", optimize=True)
            else:
                img.save(buf, format="PNG")
            media = "image/png"
        content_bytes = buf.getvalue()
        return Response(content=content_bytes, media_type=media,
                        headers={
                            "Cache-Control": "no-cache",
                            "X-File-Size": str(len(content_bytes)),
                        })


@router.post("/api/projects/{project_id}/export")
async def export_project(project_id: str, request: Request):
    state = request.app.state.app_state
    project = state.projects.get(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    body = await request.json()
    sizes = body.get("sizes", [256, 128, 64, 32])
    formats = body.get("formats", ["png"])
    svg_smoothing = body.get("svg_smoothing", 1)
    svg_optimize = body.get("svg_optimize", False)

    if not project.icons:
        raise HTTPException(status_code=400, detail="No icons to export")

    from needicons.core.models import _new_id
    job_id = _new_id()
    _export_jobs[job_id] = {
        "status": "running", "total": len(project.icons),
        "completed": 0, "current_icon": "", "result_path": None, "error": None,
    }

    asyncio.create_task(_run_export(state, project, sizes, formats, job_id, svg_smoothing, svg_optimize))
    return {"job_id": job_id, "total": len(project.icons)}


async def _run_export(state, project, sizes, formats, job_id: str, svg_smoothing: int = 1, svg_optimize: bool = False):
    job = _export_jobs.get(job_id)
    if not job:
        return

    try:
        profile = _project_settings_to_profile(project)
        profile.background_removal.enabled = False
        profile.edge_cleanup.enabled = False
        profile.output.sizes = []

        gpu_provider = state.config.get("gpu", {}).get("provider", "auto")
        pipeline = build_default_pipeline()
        configs = _profile_to_configs(profile, gpu_provider)

        # For export, use the full-res raw source and normalize to fill 95%
        from needicons.core.pipeline.normalize import WeightNormalizationStep, CenteringStep
        export_wn = WeightNormalizationStep()
        export_center = CenteringStep()

        # Build unique export names: house, house_solid, house_solid_2, etc.
        export_names: dict[str, str] = {}
        _name_seen: dict[str, int] = {}
        for icon in project.icons:
            # If name is unique, use it as-is. If duplicate, append style.
            # If name+style is still duplicate, append counter.
            candidate = icon.name
            if candidate in _name_seen:
                candidate = f"{icon.name}_{icon.style}"
            if candidate in _name_seen:
                _name_seen[candidate] += 1
                candidate = f"{candidate}_{_name_seen[candidate]}"
            _name_seen[candidate] = _name_seen.get(candidate, 0) + 1
            _name_seen[icon.name] = _name_seen.get(icon.name, 0) + 1
            export_names[icon.id] = candidate

        processed_icons = {}
        for icon in project.icons:
            job["current_icon"] = icon.name
            source_file = state.data_dir / icon.source_path
            if not source_file.exists():
                job["completed"] += 1
                continue
            img = Image.open(source_file).convert("RGBA")
            # Cap export sizes at source resolution (don't upscale)
            max_dim = max(img.width, img.height)
            icon_sizes = [s for s in sizes if s <= max_dim]
            if not icon_sizes:
                icon_sizes = [max_dim]
            # Normalize to fill 95% of canvas for tight export
            img = export_wn.process(img, {"enabled": True, "target_fill": 0.95})
            img = export_center.process(img, {})
            processed = await asyncio.to_thread(pipeline.run, img, configs)
            export_name = export_names[icon.id]
            processed_icons[export_name] = (processed, icon_sizes)
            job["completed"] += 1

        if not processed_icons:
            job["status"] = "failed"
            job["error"] = "No icons to export"
            return

        zip_data = await asyncio.to_thread(
            build_zip, icons=processed_icons, pack_name=project.name,
            sizes=sizes, formats=formats, sharpen_below=profile.output.sharpen_below,
            profile_name=profile.name,
            svg_smoothing=svg_smoothing, svg_optimize=svg_optimize,
        )

        export_dir = state.data_dir / "cache" / "exports"
        export_dir.mkdir(parents=True, exist_ok=True)
        export_path = export_dir / f"{job_id}.zip"
        export_path.write_bytes(zip_data)

        job["status"] = "completed"
        job["result_path"] = str(export_path)

    except Exception as e:
        job["status"] = "failed"
        job["error"] = str(e)[:200]

    await asyncio.sleep(600)
    if job.get("result_path"):
        p = pathlib.Path(job["result_path"])
        if p.exists():
            p.unlink()
    _export_jobs.pop(job_id, None)


@router.get("/api/projects/{project_id}/export/{job_id}/status")
async def export_status(project_id: str, job_id: str):
    job = _export_jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Export job not found")
    return {
        "status": job["status"], "completed": job["completed"],
        "total": job["total"], "current_icon": job["current_icon"],
        "error": job.get("error"),
    }


@router.get("/api/projects/{project_id}/export/{job_id}/download")
async def export_download(project_id: str, job_id: str, request: Request):
    job = _export_jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Export job not found")
    if job["status"] != "completed":
        raise HTTPException(status_code=400, detail="Export not ready")

    result_path = pathlib.Path(job["result_path"])
    if not result_path.exists():
        raise HTTPException(status_code=404, detail="Export file not found")

    project = request.app.state.app_state.projects.get(project_id)
    name = project.name if project else "export"

    return Response(
        content=result_path.read_bytes(),
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="needicons-{name}.zip"'},
    )
