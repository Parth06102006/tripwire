"""Alert queue filters: route, score window, day range and transaction ID text."""

from __future__ import annotations

import json
import random
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from helpers import FakeGraphTools, FakeScoreRepository, assert_no_labels

from api.app import create_app, get_graph_tools, get_score_repository
from api.scores import ROUTES, AlertFilter, ScoreRepository

REVIEW_THRESHOLD = 0.5
BLOCK_THRESHOLD = 0.95

SCORES = {
    "tx_block_a": (0.99, "2022-09-01 08:00"),
    "tx_block_b": (0.96, "2022-09-02 08:00"),
    "tx_flag_a": (0.80, "2022-09-01 09:00"),
    "tx_flag_b": (0.60, "2022-09-03 09:00"),
    "tx_std_a": (0.30, "2022-09-01 10:00"),
    "tx_std_b": (0.10, "2022-09-04 10:00"),
}


@pytest.fixture
def client(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> TestClient:
    config = tmp_path / "baseline_config.json"
    config.write_text(json.dumps({"thresholds": {"lgbm": REVIEW_THRESHOLD}}), encoding="utf-8")
    monkeypatch.setenv("TRACEAML_BASELINE_CONFIG_PATH", str(config))
    monkeypatch.setenv("TRACEAML_BLOCK_THRESHOLD", str(BLOCK_THRESHOLD))
    app = create_app()
    app.dependency_overrides[get_score_repository] = lambda: FakeScoreRepository(SCORES)
    app.dependency_overrides[get_graph_tools] = lambda: FakeGraphTools()
    return TestClient(app, raise_server_exceptions=False)


def ids(payload: dict[str, object]) -> list[str]:
    items = payload["items"]
    assert isinstance(items, list)
    return [item["transaction_id"] for item in items]


def test_unfiltered_queue_reports_counts_per_route(client: TestClient) -> None:
    payload = client.get("/api/alerts").json()
    assert payload["total"] == 6
    assert payload["scored_total"] == 6
    assert payload["route_counts"] == {
        "blocked_by_rule": 2,
        "flagged_for_review": 2,
        "standard_path": 2,
    }
    assert_no_labels(payload)


def test_route_filter_narrows_rows_but_not_route_counts(client: TestClient) -> None:
    payload = client.get("/api/alerts?route=blocked_by_rule").json()
    assert ids(payload) == ["tx_block_a", "tx_block_b"]
    assert payload["total"] == 2
    assert payload["scored_total"] == 6
    assert payload["route_counts"]["standard_path"] == 2


def test_several_routes_keep_rank_order_and_page_across_them(client: TestClient) -> None:
    query = "route=flagged_for_review&route=standard_path"
    payload = client.get(f"/api/alerts?{query}").json()
    assert ids(payload) == ["tx_flag_a", "tx_flag_b", "tx_std_a", "tx_std_b"]
    assert payload["total"] == 4
    paged = client.get(f"/api/alerts?{query}&offset=1&limit=2").json()
    assert ids(paged) == ["tx_flag_b", "tx_std_a"]
    assert paged["total"] == 4


def test_score_window_is_inclusive(client: TestClient) -> None:
    payload = client.get("/api/alerts?min_score=0.6&max_score=0.8").json()
    assert ids(payload) == ["tx_flag_a", "tx_flag_b"]
    assert payload["route_counts"] == {
        "blocked_by_rule": 0,
        "flagged_for_review": 2,
        "standard_path": 0,
    }


def test_day_range_is_inclusive_and_counts_follow_it(client: TestClient) -> None:
    payload = client.get("/api/alerts?date_from=2022-09-02&date_to=2022-09-03").json()
    assert ids(payload) == ["tx_block_b", "tx_flag_b"]
    assert payload["route_counts"] == {
        "blocked_by_rule": 1,
        "flagged_for_review": 1,
        "standard_path": 0,
    }


def test_text_matches_transaction_id_ignoring_case(client: TestClient) -> None:
    for text in ("FLAG", "%20flag%20"):
        assert ids(client.get(f"/api/alerts?q={text}").json()) == ["tx_flag_a", "tx_flag_b"]
    assert client.get("/api/alerts?q=%20").json()["total"] == 6


def test_filters_combine(client: TestClient) -> None:
    payload = client.get("/api/alerts?route=blocked_by_rule&date_from=2022-09-02").json()
    assert ids(payload) == ["tx_block_b"]
    assert payload["total"] == 1
    assert payload["route_counts"] == {
        "blocked_by_rule": 1,
        "flagged_for_review": 1,
        "standard_path": 1,
    }


@pytest.mark.parametrize(
    "query",
    [
        "min_score=0.9&max_score=0.1",
        "date_from=2022-09-05&date_to=2022-09-01",
        "route=made_up",
        "min_score=1.5",
        "date_from=not-a-date",
        "q=" + "x" * 65,
    ],
)
def test_invalid_filters_are_rejected(client: TestClient, query: str) -> None:
    assert client.get(f"/api/alerts?{query}").status_code == 422


def naive(
    entries: dict[str, tuple[float, str]], selection: AlertFilter
) -> tuple[list[str], dict[str, int]]:
    def route_of(score: float) -> str:
        if score >= BLOCK_THRESHOLD:
            return "blocked_by_rule"
        return "flagged_for_review" if score >= REVIEW_THRESHOLD else "standard_path"

    ranked = sorted(entries.items(), key=lambda kv: (-kv[1][0], kv[0]))
    counts = dict.fromkeys(ROUTES, 0)
    matches: list[str] = []
    for transaction_id, (score, timestamp) in ranked:
        if selection.min_score is not None and score < selection.min_score:
            continue
        if selection.max_score is not None and score > selection.max_score:
            continue
        if selection.date_from and timestamp[:10] < selection.date_from:
            continue
        if selection.date_to and timestamp[:10] > selection.date_to:
            continue
        if selection.text and selection.text not in transaction_id.lower():
            continue
        route = route_of(score)
        counts[route] += 1
        if not selection.routes or route in selection.routes:
            matches.append(transaction_id)
    return matches, counts


def test_query_matches_a_brute_force_scan() -> None:
    rng = random.Random(7)
    entries = {
        f"tx_{index:04d}": (
            round(rng.random(), 3),
            f"2022-09-{rng.randint(1, 9):02d} {rng.randint(0, 23):02d}:00",
        )
        for index in range(400)
    }
    repo = ScoreRepository(entries)
    selections = [
        AlertFilter(),
        AlertFilter(routes=frozenset({"blocked_by_rule"})),
        AlertFilter(routes=frozenset({"flagged_for_review", "standard_path"})),
        AlertFilter(min_score=0.2, max_score=0.97),
        AlertFilter(routes=frozenset({"standard_path"}), min_score=0.05, max_score=0.45),
        AlertFilter(date_from="2022-09-03", date_to="2022-09-05"),
        AlertFilter(routes=frozenset({"flagged_for_review"}), text="7"),
        AlertFilter(min_score=0.9, date_from="2022-09-02", text="tx_01"),
    ]
    for selection in selections:
        expected_ids, expected_counts = naive(entries, selection)
        for offset, limit in ((0, 10_000), (0, 7), (5, 7), (len(expected_ids), 3)):
            page = repo.query(
                selection,
                review_threshold=REVIEW_THRESHOLD,
                block_threshold=BLOCK_THRESHOLD,
                limit=limit,
                offset=offset,
            )
            assert [row[0] for row in page.rows] == expected_ids[offset : offset + limit]
            assert page.total == len(expected_ids)
            assert page.route_counts == expected_counts


def test_query_without_a_block_rule_has_no_blocked_alerts() -> None:
    repo = ScoreRepository(SCORES)
    page = repo.query(
        AlertFilter(),
        review_threshold=REVIEW_THRESHOLD,
        block_threshold=None,
        limit=10,
        offset=0,
    )
    assert page.route_counts == {
        "blocked_by_rule": 0,
        "flagged_for_review": 4,
        "standard_path": 2,
    }
