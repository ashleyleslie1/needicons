"""FastAPI dependency injection."""
from __future__ import annotations
from pathlib import Path
from typing import Any
import yaml
from needicons.server.storage.base import StorageBackend
from needicons.server.queue.base import QueueBackend
from needicons.server.auth.base import AuthBackend


class AppState:
    def __init__(self, storage: StorageBackend, queue: QueueBackend, auth: AuthBackend, data_dir: Path):
        self.storage = storage
        self.queue = queue
        self.auth = auth
        self.data_dir = data_dir
        self._config_path = data_dir / "config.yaml"
        self._config: dict = self._load_config()

    def _load_config(self) -> dict:
        if self._config_path.exists():
            with open(self._config_path) as f:
                return yaml.safe_load(f) or {}
        return {"provider": {"api_key": "", "default_model": "gpt-4o"}}

    def save_config(self) -> None:
        self._config_path.parent.mkdir(parents=True, exist_ok=True)
        with open(self._config_path, "w") as f:
            yaml.dump(self._config, f)

    @property
    def config(self) -> dict:
        return self._config

    def update_config(self, section: str, values: dict) -> None:
        self._config.setdefault(section, {}).update(values)
        self.save_config()
