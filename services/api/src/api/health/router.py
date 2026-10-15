"""Health domain router."""

from fastapi import APIRouter

from api.health.schemas import HealthResponse
from api.health.service import get_health_status

router = APIRouter(tags=["Health"])


@router.get("/health", response_model=HealthResponse)
def get_health() -> HealthResponse:
    """Return service readiness and dependency status."""
    graph_status, version = get_health_status()
    return HealthResponse(
        status="ok",
        falkordb=graph_status,
        version=version,
    )
