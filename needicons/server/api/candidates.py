"""Candidate API endpoints."""
from __future__ import annotations
from fastapi import APIRouter, Request, HTTPException
from needicons.core.models import RequirementStatus

router = APIRouter(tags=["candidates"])


def _find_requirement(state, req_id: str):
    for pack in state.packs.values():
        for req in pack.requirements:
            if req.id == req_id:
                return req
    return None


def _find_candidate(state, cand_id: str):
    for pack in state.packs.values():
        for req in pack.requirements:
            for cand in req.candidates:
                if cand.id == cand_id:
                    return req, cand
    return None, None


@router.get("/api/requirements/{req_id}/candidates")
async def list_candidates(req_id: str, request: Request):
    state = request.app.state.app_state
    req = _find_requirement(state, req_id)
    if not req:
        raise HTTPException(status_code=404, detail="Requirement not found")
    return [c.model_dump() for c in req.candidates]


@router.post("/api/candidates/{cand_id}/pick")
async def pick_candidate(cand_id: str, request: Request):
    state = request.app.state.app_state
    req, cand = _find_candidate(state, cand_id)
    if not cand:
        raise HTTPException(status_code=404, detail="Candidate not found")
    for c in req.candidates:
        c.selected = False
    cand.selected = True
    req.status = RequirementStatus.ACCEPTED
    state.save_data()
    return cand.model_dump()


@router.delete("/api/candidates/{cand_id}")
async def delete_candidate(cand_id: str, request: Request):
    state = request.app.state.app_state
    req, cand = _find_candidate(state, cand_id)
    if not cand:
        raise HTTPException(status_code=404, detail="Candidate not found")
    req.candidates = [c for c in req.candidates if c.id != cand_id]
    state.save_data()
    return {"status": "deleted"}
