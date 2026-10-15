"""Alerts domain schemas."""

from pydantic import BaseModel, Field

from api.alerts.constants import PolicyAction, RiskLevel


class AlertItem(BaseModel):
    """Ranked alert item in the triage queue."""

    transaction_id: str
    timestamp: str | int | float
    source_account_key: str
    destination_account_key: str
    amount: float
    currency: str
    score: float = Field(ge=0.0, le=1.0, description="Model anomaly or risk probability score")
    policy_action: PolicyAction = Field(description="Deterministic decision: allow, review, or simulated_block")
    risk_level: RiskLevel
    flags: list[str] = Field(default_factory=list)


class AlertListResponse(BaseModel):
    """Paginated triage queue of alerts."""

    items: list[AlertItem]
    total: int
    limit: int
    offset: int
