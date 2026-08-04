from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from urllib.parse import urlparse

from pydantic import Field, SecretStr, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore", case_sensitive=False)

    siliconflow_base_url: str = "https://api.siliconflow.cn/v1"
    siliconflow_api_key: SecretStr
    siliconflow_model: str = "Qwen/Qwen3-VL-32B-Instruct"

    e2e_login_url: str | None = None
    e2e_home_url: str | None = None
    e2e_rule_url: str | None = None
    e2e_record_url: str | None = None
    e2e_job_trigger_url_template: str | None = None
    e2e_user: SecretStr | None = None
    e2e_password: SecretStr | None = None
    e2e_captcha: SecretStr | None = None
    e2e_headless: bool = False
    e2e_browser_profile: Path = Path(".local/browser-profile")
    e2e_artifact_dir: Path = Path(".artifacts")
    e2e_allowed_hosts: str = ""

    e2e_db_host: str | None = None
    e2e_db_port: int = 3306
    e2e_db_name: str | None = None
    e2e_db_user: str | None = None
    e2e_db_password: SecretStr | None = None
    e2e_db_env: str = "test"

    e2e_meta_store: str = "file"
    e2e_meta_dir: Path = Path(".local/seed-meta")
    e2e_seed_cleanup_policy: str = "always"

    @field_validator("siliconflow_base_url")
    @classmethod
    def normalize_base_url(cls, value: str) -> str:
        value = value.strip().rstrip("/")
        parsed = urlparse(value)
        if parsed.scheme != "https" or not parsed.netloc:
            raise ValueError("SILICONFLOW_BASE_URL must be an HTTPS URL")
        return value

    @model_validator(mode="after")
    def enforce_local_metadata(self) -> "Settings":
        if self.e2e_meta_store != "file":
            raise ValueError("E2E_META_STORE must be file")
        if self.e2e_seed_cleanup_policy not in {"always", "manual"}:
            raise ValueError("E2E_SEED_CLEANUP_POLICY must be always or manual")
        return self

    @property
    def allowed_hosts(self) -> set[str]:
        configured = {item.strip().lower() for item in self.e2e_allowed_hosts.split(",") if item.strip()}
        derived = {
            urlparse(value).hostname.lower()
            for value in (self.e2e_login_url, self.e2e_home_url, self.e2e_rule_url, self.e2e_record_url)
            if value and urlparse(value).hostname
        }
        return configured | derived

    def require_test_database(self) -> None:
        if self.e2e_db_env.lower() != "test":
            raise RuntimeError("Refusing database mutation: E2E_DB_ENV must equal test")
        missing = [name for name, value in {
            "E2E_DB_HOST": self.e2e_db_host,
            "E2E_DB_NAME": self.e2e_db_name,
            "E2E_DB_USER": self.e2e_db_user,
            "E2E_DB_PASSWORD": self.e2e_db_password,
        }.items() if not value]
        if missing:
            raise RuntimeError(f"Missing database settings: {', '.join(missing)}")

    def browser_credentials(self) -> dict[str, dict[str, str]]:
        values = {
            "username": self.e2e_user,
            "password": self.e2e_password,
            "captcha": self.e2e_captcha,
        }
        secrets = {name: value.get_secret_value() for name, value in values.items() if value}
        if not {"username", "password"}.issubset(secrets):
            raise RuntimeError("E2E_USER and E2E_PASSWORD are required for browser login")
        credential_domains = {
            f"{parsed.scheme.lower()}://{parsed.hostname.lower()}"
            for value in (self.e2e_login_url, self.e2e_home_url, self.e2e_rule_url, self.e2e_record_url)
            if value and (parsed := urlparse(value)).scheme and parsed.hostname
        }
        if not credential_domains:
            raise RuntimeError("At least one configured browser URL is required for domain-scoped credentials")
        return {domain: secrets for domain in credential_domains}


@lru_cache
def get_settings() -> Settings:
    return Settings()
