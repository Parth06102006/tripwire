"""Case domain router."""

from fastapi import APIRouter, Depends, Path, Query

from api.cases.constants import CaseStatus
from api.cases.dependencies import get_case_service
from api.cases.schemas import CaseListResponse, CaseReviewRequest, CaseReviewResponse
from api.cases.service import CaseService
from api.constants import DEFAULT_PAGINATION_LIMIT, MAX_PAGINATION_LIMIT

router = APIRouter(prefix="/cases", tags=["Cases"])


@router.get("", response_model=CaseListResponse)
async def list_cases(
    status: CaseStatus | None = Query(default=None, description="Filter by case status"),
    limit: int = Query(default=DEFAULT_PAGINATION_LIMIT, ge=1, le=MAX_PAGINATION_LIMIT),
    offset: int = Query(default=0, ge=0),
    service: CaseService = Depends(get_case_service),
) -> CaseListResponse:
    """List investigation cases with bounded pagination and status filtering."""
    return await service.list_cases(status=status, limit=limit, offset=offset)


@router.post("/{case_id}/review", response_model=CaseReviewResponse)
async def review_case(
    case_id: str = Path(..., description="Unique case identifier"),
    payload: CaseReviewRequest = ...,
    service: CaseService = Depends(get_case_service),
) -> CaseReviewResponse:
    """Submit an analyst review decision (confirm or dismiss) with reviewer provenance."""
    return await service.review_case(
        case_id=case_id,
        action=payload.action,
        reviewer_id=payload.reviewer_id,
        pattern_type=payload.pattern_type,
        notes=payload.notes,
    )
