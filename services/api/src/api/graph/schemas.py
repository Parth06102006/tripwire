"""Graph entity and path schemas."""

from pydantic import BaseModel, Field


class TransactionEvidence(BaseModel):
    """Normalized transaction record returned from executed graph queries."""

    transaction_id: str
    timestamp: str | int | float
    source_account_key: str
    destination_account_key: str
    amount: float | None = None
    currency: str | None = None
    payment_type: str | None = None


class GraphPath(BaseModel):
    """Ordered sequence of accounts and transactions forming an evidence path."""

    nodes: list[str] = Field(default_factory=list)
    relationships: list[str] = Field(default_factory=list)


class GraphQueryResult(BaseModel):
    """Aggregated result of executing approved graph queries."""

    transactions: list[TransactionEvidence] = Field(default_factory=list)
    accounts: list[str] = Field(default_factory=list)
    paths: list[GraphPath] = Field(default_factory=list)
    query_duration_ms: float = 0.0
