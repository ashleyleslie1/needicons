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

        # In-memory data stores (persisted to YAML on change)
        self.packs: dict[str, Any] = {}
        self.profiles: dict[str, Any] = {}
        self._load_data()

    def _load_data(self) -> None:
        packs_file = self.data_dir / "packs.yaml"
        profiles_file = self.data_dir / "profiles.yaml"
        if packs_file.exists():
            with open(packs_file) as f:
                raw = yaml.safe_load(f) or {}
                from needicons.core.models import Pack
                self.packs = {k: Pack(**v) for k, v in raw.items()}
        if profiles_file.exists():
            with open(profiles_file) as f:
                raw = yaml.safe_load(f) or {}
                from needicons.core.models import ProcessingProfile
                self.profiles = {k: ProcessingProfile(**v) for k, v in raw.items()}

    def save_data(self) -> None:
        self.data_dir.mkdir(parents=True, exist_ok=True)
        with open(self.data_dir / "packs.yaml", "w") as f:
            yaml.dump({k: v.model_dump() for k, v in self.packs.items()}, f)
        with open(self.data_dir / "profiles.yaml", "w") as f:
            yaml.dump({k: v.model_dump() for k, v in self.profiles.items()}, f)

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
