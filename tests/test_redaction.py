from ad_control.redaction import redact


def test_secret_values_are_redacted():
    result = redact({"api_key": "abc", "nested": {"Authorization": "Bearer abc"}, "message": "Bearer xyz"})
    assert result["api_key"] == "[REDACTED]"
    assert result["nested"]["Authorization"] == "[REDACTED]"
    assert result["message"] == "Bearer [REDACTED]"

