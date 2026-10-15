"""Case domain business logic."""

from sqlalchemy.ext.asyncio import AsyncSession

from api.cases.constants import CaseStatus, ReviewAction
from api.cases.exceptions import CaseNotFoundError
from api.cases.models import CaseModel
from api.cases.repository import CaseRepository
from api.cases.schemas import (
    CaseItem,
    CaseListResponse,
    CaseReviewItem,
    CaseReviewResponse,
)


def _to_case_item(model: CaseModel) -> CaseItem:
    return CaseItem(
        case_id=model.case_id,
        transaction_id=model.transaction_id,
        status=model.status,  # type: ignore[arg-type]
        risk_score=model.risk_score,
        created_at=model.created_at,
        updated_at=model.updated_at,
        reviews=[
            CaseReviewItem(
                review_id=rev.review_id,
                case_id=rev.case_id,
                action=rev.action,  # type: ignore[arg-type]
                reviewer_id=rev.reviewer_id,
                pattern_type=rev.pattern_type,
                notes=rev.notes,
                timestamp=rev.timestamp,
            )
            for rev in (model.reviews or [])
        ],
    )


class CaseService:
    """Service handling case querying and review workflows."""

    def __init__(self, session: AsyncSession) -> None:
        self.repo = CaseRepository(session)

    async def list_cases(
        self,
        status: CaseStatus | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> CaseListResponse:
        """Fetch paginated cases, ensuring seed records exist."""
        await self.repo.seed_initial_cases()
        models, total = await self.repo.list_cases(status=status, limit=limit, offset=offset)
        return CaseListResponse(
            items=[_to_case_item(m) for m in models],
            total=total,
            limit=limit,
            offset=offset,
        )

    async def review_case(
        self,
        case_id: str,
        action: ReviewAction,
        reviewer_id: str,
        pattern_type: str | None = None,
        notes: str | None = None,
    ) -> CaseReviewResponse:
        """Record explicit analyst review provenance.

        A confirmation records confirmed provenance.
        A dismissal preserves transaction history and audit record and does not erase data.
        """
        case = await self.repo.get_by_id(case_id)
        if not case:
            raise CaseNotFoundError(case_id)

        updated_case = await self.repo.record_review(
            case=case,
            action=action,
            reviewer_id=reviewer_id,
            pattern_type=pattern_type,
            notes=notes,
        )

        message = (
            f"Case '{case_id}' successfully confirmed by reviewer '{reviewer_id}'."
            if action == "confirm"
            else f"Case '{case_id}' dismissed with audit history preserved."
        )

        return CaseReviewResponse(
            case_id=updated_case.case_id,
            status=updated_case.status,  # type: ignore[arg-type]
            action=action,
            reviewer_id=reviewer_id,
            timestamp=updated_case.updated_at,
            provenance_recorded=True,
            message=message,
        )
