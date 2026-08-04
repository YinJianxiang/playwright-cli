import os

import pytest

from ad_control.config import get_settings


@pytest.mark.browser
@pytest.mark.skipif(os.getenv("E2E_RUN_BROWSER") != "1", reason="set E2E_RUN_BROWSER=1")
def test_browser_profile_and_allowed_hosts_are_configured():
    settings = get_settings()
    assert settings.e2e_browser_profile
    assert settings.e2e_rule_url
    assert settings.allowed_hosts
