"""Typed Pydantic request/response contracts for the API service.

Every model excludes target labels and typology truth by construction: no
field exists for them, and Pydantic forbids extra fields, so upstream label
keys are rejected rather than echoed. Amounts always travel paired with
their own currency.
"""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class StrictModel(BaseModel):
    """Base model rejecting unknown fields so labels cannot leak through."""

    model_config = ConfigDict(extra="forbid")


class HealthResponse(StrictModel):
    """Health payload per docs/contracts.md. No credentials or labels."""

    status: Literal["ok"]
    falkordb: Literal["available", "unavailable", "not_configured"]
    version: str


class AlertItem(StrictModel):
    """One scored transaction with its deterministic policy decision."""

    transaction_id: str
    timestamp: str
    score: float
    decision: Literal["allow", "review"]


class AlertsResponse(StrictModel):
    """Paged alert queue over the target-free score artifact."""

    items: list[AlertItem]
    total: int
    limit: int
    offset: int


class SplitMetrics(StrictModel):
    """Per-split counts and threshold-selected outcomes."""

    rows: int
    prevalence: float
    alerts: int
    precision: float
    recall: float


class ThresholdMetrics(StrictModel):
    """Test metrics at the validation-selected threshold."""

    precision: float
    recall: float
    f1: float
    true_positives: int
    false_positives: int


class BudgetMetrics(StrictModel):
    """Test metrics at the predeclared fixed review capacity."""

    budget: float
    alerts: int
    true_positives: int
    precision: float
    recall: float


class ModelBenchmark(StrictModel):
    """Benchmark record for one model on the frozen test cohort."""

    average_precision: dict[str, float]
    val_threshold_max_f1: float
    test_at_val_threshold: ThresholdMetrics
    test_at_alert_budget: BudgetMetrics
    splits: dict[str, SplitMetrics]


class BenchmarksResponse(StrictModel):
    """Benchmark metrics read from the offline run artifact."""

    models: dict[str, ModelBenchmark]


class InvestigationRequest(StrictModel):
    """Bounded investigation request per the contracts."""

    transaction_id: str = Field(min_length=1)
    max_hops: int = Field(default=2, ge=1, le=3)
    time_window_seconds: int = Field(default=86400, ge=1, le=2592000)
    result_limit: int = Field(default=50, ge=1, le=100)


class TransactionEvidence(StrictModel):
    """One transfer record returned by an executed graph query."""

    transaction_id: str
    timestamp: str
    source_account_key: str
    destination_account_key: str
    amount_paid: float | None = None
    payment_currency: str | None = None
    amount_received: float | None = None
    receiving_currency: str | None = None
    payment_format: str | None = None


class AccountEvidence(StrictModel):
    """One account node returned by an executed graph query."""

    account_key: str


class GraphPath(StrictModel):
    """Ordered account and transaction references from query results."""

    anchor_transaction_id: str
    direction: str
    depth: int
    account_keys: list[str]
    transaction_ids: list[str]


class InvestigationEvidence(StrictModel):
    """Evidence arrays containing only records returned by executed queries."""

    transactions: list[TransactionEvidence]
    accounts: list[AccountEvidence]
    paths: list[GraphPath]
    query_duration_ms: float


class InvestigationReport(StrictModel):
    """Deterministic report citing only retrieved evidence."""

    hypothesis: str
    supporting_transaction_ids: list[str]
    counterevidence_ids: list[str]
    recommendation: Literal["review"]
    validation: Literal["validated"]


class InvestigationResponse(StrictModel):
    """Full investigation payload: decision inputs plus graph evidence."""

    investigation_id: str
    transaction_id: str
    risk_score: float
    decision: Literal["allow", "review"]
    policy_version: str
    evidence: InvestigationEvidence
    report: InvestigationReport | None
    created_at: datetime
