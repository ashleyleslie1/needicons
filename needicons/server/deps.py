"""FastAPI dependency injection with SQLite persistence."""
from __future__ import annotations
from pathlib import Path
from typing import Any
import yaml
from needicons.server.storage.base import StorageBackend
from needicons.server.queue.base import QueueBackend
from needicons.server.auth.base import AuthBackend
from needicons.server.db import SqliteStore


class DirtyDict(dict):
    """dict that tracks which keys have been set or deleted since last flush."""

    def __setitem__(self, key, value):
        super().__setitem__(key, value)
        if not hasattr(self, "_dirty"):
            self._dirty: set[str] = set()
            self._deleted: set[str] = set()
        self._dirty.add(key)
        self._deleted.discard(key)

    def __delitem__(self, key):
        super().__delitem__(key)
        if not hasattr(self, "_dirty"):
            self._dirty = set()
            self._deleted: set[str] = set()
        self._deleted.add(key)
        self._dirty.discard(key)

    def pop(self, key, *args):
        result = super().pop(key, *args)
        if not hasattr(self, "_dirty"):
            self._dirty = set()
            self._deleted: set[str] = set()
        self._deleted.add(key)
        self._dirty.discard(key)
        return result

    def flush(self) -> tuple[set[str], set[str]]:
        dirty = getattr(self, "_dirty", set())
        deleted = getattr(self, "_deleted", set())
        self._dirty = set()
        self._deleted = set()
        return dirty, deleted


def _migrate_yaml_to_sqlite(data_dir: Path, db_path: Path) -> None:
    """One-time migration from YAML files to SQLite. Only runs if DB doesn't exist."""
    if db_path.exists():
        return

    yaml_files = {
        "profiles.yaml": "profiles",
        "projects.yaml": "projects",
        "generations.yaml": "generation_records",
        "jobs.yaml": "jobs",
    }

    has_yaml = any((data_dir / f).exists() for f in yaml_files)
    if not has_yaml:
        return

    # Open a temporary store just for migration
    store = SqliteStore(db_path)
    for filename, table in yaml_files.items():
        yaml_path = data_dir / filename
        if not yaml_path.exists():
            continue
        with open(yaml_path) as f:
            raw = yaml.safe_load(f) or {}
        if raw:
            store.upsert_many(table, [(k, v) for k, v in raw.items()])
        yaml_path.rename(yaml_path.with_suffix(".yaml.migrated"))
    store.close()


class AppState:
    def __init__(self, storage: StorageBackend, queue: QueueBackend, auth: AuthBackend, data_dir: Path):
        self.storage = storage
        self.queue = queue
        self.auth = auth
        self.data_dir = data_dir
        self._config_path = data_dir / "config.yaml"
        self._config: dict = self._load_config()

        # SQLite persistence
        db_path = data_dir / "needicons.db"
        _migrate_yaml_to_sqlite(data_dir, db_path)
        self._db = SqliteStore(db_path)

        # In-memory data stores (dirty-tracked, persisted to SQLite)
        self.profiles: DirtyDict = DirtyDict()
        self.jobs: DirtyDict = DirtyDict()
        self.generation_records: DirtyDict = DirtyDict()
        self.projects: DirtyDict = DirtyDict()
        self._load_data()
        self._ensure_default_project()

    def _load_data(self) -> None:
        from needicons.core.models import ProcessingProfile, Project, GenerationRecord

        for k, v in self._db.load_all("profiles").items():
            dict.__setitem__(self.profiles, k, ProcessingProfile(**v))

        for k, v in self._db.load_all("projects").items():
            dict.__setitem__(self.projects, k, Project(**v))

        for k, v in self._db.load_all("generation_records").items():
            dict.__setitem__(self.generation_records, k, GenerationRecord(**v))

        for k, v in self._db.load_all("jobs").items():
            if v.get("status") == "running":
                v["status"] = "resumable"
            dict.__setitem__(self.jobs, k, v)

    def save_data(self) -> None:
        """Write only changed records to SQLite."""
        dirty, deleted = self.profiles.flush()
        if dirty:
            self._db.upsert_many("profiles", [(k, self.profiles[k].model_dump()) for k in dirty if k in self.profiles])
        if deleted:
            self._db.delete_many("profiles", deleted)

        dirty, deleted = self.projects.flush()
        if dirty:
            self._db.upsert_many("projects", [(k, self.projects[k].model_dump(mode="json")) for k in dirty if k in self.projects])
        if deleted:
            self._db.delete_many("projects", deleted)

        dirty, deleted = self.generation_records.flush()
        if dirty:
            self._db.upsert_many("generation_records", [(k, self.generation_records[k].model_dump(mode="json")) for k in dirty if k in self.generation_records])
        if deleted:
            self._db.delete_many("generation_records", deleted)

        self.save_jobs()

    def save_jobs(self) -> None:
        dirty, deleted = self.jobs.flush()
        if dirty:
            self._db.upsert_many("jobs", [(k, self.jobs[k]) for k in dirty if k in self.jobs])
        if deleted:
            self._db.delete_many("jobs", deleted)

    def _ensure_default_project(self) -> None:
        if not self.projects:
            from needicons.core.models import Project
            default = Project(name="My Icons")
            self.projects[default.id] = default
            self.save_data()

    def _load_config(self) -> dict:
        if self._config_path.exists():
            with open(self._config_path) as f:
                return yaml.safe_load(f) or {}
        return {"provider": {"api_key": "", "default_model": "dall-e-3"}, "edition": "oss"}

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

    @property
    def edition(self) -> str:
        import os
        env_edition = os.environ.get("NEEDICONS_EDITION", "").lower()
        if env_edition in ("oss", "commercial"):
            return env_edition
        return self._config.get("edition", "oss")
