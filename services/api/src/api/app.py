"""Typed FastAPI application for the TraceAML API service."""

from fastapi import FastAPI
from typing import Literal

from pydantic import BaseModel

from api.graph import GraphStatus, probe_graph
from api.settings import get_settings


class HealthResponse(BaseModel):
    """Health payload per docs/contracts.md. No credentials or labels."""

    status: Literal["ok"]
    falkordb: GraphStatus
    version: str


def create_app() -> FastAPI:
    """Build the FastAPI application."""
    app = FastAPI(title="TraceAML API", version="0.1.0")

    @app.get("/api/health", response_model=HealthResponse)
    def get_health() -> HealthResponse:
        settings = get_settings()
        return HealthResponse(
            status="ok",
            falkordb=probe_graph(settings.falkordb_host, settings.falkordb_port),
            version=settings.app_version,
        )

    return app


app = create_app()
