"""Investigation domain dependencies."""

from fastapi import Depends

from api.graph.client import FalkorDBClient, get_graph_client
from api.investigations.service import InvestigationService
from api.investigations.verifier import DeterministicEvidenceVerifier, get_evidence_verifier


def get_investigation_service(
    graph_client: FalkorDBClient = Depends(get_graph_client),
    verifier: DeterministicEvidenceVerifier = Depends(get_evidence_verifier),
) -> InvestigationService:
    """FastAPI dependency for InvestigationService."""
    return InvestigationService(graph_client=graph_client, verifier=verifier)
