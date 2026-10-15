"""Deterministic policy engine for TraceAML.

Maps model probabilities and graph structural signals to deterministic actions:
allow, review, or simulated_block.
An LLM or ML model does not own final policy actions.
"""

from api.alerts.constants import (
    DEFAULT_ALLOW_THRESHOLD,
    DEFAULT_BLOCK_THRESHOLD,
    PolicyAction,
    RiskLevel,
)


class DeterministicPolicyEngine:
    """Pure, deterministic policy evaluator."""

    def __init__(
        self,
        allow_threshold: float = DEFAULT_ALLOW_THRESHOLD,
        block_threshold: float = DEFAULT_BLOCK_THRESHOLD,
    ) -> None:
        self.allow_threshold = allow_threshold
        self.block_threshold = block_threshold

    def evaluate(
        self,
        score: float,
        structural_flags: list[str] | None = None,
    ) -> tuple[PolicyAction, RiskLevel]:
        """Evaluate a transaction score and structural signals deterministically.

        Returns:
            A tuple of (PolicyAction, RiskLevel).
            Any block action is explicitly labeled simulated_block per ADR-006.
        """
        flags = structural_flags or []
        has_critical_structural_flag = any(
            f in flags for f in ["circular_flow", "high_fan_out", "rapid_passthrough"]
        )

        if score >= self.block_threshold:
            return "simulated_block", "high"

        if score >= self.allow_threshold or has_critical_structural_flag:
            return "review", "medium"

        return "allow", "low"


_default_policy_engine = DeterministicPolicyEngine()


def get_policy_engine() -> DeterministicPolicyEngine:
    """Return singleton policy engine instance."""
    return _default_policy_engine
