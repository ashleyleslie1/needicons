"""Pack and requirement API endpoints."""
from __future__ import annotations
from fastapi import APIRouter, Request, HTTPException
from needicons.core.models import Pack, Requirement

router = APIRouter(tags=["packs"])


@router.post("/api/packs")
async def create_pack(request: Request):
    body = await request.json()
    pack = Pack(**body)
    state = request.app.state.app_state
    state.packs[pack.id] = pack
    state.save_data()
    return pack.model_dump()


@router.get("/api/packs")
async def list_packs(request: Request):
    state = request.app.state.app_state
    return [p.model_dump() for p in state.packs.values()]


@router.get("/api/packs/{pack_id}")
async def get_pack(pack_id: str, request: Request):
    state = request.app.state.app_state
    pack = state.packs.get(pack_id)
    if not pack:
        raise HTTPException(status_code=404, detail="Pack not found")
    return pack.model_dump()


@router.put("/api/packs/{pack_id}")
async def update_pack(pack_id: str, request: Request):
    state = request.app.state.app_state
    pack = state.packs.get(pack_id)
    if not pack:
        raise HTTPException(status_code=404, detail="Pack not found")
    body = await request.json()
    for key, value in body.items():
        if hasattr(pack, key):
            setattr(pack, key, value)
    state.save_data()
    return pack.model_dump()


@router.delete("/api/packs/{pack_id}")
async def delete_pack(pack_id: str, request: Request):
    state = request.app.state.app_state
    if pack_id not in state.packs:
        raise HTTPException(status_code=404, detail="Pack not found")
    del state.packs[pack_id]
    state.save_data()
    return {"status": "deleted"}


@router.post("/api/packs/{pack_id}/requirements")
async def add_requirements(pack_id: str, request: Request):
    state = request.app.state.app_state
    pack = state.packs.get(pack_id)
    if not pack:
        raise HTTPException(status_code=404, detail="Pack not found")
    items = await request.json()
    reqs = []
    for item in items:
        req = Requirement(**item)
        pack.requirements.append(req)
        reqs.append(req.model_dump())
    state.save_data()
    return reqs


@router.delete("/api/requirements/{req_id}")
async def delete_requirement(req_id: str, request: Request):
    state = request.app.state.app_state
    for pack in state.packs.values():
        pack.requirements = [r for r in pack.requirements if r.id != req_id]
    state.save_data()
    return {"status": "deleted"}
