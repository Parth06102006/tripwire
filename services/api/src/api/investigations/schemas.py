"""Investigation domain schemas adhering strictly to docs/contracts.md."""

from datetime import UTC, datetime

from pydantic import BaseModel, Field

from api.graph.schemas import GraphPath, TransactionEvidence
from api.investigations.constants import (
    DEFAULT_HOPS,
    DEFAULT_RESULT_LIMIT,
    MAX_HOPS,
    MAX_RESULT_LIMIT,
    MIN_HOPS,
    MIN_RESULT_LIMIT,
    ValidationStatus,
)


class InvestigationRequest(BaseModel):
    """Investigation request payload with bounded traversals."""

    transaction_id: str = Field(min_length=1, description="Root transaction identifier to investigate")
    max_hops: int = Field(
        default=DEFAULT_HOPS,
        ge=MIN_HOPS,
        le=MAX_HOPS,
        description="Bounded traversal depth (1 to 3)",
    )
    time_window_seconds: int | None = Field(
        default=86400,
        ge=1,
        description="Temporal window for traversal in seconds",
    )
    result_limit: int = Field(
        default=DEFAULT_RESULT_LIMIT,
        ge=MIN_RESULT_LIMIT,
        le=MAX_RESULT_LIMIT,
        description="Bounded result limit (1 to 100)",
    )


class InvestigationEvidence(BaseModel):
    """Topology evidence returned by executed FalkorDB queries."""

    transactions: list[TransactionEvidence] = Field(default_factory=list)
    accounts: list[str] = Field(default_factory=list)
    paths: list[GraphPath] = Field(default_factory=list)
    query_duration_ms: float = 0.0


class InvestigationReport(BaseModel):
    """Structured report with claims validated against retrieved evidence."""

    hypothesis: str
    supporting_transaction_ids: list[str] = Field(default_factory=list)
    counterevidence_ids: list[str] = Field(default_factory=list)
    recommendation: str
    validation_status: ValidationStatus = "unverified"
    rejection_reasons: list[str] = Field(default_factory=list)


class InvestigationResponse(BaseModel):
    """Investigation response matching docs/contracts.md."""

    investigation_id: str
    transaction_id: str
    evidence: InvestigationEvidence
    report: InvestigationReport | None = None
    created_at: str = Field(default_factory=lambda: datetime.now(UTC).isoformat())
