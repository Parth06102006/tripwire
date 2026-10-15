"""Service settings loaded from environment without leaking values in responses."""

from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

REPOSITORY_ROOT = Path(__file__).resolve().parents[4]


class Settings(BaseSettings):
    """Runtime configuration for the API service."""

    model_config = SettingsConfigDict(
        env_prefix="TRACEAML_",
        env_file=REPOSITORY_ROOT / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_version: str = Field(default="0.1.0")
    falkordb_host: str | None = Field(default=None)
    falkordb_port: int = Field(default=6379)


def get_settings() -> Settings:
    """Return settings from the current environment."""
    return Settings()
