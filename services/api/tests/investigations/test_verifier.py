"""Tests for deterministic evidence verifier."""

from api.graph.schemas import TransactionEvidence
from api.investigations.schemas import InvestigationEvidence, InvestigationReport
from api.investigations.verifier import DeterministicEvidenceVerifier


def test_verifier_accepts_valid_citations() -> None:
    """Verify that verifier marks report as verified when all cited IDs exist."""
    verifier = DeterministicEvidenceVerifier()
    evidence = InvestigationEvidence(
        transactions=[
            TransactionEvidence(
                transaction_id="tx_001",
                timestamp=1000,
                source_account_key="acc_1",
                destination_account_key="acc_2",
            ),
            TransactionEvidence(
                transaction_id="tx_002",
                timestamp=2000,
                source_account_key="acc_2",
                destination_account_key="acc_3",
            ),
        ]
    )
    report = InvestigationReport(
        hypothesis="Flow from acc_1 to acc_3",
        supporting_transaction_ids=["tx_001", "tx_002"],
        counterevidence_ids=[],
        recommendation="Review transactions",
    )

    verified_report = verifier.verify(report, evidence)
    assert verified_report.validation_status == "verified"
    assert len(verified_report.rejection_reasons) == 0


def test_verifier_rejects_hallucinated_transaction_id() -> None:
    """Verify that verifier rejects reports citing non-existent transaction IDs."""
    verifier = DeterministicEvidenceVerifier()
    evidence = InvestigationEvidence(
        transactions=[
            TransactionEvidence(
                transaction_id="tx_001",
                timestamp=1000,
                source_account_key="acc_1",
                destination_account_key="acc_2",
            )
        ]
    )
    report = InvestigationReport(
        hypothesis="Flow to fake transaction",
        supporting_transaction_ids=["tx_001", "tx_hallucinated_999"],
        counterevidence_ids=[],
        recommendation="Block entity",
    )

    verified_report = verifier.verify(report, evidence)
    assert verified_report.validation_status == "rejected"
    assert len(verified_report.rejection_reasons) == 1
    assert "tx_hallucinated_999" in verified_report.rejection_reasons[0]
