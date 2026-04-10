"""SQLite persistence layer for NeedIcons."""
from __future__ import annotations
import json
import sqlite3
import threading
from pathlib import Path


class SqliteStore:
    _TABLES = ("projects", "generation_records", "profiles", "jobs")

    def __init__(self, db_path: Path) -> None:
        db_path.parent.mkdir(parents=True, exist_ok=True)
        self._conn = sqlite3.connect(str(db_path), check_same_thread=False)
        self._conn.execute("PRAGMA journal_mode=WAL")
        self._lock = threading.Lock()
        self._create_schema()

    def _create_schema(self) -> None:
        with self._lock, self._conn:
            for table in self._TABLES:
                self._conn.execute(
                    f"CREATE TABLE IF NOT EXISTS {table} "
                    "(id TEXT PRIMARY KEY, data TEXT NOT NULL)"
                )

    def load_all(self, table: str) -> dict[str, dict]:
        rows = self._conn.execute(f"SELECT id, data FROM {table}").fetchall()
        return {row[0]: json.loads(row[1]) for row in rows}

    def upsert(self, table: str, record_id: str, data: dict) -> None:
        with self._lock, self._conn:
            self._conn.execute(
                f"INSERT OR REPLACE INTO {table} (id, data) VALUES (?, ?)",
                (record_id, json.dumps(data)),
            )

    def upsert_many(self, table: str, items: list[tuple[str, dict]]) -> None:
        if not items:
            return
        with self._lock, self._conn:
            self._conn.executemany(
                f"INSERT OR REPLACE INTO {table} (id, data) VALUES (?, ?)",
                [(rid, json.dumps(d)) for rid, d in items],
            )

    def delete(self, table: str, record_id: str) -> None:
        with self._lock, self._conn:
            self._conn.execute(f"DELETE FROM {table} WHERE id = ?", (record_id,))

    def delete_many(self, table: str, ids: set[str]) -> None:
        if not ids:
            return
        with self._lock, self._conn:
            self._conn.executemany(
                f"DELETE FROM {table} WHERE id = ?",
                [(rid,) for rid in ids],
            )

    def close(self) -> None:
        self._conn.close()
