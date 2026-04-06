"""Local async queue backend."""
from __future__ import annotations
import asyncio
import uuid
from typing import Any, Callable, Coroutine
from needicons.core.models import JobStatus
from needicons.server.queue.base import QueueBackend


class LocalQueue(QueueBackend):
    def __init__(self, max_workers: int = 4):
        self._jobs: dict[str, dict] = {}
        self._semaphore = asyncio.Semaphore(max_workers)

    async def enqueue(self, task: Callable[[], Coroutine[Any, Any, Any]]) -> str:
        job_id = uuid.uuid4().hex[:12]
        self._jobs[job_id] = {"status": JobStatus.PENDING, "result": None, "error": None}
        asyncio.create_task(self._run(job_id, task))
        return job_id

    async def _run(self, job_id: str, task: Callable) -> None:
        async with self._semaphore:
            self._jobs[job_id]["status"] = JobStatus.RUNNING
            try:
                result = await task()
                self._jobs[job_id]["status"] = JobStatus.COMPLETED
                self._jobs[job_id]["result"] = result
            except Exception as e:
                self._jobs[job_id]["status"] = JobStatus.FAILED
                self._jobs[job_id]["error"] = str(e)

    async def get_status(self, job_id: str) -> JobStatus:
        if job_id not in self._jobs:
            raise KeyError(f"Unknown job: {job_id}")
        return self._jobs[job_id]["status"]

    async def get_result(self, job_id: str) -> Any:
        job = self._jobs.get(job_id)
        if not job:
            raise KeyError(f"Unknown job: {job_id}")
        if job["status"] == JobStatus.FAILED:
            raise RuntimeError(job["error"])
        if job["status"] != JobStatus.COMPLETED:
            raise RuntimeError(f"Job not completed: {job['status']}")
        return job["result"]
