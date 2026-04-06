"""Processing profile API endpoints."""
from __future__ import annotations
from fastapi import APIRouter, Request, HTTPException
from needicons.core.models import ProcessingProfile, MaskConfig, StrokeConfig

router = APIRouter(prefix="/api/profiles", tags=["profiles"])


@router.post("")
async def create_profile(request: Request):
    body = await request.json()
    profile = ProcessingProfile(**body)
    state = request.app.state.app_state
    state.profiles[profile.id] = profile
    state.save_data()
    return profile.model_dump()


@router.get("")
async def list_profiles(request: Request):
    state = request.app.state.app_state
    return [p.model_dump() for p in state.profiles.values()]


@router.put("/{profile_id}")
async def update_profile(profile_id: str, request: Request):
    state = request.app.state.app_state
    profile = state.profiles.get(profile_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    body = await request.json()
    updated = profile.model_copy(update={
        k: type(getattr(profile, k))(**v) if isinstance(v, dict) and hasattr(profile, k) else v
        for k, v in body.items()
        if hasattr(profile, k)
    })
    state.profiles[profile_id] = updated
    state.save_data()
    return updated.model_dump()
