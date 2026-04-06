"""Queue backend abstract base class."""
from __future__ import annotations
from abc import ABC, abstractmethod
from typing import Any, Callable, Coroutine
from needicons.core.models import JobStatus


class QueueBackend(ABC):
    @abstractmethod
    async def enqueue(self, task: Callable[[], Coroutine[Any, Any, Any]]) -> str:
        """Enqueue an async task. Returns job ID."""
        ...

    @abstractmethod
    async def get_status(self, job_id: str) -> JobStatus:
        """Get job status."""
        ...

    @abstractmethod
    async def get_result(self, job_id: str) -> Any:
        """Get job result. Raises if not completed."""
        ...
