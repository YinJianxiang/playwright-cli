from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from pydantic import BaseModel, Field


DEFAULT_ROOT = Path(".cursor/skills/domains/ad-control/knowledge")
REQUIRED_FILES = ("manifest.json", "dimensions.json", "conditions.json", "actions.json", "seed-runtime-v3.json")


class KnowledgeValidation(BaseModel):
    valid: bool
    version: str
    files: list[str]
    errors: list[str] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)


@dataclass(frozen=True)
class KnowledgeBase:
    root: Path = DEFAULT_ROOT

    def load(self, name: str) -> dict[str, Any]:
        path = self.root / name
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            raise ValueError(f"Cannot load knowledge file {path}: {exc}") from exc
        if not isinstance(data, dict):
            raise ValueError(f"Knowledge file must contain an object: {path}")
        return data

    def version(self) -> str:
        manifest = self.load("manifest.json")
        declared = manifest.get("version") or manifest.get("knowledgeVersion")
        if declared:
            return str(declared)
        digest = hashlib.sha256()
        for name in REQUIRED_FILES:
            digest.update((self.root / name).read_bytes())
        return f"sha256:{digest.hexdigest()}"

    def validate(self) -> KnowledgeValidation:
        errors: list[str] = []
        warnings: list[str] = []
        loaded: dict[str, dict[str, Any]] = {}
        for name in REQUIRED_FILES:
            try:
                loaded[name] = self.load(name)
            except ValueError as exc:
                errors.append(str(exc))
        if errors:
            return KnowledgeValidation(valid=False, version="unknown", files=list(loaded), errors=errors)
        for name in ("dimensions.json", "conditions.json", "actions.json"):
            entries = loaded[name].get("entries")
            if not isinstance(entries, list) or not entries:
                errors.append(f"{name}: entries must be a non-empty array")
        runtime = loaded["seed-runtime-v3.json"]
        for key in ("tables", "metrics", "filters"):
            if key not in runtime:
                errors.append(f"seed-runtime-v3.json: missing {key}")
        if loaded["manifest.json"].get("schemaVersion") is None:
            warnings.append("manifest.json: schemaVersion is missing")
        return KnowledgeValidation(
            valid=not errors,
            version=self.version(),
            files=list(REQUIRED_FILES),
            errors=errors,
            warnings=warnings,
        )

    def find_metric(self, *, product: str, dimension: str, time_type: str, column: str) -> dict[str, Any]:
        runtime = self.load("seed-runtime-v3.json")
        metrics = runtime.get("metrics", [])
        for metric in metrics:
            if (
                str(metric.get("column")) == column
                and product in metric.get("plines", [])
                and metric.get("status") == "verified"
            ):
                required_release = metric.get("requireReleaseVer")
                table_exists = any(
                    table.get("plineForm") == product
                    and table.get("dataType") == dimension
                    and table.get("timeGrain") == ("day" if time_type == "0" else "hour")
                    and (required_release is None or table.get("releaseVer") == required_release)
                    for table in runtime.get("tables", [])
                )
                if table_exists:
                    return metric
        raise LookupError(f"No verified metric recipe for {product}|{dimension}|{time_type}|{column}")

    def find_table(self, *, product: str, dimension: str, time_type: str, metric: dict[str, Any]) -> dict[str, Any]:
        required_release = metric.get("requireReleaseVer")
        candidates = [table for table in self.load("seed-runtime-v3.json").get("tables", []) if (
            table.get("plineForm") == product
            and table.get("dataType") == dimension
            and table.get("timeGrain") == ("day" if time_type == "0" else "hour")
            and (required_release is None or table.get("releaseVer") == required_release)
        )]
        if not candidates:
            raise LookupError(f"No fact table for {product}|{dimension}|{time_type}|{metric.get('column')}")
        return sorted(candidates, key=lambda item: (item.get("releaseVer") or 0), reverse=True)[0]
