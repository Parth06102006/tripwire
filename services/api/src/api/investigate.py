"""Investigation orchestration over graph tools and target-free scores.

Flow per request: look up the deterministic risk score, map it through the
locked validation threshold to ``allow``/``review``, run the approved graph
tools, shape their rows through explicit field allowlists (so no upstream
label key can pass through), and attach a deterministic report citing only
returned IDs after verifier approval.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any, Literal, Protocol
from uuid import uuid4

from api import schemas
from api.verifier import EvidenceValidationError, validate_report

POLICY_VERSION = "v1"
REVIEW_THRESHOLD_FALLBACK_NOTE = "lgbm"


class GraphTools(Protocol):
    """Seam for graph evidence: production adapter or test fake."""

    def trace_funds(
        self,
        transaction_id: str,
        max_hops: int,
        time_window_seconds: int,
        result_limit: int,
    ) -> dict[str, Any]: ...

    def inspect_counterparties(
        self,
        transaction_id: str,
        time_window_seconds: int,
        result_limit: int,
    ) -> dict[str, Any]: ...

    def detect_flow_patterns(
        self,
        account_key: str,
        pattern: str,
        time_window_seconds: int,
        result_limit: int,
    ) -> dict[str, Any]: ...


class InvestigationFailure(Exception):
    """Raised when evidence cannot be assembled or validated."""


class FalkorGraphTools:
    """Production adapter over the traceaml-graph query functions."""

    def __init__(self, graph: Any, timeout_ms: int = 5_000) -> None:
        self._graph = graph
        self._timeout_ms = timeout_ms

    def trace_funds(
        self,
        transaction_id: str,
        max_hops: int,
        time_window_seconds: int,
        result_limit: int,
    ) -> dict[str, Any]:
        from graph.queries import trace_funds

        return trace_funds(
            self._graph,
            transaction_id,
            direction="both",
            max_hops=max_hops,
            time_window_seconds=time_window_seconds,
            result_limit=result_limit,
            timeout_ms=self._timeout_ms,
        )

    def inspect_counterparties(
        self,
        transaction_id: str,
        time_window_seconds: int,
        result_limit: int,
    ) -> dict[str, Any]:
        from graph.queries import inspect_counterparties

        return inspect_counterparties(
            self._graph,
            transaction_id=transaction_id,
            time_window_seconds=time_window_seconds,
            result_limit=result_limit,
            timeout_ms=self._timeout_ms,
        )

    def detect_flow_patterns(
        self,
        account_key: str,
        pattern: str,
        time_window_seconds: int,
        result_limit: int,
    ) -> dict[str, Any]:
        from graph.queries import detect_flow_patterns

        return detect_flow_patterns(
            self._graph,
            account_key=account_key,
            pattern=pattern,
            time_window_seconds=time_window_seconds,
            dwell_seconds=time_window_seconds,
            result_limit=result_limit,
            timeout_ms=self._timeout_ms,
        )


def shape_transaction(row: dict[str, Any]) -> schemas.TransactionEvidence:
    """Copy only evidence fields; unknown keys (labels included) are dropped."""
    return schemas.TransactionEvidence(
        transaction_id=str(row["transaction_id"]),
        timestamp=str(row["timestamp"]),
        source_account_key=str(row["source_account_key"]),
        destination_account_key=str(row["destination_account_key"]),
        amount_paid=row.get("amount_paid"),
        payment_currency=row.get("payment_currency"),
        amount_received=row.get("amount_received"),
        receiving_currency=row.get("receiving_currency"),
        payment_format=row.get("payment_format"),
    )


def shape_path(path: dict[str, Any]) -> schemas.GraphPath:
    """Copy only path references returned by the executed query."""
    return schemas.GraphPath(
        anchor_transaction_id=str(path.get("anchor_transaction_id", "")),
        direction=str(path.get("direction", "both")),
        depth=int(path.get("depth", 0)),
        account_keys=[str(key) for key in path.get("account_keys", [])],
        transaction_ids=[str(tid) for tid in path.get("transaction_ids", [])],
    )


def shape_fan_transfer(
    transfer: dict[str, Any], *, sender_key: str, receiver_key: str
) -> schemas.TransactionEvidence:
    """Shape one fan-match transfer with anchor-derived counterparty keys."""
    return schemas.TransactionEvidence(
        transaction_id=str(transfer["transaction_id"]),
        timestamp=str(transfer["timestamp"]),
        source_account_key=sender_key,
        destination_account_key=receiver_key,
        amount_paid=transfer.get("amount_paid"),
        payment_currency=transfer.get("payment_currency"),
        amount_received=transfer.get("amount_received"),
        receiving_currency=transfer.get("receiving_currency"),
        payment_format=None,
    )


def merge_pattern_matches(
    matches: Any,
    pattern: str,
    anchor_key: str,
    transaction_id: str,
    transactions: dict[str, schemas.TransactionEvidence],
    accounts: dict[str, schemas.AccountEvidence],
    paths: list[schemas.GraphPath],
) -> None:
    """Merge validated pattern references into the shared evidence sets.

    Fan matches group transfers per counterparty; pass-through matches carry
    ordered entry/middle/exit keys with two hops. Every referenced ID is
    added to the evidence sets, so the verifier checks pattern paths against
    the same records as traversal paths. All paths anchor on the
    investigated transaction: fan findings are stars (depth 1) and
    pass-through findings are two-hop chains (depth 2).
    """
    if pattern in ("fan_out", "fan_in"):
        for group in matches:
            counterparty_key = str(group["counterparty_key"])
            transfer_ids: list[str] = []
            for transfer in group.get("transfers", []):
                if pattern == "fan_out":
                    sender_key, receiver_key = anchor_key, counterparty_key
                else:
                    sender_key, receiver_key = counterparty_key, anchor_key
                record = shape_fan_transfer(
                    transfer, sender_key=sender_key, receiver_key=receiver_key
                )
                transactions.setdefault(record.transaction_id, record)
                transfer_ids.append(record.transaction_id)
            accounts.setdefault(anchor_key, schemas.AccountEvidence(account_key=anchor_key))
            accounts.setdefault(
                counterparty_key, schemas.AccountEvidence(account_key=counterparty_key)
            )
            paths.append(
                schemas.GraphPath(
                    anchor_transaction_id=transaction_id,
                    direction=f"pattern:{pattern}",
                    depth=1,
                    account_keys=(
                        [anchor_key, counterparty_key]
                        if pattern == "fan_out"
                        else [counterparty_key, anchor_key]
                    ),
                    transaction_ids=transfer_ids,
                )
            )
    elif pattern == "pass_through":
        for match in matches:
            account_keys = [str(key) for key in match["account_keys"]]
            transaction_ids = [str(tid) for tid in match["transaction_ids"]]
            hops = [
                (match["first_hop"], account_keys[0], account_keys[1]),
                (match["second_hop"], account_keys[1], account_keys[2]),
            ]
            for hop, sender_key, receiver_key in hops:
                record = shape_fan_transfer(
                    hop, sender_key=sender_key, receiver_key=receiver_key
                )
                transactions.setdefault(record.transaction_id, record)
            for key in account_keys:
                accounts.setdefault(key, schemas.AccountEvidence(account_key=key))
            paths.append(
                schemas.GraphPath(
                    anchor_transaction_id=transaction_id,
                    direction="pattern:pass_through",
                    depth=2,
                    account_keys=account_keys,
                    transaction_ids=transaction_ids,
                )
            )
    else:
        raise ValueError(f"unknown pattern: {pattern}")


def build_investigation(
    transaction_id: str,
    score: float,
    threshold: float,
    tools: GraphTools,
    max_hops: int,
    time_window_seconds: int,
    result_limit: int,
) -> schemas.InvestigationResponse:
    """Assemble evidence, validate the deterministic report, and respond."""
    decision: Literal["allow", "review"] = "review" if score >= threshold else "allow"
    try:
        traced = tools.trace_funds(
            transaction_id,
            max_hops=max_hops,
            time_window_seconds=time_window_seconds,
            result_limit=result_limit,
        )
        counterparts = tools.inspect_counterparties(
            transaction_id,
            time_window_seconds=time_window_seconds,
            result_limit=result_limit,
        )
    except Exception as exc:
        raise InvestigationFailure("graph evidence unavailable") from exc

    transactions: dict[str, schemas.TransactionEvidence] = {}
    for row in traced.get("transactions", []) + counterparts.get("transactions", []):
        try:
            record = shape_transaction(row)
        except (KeyError, TypeError, ValueError) as exc:
            raise InvestigationFailure("graph evidence unavailable") from exc
        transactions.setdefault(record.transaction_id, record)
    accounts: dict[str, schemas.AccountEvidence] = {}
    for entry in traced.get("accounts", []) + counterparts.get("accounts", []):
        try:
            key = str(entry["account_key"])
        except (KeyError, TypeError) as exc:
            raise InvestigationFailure("graph evidence unavailable") from exc
        accounts.setdefault(key, schemas.AccountEvidence(account_key=key))
    paths = [shape_path(path) for path in traced.get("paths", [])]
    query_duration_ms = float(traced.get("query_duration_ms", 0.0)) + float(
        counterparts.get("query_duration_ms", 0.0)
    )

    # Pattern findings anchored at the investigated transfer's endpoints:
    # fan-out from the sender, fan-in and pass-through at the receiver.
    # Anchor keys come only from already-returned evidence.
    anchor_record = transactions.get(transaction_id)
    if anchor_record is not None:
        pattern_specs = (
            ("fan_out", anchor_record.source_account_key),
            ("fan_in", anchor_record.destination_account_key),
            ("pass_through", anchor_record.destination_account_key),
        )
        for pattern, anchor_key in pattern_specs:
            try:
                found = tools.detect_flow_patterns(
                    anchor_key,
                    pattern=pattern,
                    time_window_seconds=time_window_seconds,
                    result_limit=result_limit,
                )
            except Exception as exc:
                raise InvestigationFailure("graph evidence unavailable") from exc
            try:
                query_duration_ms += float(found.get("query_duration_ms", 0.0))
                merge_pattern_matches(
                    found.get("matches", []),
                    pattern,
                    anchor_key,
                    transaction_id,
                    transactions,
                    accounts,
                    paths,
                )
            except (KeyError, TypeError, ValueError) as exc:
                raise InvestigationFailure("graph evidence unavailable") from exc

    evidence_ids = set(transactions)
    evidence_keys = set(accounts)
    supporting_ids = sorted(evidence_ids)
    hypothesis = (
        f"{len(evidence_ids)} related transfers across {len(evidence_keys)} "
        f"accounts within the bounded window around {transaction_id}."
    )
    try:
        validate_report(
            supporting_ids,
            [],
            evidence_ids,
            [
                {"transaction_ids": path.transaction_ids, "account_keys": path.account_keys}
                for path in paths
            ],
            evidence_keys,
        )
    except EvidenceValidationError as exc:
        raise InvestigationFailure("evidence validation failed") from exc

    return schemas.InvestigationResponse(
        investigation_id=f"inv-{uuid4().hex[:12]}",
        transaction_id=transaction_id,
        risk_score=score,
        decision=decision,
        policy_version=POLICY_VERSION,
        evidence=schemas.InvestigationEvidence(
            transactions=list(transactions.values()),
            accounts=list(accounts.values()),
            paths=paths,
            query_duration_ms=query_duration_ms,
        ),
        report=schemas.InvestigationReport(
            hypothesis=hypothesis,
            supporting_transaction_ids=supporting_ids,
            counterevidence_ids=[],
            recommendation="review",
            validation="validated",
        ),
        created_at=datetime.now(UTC),
    )
