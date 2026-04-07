"""Pipeline preview and export API endpoints."""
from __future__ import annotations
import hashlib
import io
import json
from fastapi import APIRouter, Request, HTTPException
from fastapi.responses import Response
from PIL import Image
from needicons.core.pipeline import build_default_pipeline
from needicons.core.export.packager import build_zip
from needicons.core.models import ProcessingProfile

router = APIRouter(tags=["pipeline"])


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


@router.get("/api/projects/{project_id}/icons/{icon_id}/preview")
async def preview_icon(project_id: str, icon_id: str, request: Request):
    """Return a 256x256 preview of an icon with the project's post-processing applied."""
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

    # Check disk cache
    cache_key = _settings_hash(project, icon_id)
    cache_dir = state.data_dir / "cache" / "previews"
    cache_file = cache_dir / f"{cache_key}.png"
    if cache_file.exists():
        return Response(content=cache_file.read_bytes(), media_type="image/png")

    profile = _project_settings_to_profile(project)
    profile.background_removal.enabled = False
    profile.output.sizes = [256]
    profile.output.formats = ["png"]

    gpu_provider = state.config.get("gpu", {}).get("provider", "auto")
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

    # Write to cache
    cache_dir.mkdir(parents=True, exist_ok=True)
    cache_file.write_bytes(png_bytes)

    return Response(content=png_bytes, media_type="image/png")


@router.post("/api/projects/{project_id}/export")
async def export_project(project_id: str, request: Request):
    state = request.app.state.app_state
    project = state.projects.get(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    body = await request.json()
    sizes = body.get("sizes", [256, 128, 64, 32])
    formats = body.get("formats", ["png"])

    profile = _project_settings_to_profile(project)
    profile.background_removal.enabled = False  # already done during generation
    profile.output.sizes = []  # skip resize step — build_zip handles multi-size

    gpu_provider = state.config.get("gpu", {}).get("provider", "auto")
    pipeline = build_default_pipeline()
    configs = _profile_to_configs(profile, gpu_provider)

    processed_icons = {}
    for icon in project.icons:
        source_file = state.data_dir / icon.source_path
        if not source_file.exists():
            continue
        img = Image.open(source_file).convert("RGBA")
        processed = pipeline.run(img, configs)
        processed_icons[icon.name] = processed

    if not processed_icons:
        raise HTTPException(status_code=400, detail="No icons to export")

    zip_data = build_zip(
        icons=processed_icons,
        pack_name=project.name,
        sizes=sizes,
        formats=formats,
        sharpen_below=profile.output.sharpen_below,
        profile_name=profile.name,
    )

    return Response(
        content=zip_data,
        media_type="application/zip",
        headers={
            "Content-Disposition": f'attachment; filename="needicons-{project.name}.zip"',
        },
    )


