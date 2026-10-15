"""Tests for case management router."""

from fastapi.testclient import TestClient


def test_get_cases_list(client: TestClient) -> None:
    """Verify listing cases returns paginated list."""
    response = client.get("/api/cases?limit=10&offset=0")
    assert response.status_code == 200
    data = response.json()
    assert "items" in data
    assert "total" in data
    assert len(data["items"]) > 0


def test_post_case_review(client: TestClient) -> None:
    """Verify submitting review updates case and returns review response."""
    payload = {
        "action": "confirm",
        "reviewer_id": "analyst_carol",
        "pattern_type": "structuring",
        "notes": "Verified transaction ring.",
    }
    response = client.post("/api/cases/case_001_8492/review", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["case_id"] == "case_001_8492"
    assert data["status"] == "confirmed"
    assert data["reviewer_id"] == "analyst_carol"
    assert data["provenance_recorded"] is True
