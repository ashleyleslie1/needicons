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
            # Generation queue: tracks per-prompt status for batch generation
            self._conn.execute("""
                CREATE TABLE IF NOT EXISTS generation_queue (
                    id TEXT PRIMARY KEY,
                    job_id TEXT NOT NULL,
                    project_id TEXT NOT NULL,
                    idx INTEGER NOT NULL,
                    name TEXT NOT NULL,
                    prompt TEXT NOT NULL,
                    style TEXT NOT NULL,
                    model TEXT NOT NULL,
                    api_quality TEXT DEFAULT '',
                    mood TEXT DEFAULT '',
                    ai_enhance INTEGER DEFAULT 0,
                    variations INTEGER DEFAULT 4,
                    status TEXT DEFAULT 'pending',
                    error TEXT,
                    attempts INTEGER DEFAULT 0,
                    record_id TEXT,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                )
            """)
            self._conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_queue_job ON generation_queue (job_id)"
            )
            self._conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_queue_status ON generation_queue (status)"
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

    # --- Generation queue helpers ---

    def insert_queue_items(self, items: list[dict]) -> None:
        if not items:
            return
        with self._lock, self._conn:
            self._conn.executemany(
                """INSERT OR REPLACE INTO generation_queue
                   (id, job_id, project_id, idx, name, prompt, style, model,
                    api_quality, mood, ai_enhance, variations, status, error,
                    attempts, record_id, created_at, updated_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                [(i["id"], i["job_id"], i["project_id"], i["idx"], i["name"],
                  i["prompt"], i["style"], i["model"], i.get("api_quality", ""),
                  i.get("mood", ""), int(i.get("ai_enhance", False)),
                  i.get("variations", 4), i.get("status", "pending"),
                  i.get("error"), i.get("attempts", 0), i.get("record_id"),
                  i["created_at"], i["updated_at"])
                 for i in items],
            )

    def update_queue_item(self, item_id: str, **fields) -> None:
        if not fields:
            return
        sets = ", ".join(f"{k} = ?" for k in fields)
        vals = list(fields.values())
        vals.append(item_id)
        with self._lock, self._conn:
            self._conn.execute(
                f"UPDATE generation_queue SET {sets} WHERE id = ?", vals
            )

    def get_queue_items(self, job_id: str) -> list[dict]:
        rows = self._conn.execute(
            """SELECT id, job_id, project_id, idx, name, prompt, style, model,
                      api_quality, mood, ai_enhance, variations, status, error,
                      attempts, record_id, created_at, updated_at
               FROM generation_queue WHERE job_id = ? ORDER BY idx""",
            (job_id,),
        ).fetchall()
        cols = ["id", "job_id", "project_id", "idx", "name", "prompt", "style",
                "model", "api_quality", "mood", "ai_enhance", "variations",
                "status", "error", "attempts", "record_id", "created_at", "updated_at"]
        return [dict(zip(cols, row)) for row in rows]

    def get_queue_item(self, item_id: str) -> dict | None:
        row = self._conn.execute(
            """SELECT id, job_id, project_id, idx, name, prompt, style, model,
                      api_quality, mood, ai_enhance, variations, status, error,
                      attempts, record_id, created_at, updated_at
               FROM generation_queue WHERE id = ?""",
            (item_id,),
        ).fetchone()
        if not row:
            return None
        cols = ["id", "job_id", "project_id", "idx", "name", "prompt", "style",
                "model", "api_quality", "mood", "ai_enhance", "variations",
                "status", "error", "attempts", "record_id", "created_at", "updated_at"]
        return dict(zip(cols, row))

    def get_pending_queue_items(self, job_id: str) -> list[dict]:
        """Get items that still need processing (pending or failed with retries left)."""
        rows = self._conn.execute(
            """SELECT id, job_id, project_id, idx, name, prompt, style, model,
                      api_quality, mood, ai_enhance, variations, status, error,
                      attempts, record_id, created_at, updated_at
               FROM generation_queue
               WHERE job_id = ? AND status IN ('pending', 'generating')
               ORDER BY idx""",
            (job_id,),
        ).fetchall()
        cols = ["id", "job_id", "project_id", "idx", "name", "prompt", "style",
                "model", "api_quality", "mood", "ai_enhance", "variations",
                "status", "error", "attempts", "record_id", "created_at", "updated_at"]
        return [dict(zip(cols, row)) for row in rows]

    def delete_queue_items(self, job_id: str) -> None:
        with self._lock, self._conn:
            self._conn.execute("DELETE FROM generation_queue WHERE job_id = ?", (job_id,))

    def close(self) -> None:
        self._conn.close()
