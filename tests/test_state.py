import shutil
from pathlib import Path
from uuid import uuid4

from ad_control.models import CaseSpec, RunStatus, SeedPlan
from ad_control.state import LocalRunStore


def test_atomic_store_and_status():
    tmp_path = Path(".local") / "test-state" / str(uuid4())
    case = CaseSpec(case_id="case", media="toutiao", product="cpsvideomf", delivery_scope="global", dimension="project", expected="miss", conditions=[])
    plan = SeedPlan(case=case, knowledge_version="v1")
    store = LocalRunStore(tmp_path)
    try:
        store.create(plan)
        updated = store.set_status(plan.run_id, RunStatus.APPROVED)
        assert updated.status == RunStatus.APPROVED
        assert store.get(plan.run_id).status == RunStatus.APPROVED
        assert not list(tmp_path.glob("*.tmp"))
    finally:
        shutil.rmtree(tmp_path, ignore_errors=True)
