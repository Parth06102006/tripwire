"""Tests for health check endpoints."""

from fastapi.testclient import TestClient


def test_health_check(client: TestClient) -> None:
    """Verify health endpoint returns status, falkordb status, and version."""
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["falkordb"] in ["available", "unavailable", "not_configured"]
    assert "version" in data
