from __future__ import annotations

import httpx

from .browser import BrowserAutomation
from .config import Settings
from .evidence import EvidenceWriter
from .models import FlowResult, RunStatus
from .seed import SeedService
from .db import Database


class FlowRunner:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.seed = SeedService(settings)
        self.browser = BrowserAutomation(settings)

    async def run(self, run_id: str, *, confirmed: bool) -> FlowResult:
        if not confirmed:
            raise RuntimeError("Complete flow requires --confirmed")
        record = self.seed.store.get(run_id)
        evidence = EvidenceWriter(self.settings.e2e_artifact_dir, run_id)
        evidence.json("seed-plan", record.plan.model_dump(mode="json"))
        rule = None
        assertion = {}
        cleanup_status = "not_started"
        result = None
        try:
            await self.seed.preflight(run_id)
            if record.plan.operations:
                await self.seed.apply(run_id, confirmed=True)
            else:
                self.seed.store.set_status(run_id, RunStatus.APPLIED)
            self.seed.store.set_status(run_id, RunStatus.BROWSER_RUNNING)
            rule = await self.browser.create_rule(record.plan.case, evidence)
            if not rule.success or not rule.rule_id:
                raise RuntimeError("Browser flow did not return a persisted rule ID")
            self.seed.store.set_status(run_id, RunStatus.ASSERTING)
            assertion = await self._verify_rule(rule.rule_id)
            assertion["record"] = await self.browser.verify_record(rule.rule_id, record.plan.case, evidence)
            evidence.json("assertion", assertion)
            self.seed.store.set_status(run_id, RunStatus.SUCCEEDED)
            result = FlowResult(run_id=run_id, success=True, rule=rule, assertion=assertion, cleanup_status="pending")
        except Exception as exc:
            self.seed.store.set_status(run_id, RunStatus.FAILED, error=str(exc))
            evidence.json("failure", {"type": type(exc).__name__, "message": str(exc)})
            raise
        finally:
            if self.settings.e2e_seed_cleanup_policy == "always":
                current = self.seed.store.get(run_id)
                if current.plan.operations:
                    await self.seed.cleanup(run_id)
                cleanup_status = "cleaned"
                evidence.json("cleanup", {"status": cleanup_status})
        if result is None:
            raise RuntimeError("Flow ended without a result")
        return result.model_copy(update={"cleanup_status": cleanup_status})

    async def _verify_rule(self, rule_id: str) -> dict:
        rows = await Database(self.settings).read(
            "SELECT `id` FROM `ad_data_control_rule` WHERE `id` = %s LIMIT 1", [int(rule_id)]
        )
        if not rows:
            raise RuntimeError(f"Rule was not persisted in database: {rule_id}")
        result = {"rule_id": rule_id, "database_verified": True}
        template = self.settings.e2e_job_trigger_url_template
        if template:
            url = template.replace("{{rule_id}}", rule_id)
            _validate = __import__("ad_control.browser", fromlist=["_validate_target"])._validate_target
            _validate(url, self.settings.allowed_hosts)
            async with httpx.AsyncClient(timeout=60) as client:
                response = await client.get(url)
                response.raise_for_status()
            result["job_status_code"] = response.status_code
        return result
