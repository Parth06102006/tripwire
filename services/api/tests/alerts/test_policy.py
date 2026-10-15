"""Tests for deterministic policy engine."""

from api.alerts.policy import DeterministicPolicyEngine


def test_deterministic_policy_thresholds() -> None:
    """Verify policy engine maps scores and flags strictly deterministically."""
    engine = DeterministicPolicyEngine(allow_threshold=0.35, block_threshold=0.80)

    # Low risk -> allow
    action, risk = engine.evaluate(score=0.15, structural_flags=[])
    assert action == "allow"
    assert risk == "low"

    # Medium risk -> review
    action, risk = engine.evaluate(score=0.55, structural_flags=[])
    assert action == "review"
    assert risk == "medium"

    # High risk -> simulated_block (must be labeled simulated_block per ADR-006)
    action, risk = engine.evaluate(score=0.85, structural_flags=[])
    assert action == "simulated_block"
    assert risk == "high"


def test_deterministic_policy_structural_override() -> None:
    """Verify critical graph patterns elevate allow scores to review."""
    engine = DeterministicPolicyEngine(allow_threshold=0.35, block_threshold=0.80)

    # Low score with circular_flow -> elevates to review
    action, risk = engine.evaluate(score=0.20, structural_flags=["circular_flow"])
    assert action == "review"
    assert risk == "medium"
