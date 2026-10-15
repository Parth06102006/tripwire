"""Tests for investigation router endpoints and error fallbacks."""

from fastapi.testclient import TestClient

from api.graph.client import get_graph_client
from api.main import create_app
from tests.conftest import MockFalkorDBClient


def test_create_investigation_success(client: TestClient) -> None:
    """Verify POST /api/investigations returns bounded evidence and verified report."""
    payload = {
        "transaction_id": "tx_hi_000184",
        "max_hops": 2,
        "time_window_seconds": 86400,
        "result_limit": 50,
    }
    response = client.post("/api/investigations", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["transaction_id"] == "tx_hi_000184"
    assert "investigation_id" in data
    assert "evidence" in data
    assert len(data["evidence"]["transactions"]) > 0
    assert data["report"] is not None
    assert data["report"]["validation_status"] == "verified"


def test_create_investigation_bounds_validation(client: TestClient) -> None:
    """Verify that max_hops > 3 is rejected with 422 Unprocessable Entity per contract."""
    payload = {
        "transaction_id": "tx_hi_000184",
        "max_hops": 5,  # Exceeds max 3
        "result_limit": 50,
    }
    response = client.post("/api/investigations", json=payload)
    assert response.status_code == 422


def test_create_investigation_falkordb_503() -> None:
    """Verify that graph disconnection returns HTTP 503 per docs/contracts.md."""
    app = create_app()
    # Inject failing FalkorDB client
    app.dependency_overrides[get_graph_client] = lambda: MockFalkorDBClient(should_fail=True)

    with TestClient(app) as failing_client:
        payload = {
            "transaction_id": "tx_hi_000184",
            "max_hops": 2,
            "result_limit": 50,
        }
        response = failing_client.post("/api/investigations", json=payload)
        assert response.status_code == 503
        data = response.json()
        assert "detail" in data
        assert "FalkorDB" in data["detail"]
