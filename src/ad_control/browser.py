"""Browser automation for ad-control rule creation.

NOTE: This is a minimal skeleton. Concrete methods will be filled in after
manually walking through the real UI to record accurate page structure.
"""

from __future__ import annotations

from typing import Any

from .config import Settings
from .evidence import EvidenceWriter
from .models import CaseSpec, RuleCreateResult


def _validate_target(url: str, allowed_hosts: set[str]) -> None:
    from urllib.parse import urlparse

    host = urlparse(url).hostname.lower()
    if not host:
        raise RuntimeError(f"Refusing navigation to URL without host: {url}")
    if host not in allowed_hosts:
        raise RuntimeError(f"Target host not allowed: {host} (allowed: {sorted(allowed_hosts)})")


class BrowserAutomation:
    """Drives the ad-control rule UI.

    Methods are async and accept an EvidenceWriter for artifact collection.
    Implementations will be added incrementally after manual UI walkthrough.
    """

    def __init__(self, settings: Settings):
        self.settings = settings

    async def login(self, evidence: EvidenceWriter) -> dict[str, Any]:
        raise NotImplementedError("login: pending manual UI walkthrough")

    async def create_rule(self, case: CaseSpec, evidence: EvidenceWriter) -> RuleCreateResult:
        raise NotImplementedError("create_rule: pending manual UI walkthrough")

    async def verify_record(self, rule_id: str, case: CaseSpec, evidence: EvidenceWriter) -> dict[str, Any]:
        raise NotImplementedError("verify_record: pending manual UI walkthrough")
