"""Investigation domain router."""

from fastapi import APIRouter, Depends

from api.investigations.dependencies import get_investigation_service
from api.investigations.schemas import InvestigationRequest, InvestigationResponse
from api.investigations.service import InvestigationService

router = APIRouter(prefix="/investigations", tags=["Investigations"])


@router.post("", response_model=InvestigationResponse)
async def create_investigation(
    payload: InvestigationRequest,
    service: InvestigationService = Depends(get_investigation_service),
) -> InvestigationResponse:
    """Execute a bounded FalkorDB investigation and verify evidence claims."""
    return await service.run_investigation(payload)
