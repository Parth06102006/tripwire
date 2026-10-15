"""Alerts retrieval and triage service."""

from api.alerts.policy import get_policy_engine
from api.alerts.schemas import AlertItem, AlertListResponse

# Replay seed data representing scored synthetic transactions
_SEED_ALERTS = [
    {
        "transaction_id": "tx_hi_000184",
        "timestamp": 1697328000,
        "source_account_key": "acc_bank_01_9921",
        "destination_account_key": "acc_bank_04_1184",
        "amount": 48500.0,
        "currency": "USD",
        "score": 0.92,
        "flags": ["high_fan_out", "rapid_passthrough"],
    },
    {
        "transaction_id": "tx_hi_000219",
        "timestamp": 1697331600,
        "source_account_key": "acc_bank_02_4412",
        "destination_account_key": "acc_bank_07_8831",
        "amount": 9500.0,
        "currency": "USD",
        "score": 0.74,
        "flags": ["circular_flow"],
    },
    {
        "transaction_id": "tx_hi_000305",
        "timestamp": 1697335200,
        "source_account_key": "acc_bank_01_3321",
        "destination_account_key": "acc_bank_02_5510",
        "amount": 1200.0,
        "currency": "USD",
        "score": 0.42,
        "flags": [],
    },
    {
        "transaction_id": "tx_hi_000412",
        "timestamp": 1697338800,
        "source_account_key": "acc_bank_03_7719",
        "destination_account_key": "acc_bank_05_9934",
        "amount": 250.0,
        "currency": "EUR",
        "score": 0.12,
        "flags": [],
    },
]


def list_alerts(limit: int = 50, offset: int = 0) -> AlertListResponse:
    """Retrieve ranked alerts queue with deterministically computed policy actions."""
    policy_engine = get_policy_engine()
    items: list[AlertItem] = []

    # Sort seed alerts by score descending
    sorted_raw = sorted(_SEED_ALERTS, key=lambda x: x["score"], reverse=True)

    for record in sorted_raw[offset : offset + limit]:
        action, risk_level = policy_engine.evaluate(
            score=record["score"],
            structural_flags=record["flags"],
        )
        items.append(
            AlertItem(
                transaction_id=record["transaction_id"],
                timestamp=record["timestamp"],
                source_account_key=record["source_account_key"],
                destination_account_key=record["destination_account_key"],
                amount=record["amount"],
                currency=record["currency"],
                score=record["score"],
                policy_action=action,
                risk_level=risk_level,
                flags=record["flags"],
            )
        )

    return AlertListResponse(
        items=items,
        total=len(sorted_raw),
        limit=limit,
        offset=offset,
    )
