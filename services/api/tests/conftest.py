"""Pytest fixtures for domain-driven testing of TraceAML API.

Uses TestClient for clean ASGI routing and reliable cross-pytest compatibility.
"""

from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient

from api.graph.client import FalkorDBClient, get_graph_client
from api.graph.schemas import GraphPath, GraphQueryResult, TransactionEvidence
from api.main import create_app


class MockFalkorDBClient(FalkorDBClient):
    """Mock FalkorDB client returning deterministic graph evidence without a live database."""

    def __init__(self, should_fail: bool = False) -> None:
        self.should_fail = should_fail
        super().__init__(host="mock", port=6379)

    async def trace_funds(
        self,
        transaction_id: str,
        max_hops: int = 2,
        time_window_seconds: int | None = None,
        limit: int = 50,
    ) -> GraphQueryResult:
        if self.should_fail:
            from api.exceptions import GraphUnavailableError

            raise GraphUnavailableError("Mocked FalkorDB connection failure.")

        tx = TransactionEvidence(
            transaction_id=transaction_id,
            timestamp=1697328000,
            source_account_key="acc_bank_01_9921",
            destination_account_key="acc_bank_04_1184",
            amount=48500.0,
            currency="USD",
            payment_type="wire",
        )
        path = GraphPath(
            nodes=["acc_bank_01_9921", transaction_id, "acc_bank_04_1184"],
            relationships=["SENT", "RECEIVED"],
        )
        return GraphQueryResult(
            transactions=[tx],
            accounts=["acc_bank_01_9921", "acc_bank_04_1184"],
            paths=[path],
            query_duration_ms=4.2,
        )


@pytest.fixture
def mock_graph_client() -> FalkorDBClient:
    """Return a working mock graph client."""
    return MockFalkorDBClient(should_fail=False)


@pytest.fixture
def failing_graph_client() -> FalkorDBClient:
    """Return a failing mock graph client to test 503 errors."""
    return MockFalkorDBClient(should_fail=True)


@pytest.fixture
def client(mock_graph_client: FalkorDBClient) -> Generator[TestClient, None, None]:
    """Provide a TestClient with lifespan context and mocked graph client."""
    app = create_app()
    app.dependency_overrides[get_graph_client] = lambda: mock_graph_client
    with TestClient(app) as test_client:
        yield test_client
