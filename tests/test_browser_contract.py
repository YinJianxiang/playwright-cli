import pytest

from ad_control.browser import BrowserAutomation, _validate_target
from ad_control.config import Settings


def test_only_allowlisted_hosts_are_accepted():
    _validate_target("http://192.168.0.215/rules", {"192.168.0.215"})
    with pytest.raises(RuntimeError, match="not allowed"):
        _validate_target("https://example.com", {"192.168.0.215"})


def test_rule_result_requires_numeric_id():
    assert BrowserAutomation._parse_result('{"success":true,"rule_id":"123","url":"http://app/rule/123"}')[:2] == (True, "123")
    assert BrowserAutomation._parse_result('{"success":true,"rule_id":"abc"}')[:2] == (False, None)


def test_credentials_are_scoped_to_allowed_domain():
    settings = Settings(
        siliconflow_api_key="dummy",
        e2e_user="user",
        e2e_password="password",
        e2e_captcha="123456",
        e2e_login_url="http://internal.example/login",
    )
    credentials = settings.browser_credentials()
    assert "http://internal.example" in credentials
    assert set(credentials["http://internal.example"]) == {"username", "password", "captcha"}


def test_browser_credentials_are_unwrapped_only_for_agent():
    settings = Settings(siliconflow_api_key="dummy", e2e_user="user", e2e_password="pass", e2e_captcha="123456")
    credentials = settings.browser_credentials()
    assert all(value == {"username": "user", "password": "pass", "captcha": "123456"} for value in credentials.values())
