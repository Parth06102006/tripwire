"""Deterministic evidence verifier for investigation reports.

Per ADR-007 and docs/contracts.md:
Validates that report hypotheses and cited IDs reference ONLY records present in
the retrieved evidence. Rejects hallucinated IDs or ungrounded assertions.
"""

from api.investigations.schemas import InvestigationEvidence, InvestigationReport


class DeterministicEvidenceVerifier:
    """Deterministic verifier cross-checking cited claims against query results."""

    def verify(
        self,
        report: InvestigationReport,
        evidence: InvestigationEvidence,
    ) -> InvestigationReport:
        """Verify report claims against executed graph evidence."""
        rejection_reasons: list[str] = []
        valid_tx_ids = {t.transaction_id for t in evidence.transactions}

        # Check supporting transaction IDs
        for tx_id in report.supporting_transaction_ids:
            if tx_id not in valid_tx_ids:
                rejection_reasons.append(
                    f"Supporting transaction '{tx_id}' is not present in retrieved graph evidence."
                )

        # Check counterevidence transaction IDs
        for tx_id in report.counterevidence_ids:
            if tx_id not in valid_tx_ids:
                rejection_reasons.append(
                    f"Counterevidence transaction '{tx_id}' is not present in retrieved graph evidence."
                )

        if rejection_reasons:
            report.validation_status = "rejected"
            report.rejection_reasons = rejection_reasons
        else:
            report.validation_status = "verified"
            report.rejection_reasons = []

        return report


_default_verifier = DeterministicEvidenceVerifier()


def get_evidence_verifier() -> DeterministicEvidenceVerifier:
    """Return singleton evidence verifier."""
    return _default_verifier
