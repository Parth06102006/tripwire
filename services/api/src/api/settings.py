"""Service settings loaded from environment without leaking values in responses."""

import os
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

REPOSITORY_MARKER = "AGENTS.md"


def find_repository_root() -> Path:
    """Locate the repository root without assuming a fixed directory depth.

    ``TRACEAML_REPOSITORY_ROOT`` wins when set (the container image sets it).
    Otherwise the nearest ancestor holding the repository marker is used, and
    an installed, non-editable copy falls back to the working directory.
    """
    override = os.environ.get("TRACEAML_REPOSITORY_ROOT")
    if override:
        return Path(override).resolve()
    for parent in Path(__file__).resolve().parents:
        if (parent / REPOSITORY_MARKER).is_file():
            return parent
    return Path.cwd()


REPOSITORY_ROOT = find_repository_root()


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
    graph_name: str = Field(default="traceaml")
    graph_query_timeout_ms: int = Field(default=5_000, ge=100, le=30_000)
    graph_pool_size: int = Field(default=16, ge=1, le=128)
    score_artifact: str = Field(
        default="artifacts/runs/hi-small-v8/baselines/inference_scores.parquet"
    )
    baseline_config_path: str = Field(
        default="artifacts/runs/hi-small-v8/baselines/baseline_config.json"
    )
    baseline_metrics_path: str = Field(
        default="artifacts/runs/hi-small-v8/baselines/baseline_metrics.json"
    )
    graph_metrics_path: str = Field(
        default="artifacts/runs/hi-small-v8/graph-ablation/baseline_metrics.json"
    )
    performance_path: str = Field(default="docs/benchmarks/iteration-1-performance.json")
    score_model: str = Field(default="lgbm")
    case_db_path: str = Field(default="data/cases/cases.db")


def get_settings() -> Settings:
    """Return settings from the current environment."""
    return Settings()
