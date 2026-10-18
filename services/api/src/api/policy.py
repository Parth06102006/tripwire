"""Deterministic escalation chain (ADR-023).

1. Traditional model and rules route every scored transaction: a score at or
   above the hard-block threshold is a simulated block; at or above the
   validation-selected review threshold it is flagged for agent review;
   anything lower takes the standard path and is allowed.
2. The agent review is the review of a flagged transaction. Its verified
   risk level maps to the outcome: 4 to 5 block, 1 to 3 allow.
3. Without a verified risk level (no provider, failure, timeout, rejected
   draft) a flagged transaction stays pending operator review.
4. The agent adds scrutiny only. It cannot reverse an upstream block, and it
   does not change a standard-path allow.

The model proposes the level; this module, not the model, decides. Every
block is simulated.
"""

from __future__ import annotations

from api import schemas

BLOCK_RISK_LEVEL = 4
"""Risk levels at or above this map to a block."""


def route_for(score: float, review_threshold: float, block_threshold: float | None) -> schemas.ModelRoute:
    """Where the traditional model and rules send a transaction."""
    if block_threshold is not None and score >= block_threshold:
        return "blocked_by_rule"
    if score >= review_threshold:
        return "flagged_for_review"
    return "standard_path"


def agent_risk_level(report: schemas.InvestigationReport | None) -> int | None:
    """The agent's risk level, only from a verified LLM report."""
    if report is None or report.source != "llm" or report.validation != "validated":
        return None
    return report.risk_level


def unavailable_reason(report: schemas.InvestigationReport | None, requested: bool) -> str:
    """Why no agent rating exists, in an operator's words."""
    if not requested:
        return "The agent review was not requested"
    llm = report.llm if report is not None else None
    if llm is None or llm.fallback_reason is None:
        return "The agent returned no risk level"
    return {
        "not_configured": "No LLM provider is configured",
        "provider_error": "The LLM provider failed",
        "timeout": "The LLM provider timed out",
        "invalid_output": "The agent's draft did not match the report format",
        "verification_failed": "The agent's draft cited something the queries did not return",
    }[llm.fallback_reason]


def escalate(
    *,
    score: float,
    review_threshold: float,
    block_threshold: float | None,
    report: schemas.InvestigationReport | None,
    agent_requested: bool,
) -> schemas.EscalationDecision:
    """Apply the escalation chain to one investigated transaction."""
    route = route_for(score, review_threshold, block_threshold)
    level = agent_risk_level(report)
    common = {
        "route": route,
        "review_threshold": review_threshold,
        "block_threshold": block_threshold,
        "risk_level": level,
    }

    if route == "blocked_by_rule":
        return schemas.EscalationDecision(
            **common,
            agent_status="rated" if level is not None else "not_applicable",
            outcome="block",
            decided_by="rule",
            reason=(
                "The score is at or above the hard-block threshold. "
                "The agent review adds scrutiny only and cannot reverse an upstream block."
            ),
        )

    if route == "standard_path":
        return schemas.EscalationDecision(
            **common,
            agent_status="rated" if level is not None else "not_applicable",
            outcome="allow",
            decided_by="model",
            reason=(
                "The score is below the review threshold, so the transaction takes the "
                "standard path. The agent review applies only to flagged transactions."
            ),
        )

    if level is None:
        return schemas.EscalationDecision(
            **common,
            agent_status="unavailable",
            outcome="pending_review",
            decided_by="model",
            reason=(
                f"{unavailable_reason(report, agent_requested)}. "
                "The transaction stays flagged for operator review."
            ),
        )

    blocked = level >= BLOCK_RISK_LEVEL
    return schemas.EscalationDecision(
        **common,
        agent_status="rated",
        outcome="block" if blocked else "allow",
        decided_by="agent",
        reason=(
            f"The agent rated the transaction {level} of 5. Levels 4 and 5 are blocked "
            "and levels 1 to 3 are allowed."
        ),
    )
