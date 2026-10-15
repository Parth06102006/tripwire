"""FastAPI entrypoint re-exporting the application from api.main."""

from api.health.schemas import HealthResponse
from api.main import app, create_app

__all__ = ["HealthResponse", "app", "create_app"]
