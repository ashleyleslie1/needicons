"""Pipeline preview and export API endpoints."""
from __future__ import annotations
import io
from fastapi import APIRouter, Request, HTTPException
from fastapi.responses import Response
from PIL import Image
from needicons.core.pipeline import build_default_pipeline
from needicons.core.export.packager import build_zip
from needicons.core.models import RequirementStatus, ProcessingProfile

router = APIRouter(tags=["pipeline"])


def _profile_to_configs(profile) -> dict[str, dict]:
    """Convert a ProcessingProfile to pipeline runner configs dict."""
    return {
        "background_removal": profile.background_removal.model_dump(),
        "edge_cleanup": profile.edge_cleanup.model_dump(),
        "weight_normalization": profile.weight_normalization.model_dump(),
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
    profile.output.sizes = sizes
    profile.output.formats = formats

    pipeline = build_default_pipeline()
    configs = _profile_to_configs(profile)

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


@router.post("/api/packs/{pack_id}/export")
async def export_pack(pack_id: str, request: Request):
    state = request.app.state.app_state
    pack = state.packs.get(pack_id)
    if not pack:
        raise HTTPException(status_code=404, detail="Pack not found")

    body = await request.json()
    profile_id = body.get("profile_id")
    sizes = body.get("sizes", [256, 128, 64, 32])
    formats = body.get("formats", ["png"])

    profile = state.profiles.get(profile_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")

    pipeline = build_default_pipeline()
    configs = _profile_to_configs(profile)

    processed_icons = {}
    for req in pack.requirements:
        if req.status != RequirementStatus.ACCEPTED:
            continue
        selected = [c for c in req.candidates if c.selected]
        if not selected:
            continue
        cand = selected[0]
        source_file = state.data_dir / cand.source_path
        if not source_file.exists():
            continue
        img = Image.open(source_file).convert("RGBA")
        processed = pipeline.run(img, configs)
        processed_icons[req.name] = processed

    if not processed_icons:
        raise HTTPException(status_code=400, detail="No accepted icons to export")

    zip_data = build_zip(
        icons=processed_icons,
        pack_name=pack.name,
        sizes=sizes,
        formats=formats,
        sharpen_below=profile.output.sharpen_below,
        profile_name=profile.name,
    )

    return Response(
        content=zip_data,
        media_type="application/zip",
        headers={
            "Content-Disposition": f'attachment; filename="needicons-{pack.name}.zip"',
        },
    )
