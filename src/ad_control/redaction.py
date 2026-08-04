from __future__ import annotations

import re
from collections.abc import Mapping
from typing import Any

SENSITIVE = re.compile(r"(api[_-]?key|password|authorization|cookie|token|secret)", re.I)
BEARER = re.compile(r"(?i)bearer\s+[A-Za-z0-9._~+/=-]+")


def redact(value: Any) -> Any:
    if isinstance(value, Mapping):
        return {key: "[REDACTED]" if SENSITIVE.search(str(key)) else redact(item) for key, item in value.items()}
    if isinstance(value, list):
        return [redact(item) for item in value]
    if isinstance(value, tuple):
        return tuple(redact(item) for item in value)
    if isinstance(value, str):
        return BEARER.sub("Bearer [REDACTED]", value)
    return value
