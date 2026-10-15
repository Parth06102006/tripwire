"""Investigation domain service."""

import uuid
from datetime import UTC, datetime

from api.graph.client import FalkorDBClient
from api.investigations.schemas import (
    InvestigationEvidence,
    InvestigationReport,
    InvestigationRequest,
    InvestigationResponse,
)
from api.investigations.verifier import DeterministicEvidenceVerifier, get_evidence_verifier


class InvestigationService:
    """Coordinates bounded graph traversal, report drafting, and deterministic evidence verification."""

    def __init__(
        self,
        graph_client: FalkorDBClient,
        verifier: DeterministicEvidenceVerifier | None = None,
    ) -> None:
        self.graph_client = graph_client
        self.verifier = verifier or get_evidence_verifier()

    async def run_investigation(
        self,
        request: InvestigationRequest,
    ) -> InvestigationResponse:
        """Execute bounded graph query against FalkorDB and verify evidence."""
        # Query FalkorDB using bounded trace_funds
        graph_result = await self.graph_client.trace_funds(
            transaction_id=request.transaction_id,
            max_hops=request.max_hops,
            time_window_seconds=request.time_window_seconds,
            limit=request.result_limit,
        )

        evidence = InvestigationEvidence(
            transactions=graph_result.transactions,
            accounts=graph_result.accounts,
            paths=graph_result.paths,
            query_duration_ms=graph_result.query_duration_ms,
        )

        # Build investigation report if evidence is found
        report: InvestigationReport | None = None
        if evidence.transactions:
            # Generate grounded hypothesis draft
            root_tx = next(
                (t for t in evidence.transactions if t.transaction_id == request.transaction_id),
                evidence.transactions[0],
            )
            supporting_ids = [t.transaction_id for t in evidence.transactions[:3]]

            draft_report = InvestigationReport(
                hypothesis=f"Transaction {root_tx.transaction_id} is part of a {len(evidence.paths)}-path flow involving {len(evidence.accounts)} accounts.",
                supporting_transaction_ids=supporting_ids,
                counterevidence_ids=[],
                recommendation="Conduct manual review of counterparty beneficiary accounts.",
                validation_status="unverified",
            )
            # Run deterministic verification
            report = self.verifier.verify(draft_report, evidence)

        return InvestigationResponse(
            investigation_id=f"inv_{uuid.uuid4().hex[:12]}",
            transaction_id=request.transaction_id,
            evidence=evidence,
            report=report,
            created_at=datetime.now(UTC).isoformat(),
        )
