from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from .redaction import redact


class EvidenceWriter:
    def __init__(self, root: Path, run_id: str):
        self.root = root / run_id
        self.root.mkdir(parents=True, exist_ok=True)

    def json(self, name: str, value: Any) -> Path:
        path = self.root / f"{name}.json"
        path.write_text(json.dumps(redact(value), ensure_ascii=False, indent=2, default=str), encoding="utf-8")
        self._attach(path, "application/json")
        return path

    def attach_existing(self, path: Path, mime: str | None = None) -> None:
        if path.exists() and path.is_file():
            self._attach(path, mime)

    @staticmethod
    def _attach(path: Path, mime: str | None = None) -> None:
        try:
            import allure
            allure.attach.file(str(path), name=path.name, attachment_type=mime)
        except Exception:
            pass

