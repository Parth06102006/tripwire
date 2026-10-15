"""Data access repository for cases and audit logs."""

import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from api.cases.constants import CaseStatus, ReviewAction
from api.cases.models import CaseModel, CaseReviewModel, _now_iso


class CaseRepository:
    """Async repository for querying cases and appending audit reviews."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get_by_id(self, case_id: str) -> CaseModel | None:
        """Fetch a case by its ID."""
        stmt = select(CaseModel).where(CaseModel.case_id == case_id)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def list_cases(
        self,
        status: CaseStatus | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[list[CaseModel], int]:
        """List cases with optional status filter and bounded pagination."""
        query = select(CaseModel)
        count_query = select(func.count(CaseModel.case_id))

        if status:
            query = query.where(CaseModel.status == status)
            count_query = count_query.where(CaseModel.status == status)

        query = query.order_by(CaseModel.updated_at.desc()).offset(offset).limit(limit)

        total_result = await self.session.execute(count_query)
        total = total_result.scalar() or 0

        items_result = await self.session.execute(query)
        items = list(items_result.scalars().all())

        return items, total

    async def record_review(
        self,
        case: CaseModel,
        action: ReviewAction,
        reviewer_id: str,
        pattern_type: str | None = None,
        notes: str | None = None,
    ) -> CaseModel:
        """Append an immutable review audit entry and update case status.

        Dismissal preserves the transaction history and audit record and does not erase data.
        """
        review = CaseReviewModel(
            review_id=f"rev_{uuid.uuid4().hex[:12]}",
            case_id=case.case_id,
            action=action,
            reviewer_id=reviewer_id,
            pattern_type=pattern_type,
            notes=notes,
            timestamp=_now_iso(),
        )
        self.session.add(review)

        # Update case status
        case.status = "confirmed" if action == "confirm" else "dismissed"
        case.updated_at = _now_iso()
        await self.session.commit()
        await self.session.refresh(case)
        return case

    async def seed_initial_cases(self) -> None:
        """Ensure initial seed cases exist for demonstration/replay."""
        total_stmt = select(func.count(CaseModel.case_id))
        total = (await self.session.execute(total_stmt)).scalar() or 0
        if total > 0:
            return

        seeds = [
            CaseModel(
                case_id="case_001_8492",
                transaction_id="tx_hi_000184",
                status="suspected",
                risk_score=0.92,
            ),
            CaseModel(
                case_id="case_002_4491",
                transaction_id="tx_hi_000219",
                status="under_review",
                risk_score=0.74,
            ),
            CaseModel(
                case_id="case_003_1204",
                transaction_id="tx_hi_000305",
                status="dismissed",
                risk_score=0.42,
            ),
        ]
        self.session.add_all(seeds)
        await self.session.commit()
