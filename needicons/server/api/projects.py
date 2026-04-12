"""Project API endpoints."""
from __future__ import annotations
from fastapi import APIRouter, Request, HTTPException
from needicons.core.models import Project, PostProcessingSettings

router = APIRouter(tags=["projects"])


@router.get("/api/projects")
async def list_projects(request: Request):
    state = request.app.state.app_state
    return [p.model_dump() for p in state.projects.values()]


@router.post("/api/projects")
async def create_project(request: Request):
    state = request.app.state.app_state
    body = await request.json()
    project = Project(name=body.get("name", "Untitled"))
    state.projects[project.id] = project
    state.save_data()
    return project.model_dump()


@router.get("/api/projects/{project_id}")
async def get_project(project_id: str, request: Request):
    state = request.app.state.app_state
    project = state.projects.get(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project.model_dump()


@router.put("/api/projects/{project_id}")
async def update_project(project_id: str, request: Request):
    state = request.app.state.app_state
    project = state.projects.get(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    body = await request.json()
    if "name" in body:
        project.name = body["name"]
    if "style_preference" in body:
        project.style_preference = body["style_preference"]
    if "quality_preference" in body:
        project.quality_preference = body["quality_preference"]
    if "post_processing" in body:
        project.post_processing = PostProcessingSettings(**body["post_processing"])
    state.save_data()
    return project.model_dump()


@router.delete("/api/projects/{project_id}")
async def delete_project(project_id: str, request: Request):
    state = request.app.state.app_state
    if project_id not in state.projects:
        raise HTTPException(status_code=404, detail="Project not found")
    del state.projects[project_id]
    state.generation_records = {
        k: v for k, v in state.generation_records.items()
        if v.project_id != project_id
    }
    state.save_data()
    return {"status": "deleted"}


@router.post("/api/projects/{project_id}/icons/{icon_id}/auto-fit")
async def auto_fit_icon(project_id: str, icon_id: str, request: Request):
    """Compute optimal crop/zoom to fill canvas with icon content."""
    import numpy as np
    from PIL import Image
    state = request.app.state.app_state
    project = state.projects.get(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    icon = next((i for i in project.icons if i.id == icon_id), None)
    if not icon:
        raise HTTPException(status_code=404, detail="Icon not found")

    source_path = state.data_dir / icon.source_path
    if not source_path.exists():
        raise HTTPException(status_code=404, detail="Source not found")

    try:
        body = await request.json()
    except Exception:
        body = {}
    # Preserve current rotation unless explicitly overridden
    rotate = float(body.get("rotate", icon.crop_rotate))

    from needicons.core.pipeline.normalize import WeightNormalizationStep, CenteringStep

    img = Image.open(source_path).convert("RGBA")
    # Apply same normalization as export pipeline
    wn = WeightNormalizationStep()
    img = wn.process(img, {"enabled": True, "target_fill": 0.90})
    centering = CenteringStep()
    img = centering.process(img, {})

    # Apply rotation before computing bounds
    if rotate != 0:
        rotated = img.rotate(-rotate, resample=Image.BICUBIC, expand=True)
        rw, rh = rotated.size
        w, h = img.size
        left = (rw - w) // 2
        top = (rh - h) // 2
        analysis_img = rotated.crop((left, top, left + w, top + h))
    else:
        analysis_img = img

    arr = np.array(analysis_img)
    alpha = arr[:, :, 3]
    rows = np.any(alpha > 10, axis=1)
    cols = np.any(alpha > 10, axis=0)
    if not rows.any() or not cols.any():
        return {"crop_x": 0.0, "crop_y": 0.0, "crop_zoom": 1.0, "crop_rotate": rotate}

    rmin, rmax = np.where(rows)[0][[0, -1]]
    cmin, cmax = np.where(cols)[0][[0, -1]]

    h, w = arr.shape[:2]
    content_w = cmax - cmin
    content_h = rmax - rmin
    content_cx = (cmin + cmax) / 2
    content_cy = (rmin + rmax) / 2

    # Content is already normalized to ~90% fill, just tighten to ~95%
    zoom_x = w / (content_w * 1.05) if content_w > 0 else 1.0
    zoom_y = h / (content_h * 1.05) if content_h > 0 else 1.0
    zoom = min(zoom_x, zoom_y, 2.0)
    # Never zoom out below current state
    zoom = max(zoom, 1.0)

    pan_x = (content_cx - w / 2) / (w * 0.5) * -1
    pan_y = (content_cy - h / 2) / (h * 0.5) * -1
    pan_x = max(-1, min(1, pan_x))
    pan_y = max(-1, min(1, pan_y))

    icon.crop_x = pan_x
    icon.crop_y = pan_y
    icon.crop_zoom = zoom
    icon.crop_rotate = rotate
    state.save_data()

    return {"crop_x": pan_x, "crop_y": pan_y, "crop_zoom": zoom, "crop_rotate": rotate}


@router.put("/api/projects/{project_id}/icons/{icon_id}/crop")
async def update_icon_crop(project_id: str, icon_id: str, request: Request):
    state = request.app.state.app_state
    project = state.projects.get(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    icon = next((i for i in project.icons if i.id == icon_id), None)
    if not icon:
        raise HTTPException(status_code=404, detail="Icon not found")
    body = await request.json()
    icon.crop_x = max(-1, min(1, float(body.get("crop_x", icon.crop_x))))
    icon.crop_y = max(-1, min(1, float(body.get("crop_y", icon.crop_y))))
    icon.crop_zoom = max(0.5, min(3, float(body.get("crop_zoom", icon.crop_zoom))))
    icon.crop_rotate = float(body.get("crop_rotate", icon.crop_rotate)) % 360
    state.save_data()
    return icon.model_dump()


@router.delete("/api/projects/{project_id}/icons/{icon_id}")
async def remove_icon_from_project(project_id: str, icon_id: str, request: Request):
    state = request.app.state.app_state
    project = state.projects.get(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    # Find the icon to get its source path before removing
    removed_icon = next((i for i in project.icons if i.id == icon_id), None)
    if not removed_icon:
        raise HTTPException(status_code=404, detail="Icon not found in project")
    project.icons = [i for i in project.icons if i.id != icon_id]
    # Unpick the corresponding variation in generation records
    for record in state.generation_records.values():
        if record.project_id != project_id:
            continue
        for v in record.variations:
            if v.source_path == removed_icon.source_path and v.picked:
                v.picked = False
    state.save_data()
    return {"status": "deleted"}


@router.get("/api/projects/{project_id}/history")
async def get_generation_history(project_id: str, request: Request):
    state = request.app.state.app_state
    if project_id not in state.projects:
        raise HTTPException(status_code=404, detail="Project not found")
    records = [
        r.model_dump() for r in state.generation_records.values()
        if r.project_id == project_id
    ]
    records.sort(key=lambda r: r["created_at"], reverse=True)
    return records
