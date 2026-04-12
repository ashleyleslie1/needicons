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
