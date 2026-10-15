"""Runtime configuration loaded from environment without leaking sensitive values."""

from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

REPOSITORY_ROOT = Path(__file__).resolve().parents[4]
DATA_DIR = REPOSITORY_ROOT / "data"


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
    database_url: str = Field(default=f"sqlite+aiosqlite:///{DATA_DIR / 'audit.db'}")
    cors_origins: list[str] = Field(
        default=["http://localhost:3000", "http://127.0.0.1:3000"]
    )


@lru_cache
def get_settings() -> Settings:
    """Return cached settings loaded from current environment."""
    return Settings()
