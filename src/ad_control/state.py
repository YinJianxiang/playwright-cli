from __future__ import annotations

import json
import os
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Callable

from filelock import FileLock

from .models import RunRecord, RunStatus, SeedPlan


class LocalRunStore:
    def __init__(self, root: Path):
        self.root = root
        self.root.mkdir(parents=True, exist_ok=True)

    def _path(self, run_id: str) -> Path:
        if not run_id or any(char not in "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_" for char in run_id):
            raise ValueError("Invalid run_id")
        return self.root / f"{run_id}.json"

    def _lock(self, run_id: str) -> FileLock:
        return FileLock(str(self._path(run_id)) + ".lock", timeout=10)

    def _write(self, record: RunRecord) -> None:
        target = self._path(record.run_id)
        payload = record.model_dump_json(indent=2)
        fd, temporary = tempfile.mkstemp(prefix=f".{record.run_id}-", suffix=".tmp", dir=self.root)
        try:
            with os.fdopen(fd, "w", encoding="utf-8", newline="\n") as stream:
                stream.write(payload)
                stream.flush()
                os.fsync(stream.fileno())
            os.replace(temporary, target)
        finally:
            if os.path.exists(temporary):
                os.unlink(temporary)

    def create(self, plan: SeedPlan) -> RunRecord:
        record = RunRecord(run_id=plan.run_id, status=RunStatus.PLANNED, plan=plan)
        with self._lock(plan.run_id):
            if self._path(plan.run_id).exists():
                raise FileExistsError(f"Run already exists: {plan.run_id}")
            self._write(record)
        return record

    def get(self, run_id: str) -> RunRecord:
        with self._lock(run_id):
            try:
                return RunRecord.model_validate_json(self._path(run_id).read_text(encoding="utf-8"))
            except FileNotFoundError as exc:
                raise KeyError(f"Unknown run: {run_id}") from exc

    def update(self, run_id: str, mutate: Callable[[RunRecord], RunRecord]) -> RunRecord:
        with self._lock(run_id):
            path = self._path(run_id)
            try:
                current = RunRecord.model_validate_json(path.read_text(encoding="utf-8"))
            except FileNotFoundError as exc:
                raise KeyError(f"Unknown run: {run_id}") from exc
            updated = mutate(current)
            updated.updated_at = datetime.now(timezone.utc)
            self._write(updated)
            return updated

    def set_status(self, run_id: str, status: RunStatus, *, error: str | None = None) -> RunRecord:
        def mutate(record: RunRecord) -> RunRecord:
            record.status = status
            record.error = error
            return record
        return self.update(run_id, mutate)

    def list_recoverable(self) -> list[RunRecord]:
        terminal = {RunStatus.SUCCEEDED, RunStatus.CANCELLED, RunStatus.CLEANED}
        records: list[RunRecord] = []
        for path in self.root.glob("*.json"):
            try:
                record = RunRecord.model_validate_json(path.read_text(encoding="utf-8"))
                if record.status not in terminal:
                    records.append(record)
            except (OSError, ValueError):
                continue
        return records

