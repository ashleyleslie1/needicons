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
    # Pass the active shape so weight normalization can auto-shrink
    # content to fit inside non-rectangular masks.
    shape = profile.mask.shape
    if shape != "none":
        wn_config["enabled"] = True
        wn_config["shape"] = shape

    return {
        "background_removal": bg_config,
        "edge_cleanup": profile.edge_cleanup.model_dump(),
        "weight_normalization": wn_config,
        "centering": {},
        "color": profile.color.model_dump(),
        "stroke": profile.stroke.model_dump(),
        "shape_mask": profile.mask.model_dump(),
        "background_fill": profile.fill.model_dump(),
        "drop_shadow": profile.shadow.model_dump(),
        "resize": profile.output.model_dump(),
    }


def _project_settings_to_profile(project) -> ProcessingProfile:
    """Build a ProcessingProfile from project post-processing settings."""
    pp = project.post_processing
    return ProcessingProfile(
        name=f"_{project.name}_export",
        stroke=pp.stroke,
        mask=pp.mask,
        fill=pp.fill,
        shadow=pp.shadow,
        padding=pp.padding,
    )


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
    profile.output.sizes = [256]
    profile.output.formats = ["png"]

    pipeline = build_default_pipeline()
    configs = _profile_to_configs(profile, gpu_provider)

    img = Image.open(source_file).convert("RGBA")
    if img.width > 512 or img.height > 512:
        img.thumbnail((512, 512), Image.LANCZOS)
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


@router.get("/api/projects/{project_id}/icons/{icon_id}/preview")
async def preview_icon(project_id: str, icon_id: str, request: Request):
    state = request.app.state.app_state
    project = state.projects.get(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    icon = next((i for i in project.icons if i.id == icon_id), None)
    if not icon:
        raise HTTPException(status_code=404, detail="Icon not found")

    source_file = state.data_dir / icon.source_path
    if not source_file.exists():
        raise HTTPException(status_code=404, detail="Source image not found")

    cache_key = _settings_hash(project, icon_id)
    cache_dir = state.data_dir / "cache" / "previews"
    cache_file = cache_dir / f"{cache_key}.png"
    if cache_file.exists():
        return Response(content=cache_file.read_bytes(), media_type="image/png")

    gpu_provider = state.config.get("gpu", {}).get("provider", "auto")
    png_bytes = await asyncio.to_thread(
        _render_preview_sync, source_file, project, cache_dir, cache_file, gpu_provider
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
        source_file = state.data_dir / icon.source_path
        if not source_file.exists():
            job["completed"] += 1
            continue
        cache_key = _settings_hash(project, icon.id)
        cache_file = cache_dir / f"{cache_key}.png"
        try:
            await asyncio.to_thread(
                _render_preview_sync, source_file, project, cache_dir, cache_file, gpu_provider
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


@router.post("/api/projects/{project_id}/export")
async def export_project(project_id: str, request: Request):
    state = request.app.state.app_state
    project = state.projects.get(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    body = await request.json()
    sizes = body.get("sizes", [256, 128, 64, 32])
    formats = body.get("formats", ["png"])

    if not project.icons:
        raise HTTPException(status_code=400, detail="No icons to export")

    from needicons.core.models import _new_id
    job_id = _new_id()
    _export_jobs[job_id] = {
        "status": "running", "total": len(project.icons),
        "completed": 0, "current_icon": "", "result_path": None, "error": None,
    }

    asyncio.create_task(_run_export(state, project, sizes, formats, job_id))
    return {"job_id": job_id, "total": len(project.icons)}


async def _run_export(state, project, sizes, formats, job_id: str):
    job = _export_jobs.get(job_id)
    if not job:
        return

    try:
        profile = _project_settings_to_profile(project)
        profile.background_removal.enabled = False
        profile.output.sizes = []

        gpu_provider = state.config.get("gpu", {}).get("provider", "auto")
        pipeline = build_default_pipeline()
        configs = _profile_to_configs(profile, gpu_provider)

        processed_icons = {}
        for icon in project.icons:
            job["current_icon"] = icon.name
            source_file = state.data_dir / icon.source_path
            if not source_file.exists():
                job["completed"] += 1
                continue
            img = Image.open(source_file).convert("RGBA")
            processed = await asyncio.to_thread(pipeline.run, img, configs)
            processed_icons[icon.name] = processed
            job["completed"] += 1

        if not processed_icons:
            job["status"] = "failed"
            job["error"] = "No icons to export"
            return

        zip_data = await asyncio.to_thread(
            build_zip, icons=processed_icons, pack_name=project.name,
            sizes=sizes, formats=formats, sharpen_below=profile.output.sharpen_below,
            profile_name=profile.name,
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
