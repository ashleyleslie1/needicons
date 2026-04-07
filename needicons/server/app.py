"""FastAPI application factory."""
from __future__ import annotations
from pathlib import Path
from typing import Optional
from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import FileResponse as FastFileResponse
from needicons.server.deps import AppState
from needicons.server.storage.base import StorageBackend
from needicons.server.storage.local import LocalStorage
from needicons.server.queue.base import QueueBackend
from needicons.server.queue.local import LocalQueue
from needicons.server.auth.base import AuthBackend
from needicons.server.auth.local import LocalAuth
from needicons.server.api import api_router


def create_app(
    *,
    data_dir: Optional[str | Path] = None,
    storage_backend: Optional[StorageBackend] = None,
    queue_backend: Optional[QueueBackend] = None,
    auth_backend: Optional[AuthBackend] = None,
) -> FastAPI:
    if data_dir is None:
        data_dir = Path.home() / ".needicons"
    data_dir = Path(data_dir)
    data_dir.mkdir(parents=True, exist_ok=True)

    storage = storage_backend or LocalStorage(data_dir / "data")
    queue = queue_backend or LocalQueue()
    auth = auth_backend or LocalAuth()

    app = FastAPI(title="NeedIcons", version="0.1.0")
    app.state.app_state = AppState(storage=storage, queue=queue, auth=auth, data_dir=data_dir)
    app.include_router(api_router)

    @app.on_event("startup")
    async def _resume_jobs():
        from needicons.server.api.generate_v2 import resume_jobs
        resume_jobs(app.state.app_state)

    @app.get("/api/images/{path:path}")
    async def serve_image(path: str, request: Request):
        state = request.app.state.app_state
        file_path = state.data_dir / path
        if not file_path.is_file():
            raise HTTPException(status_code=404, detail="Image not found")
        return FastFileResponse(file_path)

    # Serve frontend static files if dist/ exists
    frontend_dist = Path(__file__).parent.parent.parent / "frontend" / "dist"
    if frontend_dist.is_dir():
        from starlette.responses import FileResponse

        @app.get("/{full_path:path}")
        async def serve_spa(full_path: str):
            if full_path.startswith("api/"):
                raise HTTPException(status_code=404, detail="Not found")
            file_path = frontend_dist / full_path
            if file_path.is_file():
                return FileResponse(file_path)
            return FileResponse(frontend_dist / "index.html")

    return app
