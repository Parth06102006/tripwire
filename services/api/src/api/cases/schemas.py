"""Case review request and response contracts."""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import Field

from api.schemas import StrictModel

CaseStatus = Literal["suspected", "under_review", "confirmed", "dismissed"]
ReviewAction = Literal["confirm", "dismiss"]
HistoryAction = Literal["open", "confirm", "dismiss"]

OPEN_STATUSES: tuple[CaseStatus, ...] = ("suspected", "under_review")


class CaseCreateRequest(StrictModel):
    """Open a case for a transaction present in the score artifact."""

    transaction_id: str = Field(min_length=1, max_length=128)
    opened_by: str = Field(min_length=1, max_length=64, description="Analyst identifier")
    notes: str | None = Field(default=None, max_length=4000)


class CaseReviewRequest(StrictModel):
    """Explicit analyst decision with reviewer provenance."""

    action: ReviewAction
    reviewer_id: str = Field(min_length=1, max_length=64)
    pattern_type: str | None = Field(
        default=None, max_length=64, description="Analyst-identified pattern, if any"
    )
    notes: str | None = Field(default=None, max_length=4000)


class CaseHistoryEntry(StrictModel):
    """One append-only audit record."""

    review_id: str
    action: HistoryAction
    reviewer_id: str
    pattern_type: str | None
    notes: str | None
    timestamp: datetime


class CaseItem(StrictModel):
    """A case with its full chronological history."""

    case_id: str
    transaction_id: str
    status: CaseStatus
    risk_score: float
    opened_by: str
    created_at: datetime
    updated_at: datetime
    history: list[CaseHistoryEntry]


class CaseListResponse(StrictModel):
    """Paged case list, most recently updated first."""

    items: list[CaseItem]
    total: int
    limit: int
    offset: int
