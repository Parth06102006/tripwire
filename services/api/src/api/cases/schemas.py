"""Case domain schemas."""

from pydantic import BaseModel, Field

from api.cases.constants import CaseStatus, ReviewAction


class CaseReviewRequest(BaseModel):
    """Payload for submitting an analyst review decision."""

    action: ReviewAction = Field(description="Explicit decision: confirm or dismiss")
    reviewer_id: str = Field(min_length=1, description="Analyst identifier")
    pattern_type: str | None = Field(default=None, description="Optional identified typology pattern")
    notes: str | None = Field(default=None, description="Analyst investigation notes")


class CaseReviewItem(BaseModel):
    """Audit record of an analyst review."""

    review_id: str
    case_id: str
    action: ReviewAction
    reviewer_id: str
    pattern_type: str | None = None
    notes: str | None = None
    timestamp: str


class CaseItem(BaseModel):
    """Case representation for workbench display."""

    case_id: str
    transaction_id: str
    status: CaseStatus
    risk_score: float
    created_at: str
    updated_at: str
    reviews: list[CaseReviewItem] = Field(default_factory=list)


class CaseReviewResponse(BaseModel):
    """Response returned upon submitting a review."""

    case_id: str
    status: CaseStatus
    action: ReviewAction
    reviewer_id: str
    timestamp: str
    provenance_recorded: bool = True
    message: str


class CaseListResponse(BaseModel):
    """Paginated cases list response."""

    items: list[CaseItem]
    total: int
    limit: int
    offset: int
