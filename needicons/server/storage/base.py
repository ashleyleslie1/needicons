"""Storage backend abstract base class."""
from __future__ import annotations
from abc import ABC, abstractmethod


class StorageBackend(ABC):
    @abstractmethod
    async def save(self, key: str, data: bytes) -> str:
        """Save data under key. Returns the storage path."""
        ...

    @abstractmethod
    async def load(self, key: str) -> bytes:
        """Load data by key. Raises FileNotFoundError if missing."""
        ...

    @abstractmethod
    async def delete(self, key: str) -> None:
        """Delete data by key."""
        ...

    @abstractmethod
    async def list(self, prefix: str) -> list[str]:
        """List all keys matching prefix."""
        ...
