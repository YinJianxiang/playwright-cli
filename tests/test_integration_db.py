import os

import pytest

from ad_control.config import get_settings
from ad_control.db import Database


@pytest.mark.integration
@pytest.mark.skipif(os.getenv("E2E_RUN_INTEGRATION") != "1", reason="set E2E_RUN_INTEGRATION=1")
async def test_database_ping_and_read_only_preflight():
    database = Database(get_settings())
    assert (await database.ping())["ok"]
    assert await database.read("SELECT 1 AS ok") == [{"ok": 1}]

