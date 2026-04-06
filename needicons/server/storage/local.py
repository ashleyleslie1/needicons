"""Local filesystem storage backend."""
from __future__ import annotations
from pathlib import Path
import aiofiles
import aiofiles.os
from needicons.server.storage.base import StorageBackend


class LocalStorage(StorageBackend):
    def __init__(self, base_dir: str | Path):
        self._base = Path(base_dir)

    def _path(self, key: str) -> Path:
        return self._base / key

    async def save(self, key: str, data: bytes) -> str:
        path = self._path(key)
        path.parent.mkdir(parents=True, exist_ok=True)
        async with aiofiles.open(path, "wb") as f:
            await f.write(data)
        return str(path)

    async def load(self, key: str) -> bytes:
        path = self._path(key)
        if not path.exists():
            raise FileNotFoundError(f"No file at key: {key}")
        async with aiofiles.open(path, "rb") as f:
            return await f.read()

    async def delete(self, key: str) -> None:
        path = self._path(key)
        if path.exists():
            await aiofiles.os.remove(path)

    async def list(self, prefix: str) -> list[str]:
        base = self._path(prefix)
        if not base.exists():
            return []
        return [
            str(p.relative_to(self._base))
            for p in base.rglob("*")
            if p.is_file()
        ]
