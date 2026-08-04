import json
import os
from pathlib import Path

import allure
import pytest

from ad_control.config import get_settings
from ad_control.flow import FlowRunner

MANIFEST = Path(".local/generated-cases/new-media-free-promotion-runs.json")


def generated_runs():
    if not MANIFEST.exists():
        return []
    return [
        pytest.param(row["run_id"], row["plan"]["case"]["case_id"], id=row["plan"]["case"]["case_id"])
        for row in json.loads(MANIFEST.read_text(encoding="utf-8"))
    ]


@pytest.mark.e2e
@pytest.mark.parametrize("run_id,case_id", generated_runs())
@pytest.mark.skipif(os.getenv("E2E_RUN_E2E") != "1", reason="set E2E_RUN_E2E=1")
async def test_generated_ad_control_flow(run_id: str, case_id: str):
    allure.dynamic.title(case_id)
    allure.dynamic.feature("新媒体-免费短剧")
    allure.dynamic.story("广告维度-当天-模型预测ROI与消耗")
    allure.dynamic.parameter("run_id", run_id)
    result = await FlowRunner(get_settings()).run(run_id, confirmed=True)
    allure.attach(result.model_dump_json(indent=2), "flow-result.json", allure.attachment_type.JSON)
    assert result.success
    assert result.cleanup_status == "cleaned"
