"""Job streaming via Server-Sent Events."""
from __future__ import annotations
import asyncio
import json
from fastapi import APIRouter, Request, HTTPException
from fastapi.responses import StreamingResponse

router = APIRouter(prefix="/api/jobs", tags=["jobs"])


@router.get("/{job_id}/stream")
async def stream_job(job_id: str, request: Request):
    state = request.app.state.app_state
    jobs = getattr(state, "jobs", {})
    if job_id not in jobs:
        raise HTTPException(status_code=404, detail="Job not found")

    async def event_stream():
        job = jobs[job_id]
        for event in job.get("events", []):
            yield f"data: {json.dumps(event)}\n\n"
        if job.get("status") in ("completed", "failed"):
            yield f"data: {json.dumps({'type': 'done', 'status': job['status']})}\n\n"
            return
        last_idx = len(job.get("events", []))
        while True:
            if await request.is_disconnected():
                break
            events = job.get("events", [])
            if len(events) > last_idx:
                for event in events[last_idx:]:
                    yield f"data: {json.dumps(event)}\n\n"
                last_idx = len(events)
            if job.get("status") in ("completed", "failed"):
                yield f"data: {json.dumps({'type': 'done', 'status': job['status']})}\n\n"
                break
            await asyncio.sleep(0.5)

    return StreamingResponse(event_stream(), media_type="text/event-stream")
