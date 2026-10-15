"""Alerts domain router."""

from fastapi import APIRouter, Query

from api.alerts.schemas import AlertListResponse
from api.alerts.service import list_alerts
from api.constants import DEFAULT_PAGINATION_LIMIT, MAX_PAGINATION_LIMIT

router = APIRouter(prefix="/alerts", tags=["Alerts"])


@router.get("", response_model=AlertListResponse)
def get_alerts(
    limit: int = Query(default=DEFAULT_PAGINATION_LIMIT, ge=1, le=MAX_PAGINATION_LIMIT),
    offset: int = Query(default=0, ge=0),
) -> AlertListResponse:
    """Retrieve ranked transaction triage queue with deterministic policy actions."""
    return list_alerts(limit=limit, offset=offset)
