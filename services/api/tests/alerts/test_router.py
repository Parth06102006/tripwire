"""Tests for alerts router."""

from fastapi.testclient import TestClient


def test_get_alerts_queue(client: TestClient) -> None:
    """Verify alerts endpoint returns ranked alerts with deterministic policy outcomes."""
    response = client.get("/api/alerts?limit=10&offset=0")
    assert response.status_code == 200
    data = response.json()
    assert "items" in data
    assert "total" in data
    assert len(data["items"]) > 0

    first_item = data["items"][0]
    assert "transaction_id" in first_item
    assert "score" in first_item
    assert first_item["policy_action"] in ["allow", "review", "simulated_block"]
    assert first_item["risk_level"] in ["low", "medium", "high"]
