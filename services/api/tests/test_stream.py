"""Escalation policy and the streaming investigation endpoint (ADR-023).

No network and no database: fake graph tools, a scripted model, and a fake
graph handle for Cypher recording.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient
from helpers import FakeGraphTools, FakeScoreRepository, assert_no_labels
from test_llm_agent import ANCHOR, SECOND, FakeSession, calls, draft, make_client

from api import schemas
from api.app import create_app, get_graph_tools, get_score_repository
from api.cypher_log import EXECUTED_CYPHER_KEY, CypherRecordingTools, RecordingGraph
from api.dependencies import get_graph_presence
from api.llm.provider import Turn
from api.policy import escalate, route_for
from api.settings import Settings


def parse_sse(text: str) -> list[tuple[str, dict[str, Any]]]:
    events: list[tuple[str, dict[str, Any]]] = []
    for frame in text.strip().split("\n\n"):
        name = ""
        data = ""
        for line in frame.splitlines():
            if line.startswith("event: "):
                name = line[len("event: ") :]
            elif line.startswith("data: "):
                data = line[len("data: ") :]
        events.append((name, json.loads(data)))
    return events


def llm_report(level: int | None, *, source: str = "llm") -> schemas.InvestigationReport:
    return schemas.InvestigationReport(
        hypothesis="h",
        supporting_transaction_ids=["t"],
        counterevidence_ids=[],
        recommendation="review",
        validation="validated",
        source=source,  # type: ignore[arg-type]
        risk_level=level,
    )


# Policy ---------------------------------------------------------------------


@pytest.mark.parametrize(
    ("score", "block", "expected"),
    [
        (0.9995, 0.999, "blocked_by_rule"),
        (0.6, 0.999, "flagged_for_review"),
        (0.2, 0.999, "standard_path"),
        (0.9995, None, "flagged_for_review"),
    ],
)
def test_route_for(score: float, block: float | None, expected: str) -> None:
    assert route_for(score, 0.5, block) == expected


@pytest.mark.parametrize(
    ("score", "level", "outcome", "decided_by"),
    [
        (0.6, 5, "block", "agent"),
        (0.6, 4, "block", "agent"),
        (0.6, 3, "allow", "agent"),
        (0.6, 1, "allow", "agent"),
        (0.6, None, "pending_review", "model"),
        # The agent cannot reverse an upstream block, whatever it rates.
        (0.9995, 1, "block", "rule"),
        # The agent does not change a standard-path allow.
        (0.2, 5, "allow", "model"),
    ],
)
def test_escalation_table(score: float, level: int | None, outcome: str, decided_by: str) -> None:
    decision = escalate(
        score=score,
        review_threshold=0.5,
        block_threshold=0.999,
        report=llm_report(level),
        agent_requested=True,
    )
    assert (decision.outcome, decision.decided_by) == (outcome, decided_by)
    assert decision.simulated is True


def test_deterministic_report_never_supplies_a_risk_level() -> None:
    decision = escalate(
        score=0.6,
        review_threshold=0.5,
        block_threshold=0.999,
        report=llm_report(5, source="deterministic"),
        agent_requested=True,
    )
    assert decision.risk_level is None
    assert decision.outcome == "pending_review"


def test_unavailable_agent_keeps_the_transaction_flagged_with_a_reason() -> None:
    report = llm_report(None, source="deterministic").model_copy(
        update={
            "llm": schemas.LlmRunInfo(
                provider="gemini", model="m", status="unavailable", fallback_reason="not_configured"
            )
        }
    )
    decision = escalate(
        score=0.6, review_threshold=0.5, block_threshold=None, report=report, agent_requested=True
    )
    assert decision.outcome == "pending_review"
    assert decision.agent_status == "unavailable"
    assert decision.reason.startswith("No LLM provider is configured")


def test_blank_block_threshold_disables_the_rule(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("TRACEAML_BLOCK_THRESHOLD", "")
    assert Settings(_env_file=None).block_threshold is None


# Routes ---------------------------------------------------------------------


def deterministic_client(
    tmp_path: Path, tools: Any = None, scores: dict[str, tuple[float, str]] | None = None
) -> TestClient:
    config = tmp_path / "baseline_config.json"
    config.write_text(json.dumps({"thresholds": {"lgbm": 0.5}}), encoding="utf-8")
    app = create_app(
        Settings(_env_file=None, baseline_config_path=str(config), block_threshold=0.95)
    )
    app.dependency_overrides[get_score_repository] = lambda: FakeScoreRepository(
        scores or {"tx_1": (0.9, "2022-09-01 00:00"), "tx_2": (0.1, "2022-09-01 00:01"),
                   "tx_3": (0.99, "2022-09-01 00:02")}
    )
    app.dependency_overrides[get_graph_tools] = lambda: tools or FakeGraphTools()
    return TestClient(app, raise_server_exceptions=False)


def test_alerts_carry_the_model_route(tmp_path: Path) -> None:
    body = deterministic_client(tmp_path).get("/api/alerts").json()
    routes = {item["transaction_id"]: item["route"] for item in body["items"]}
    assert routes == {
        "tx_3": "blocked_by_rule",
        "tx_1": "flagged_for_review",
        "tx_2": "standard_path",
    }


def test_alerts_report_graph_availability_without_dropping_alerts(tmp_path: Path) -> None:
    client = deterministic_client(tmp_path)
    asked: list[list[str]] = []

    def presence(ids: list[str]) -> set[str]:
        asked.append(ids)
        return {"tx_1"}

    client.app.dependency_overrides[get_graph_presence] = lambda: presence  # type: ignore[attr-defined]
    body = client.get("/api/alerts").json()
    status = {item["transaction_id"]: item["graph_status"] for item in body["items"]}
    assert status == {"tx_3": "missing", "tx_1": "available", "tx_2": "missing"}
    assert len(asked) == 1 and sorted(asked[0]) == ["tx_1", "tx_2", "tx_3"]


def test_alerts_load_with_unknown_availability_when_the_graph_is_down(tmp_path: Path) -> None:
    client = deterministic_client(tmp_path)
    client.app.dependency_overrides[get_graph_presence] = lambda: lambda ids: None  # type: ignore[attr-defined]
    response = client.get("/api/alerts")
    assert response.status_code == 200
    assert {item["graph_status"] for item in response.json()["items"]} == {"unknown"}


def test_post_investigation_includes_the_escalation(tmp_path: Path) -> None:
    body = deterministic_client(tmp_path).post(
        "/api/investigations", json={"transaction_id": "tx_1"}
    ).json()
    assert body["escalation"]["route"] == "flagged_for_review"
    assert body["escalation"]["outcome"] == "pending_review"
    assert body["escalation"]["reason"].startswith("The agent review was not requested")


def test_deterministic_stream_reports_every_tool_call(tmp_path: Path) -> None:
    tools = FakeGraphTools(
        pattern_matches={
            "fan_out": [
                {
                    "counterparty_key": "9::z",
                    "transfers": [
                        {"transaction_id": "tx_9", "timestamp": "2022-09-01 00:05",
                         "amount_paid": 5.0, "payment_currency": "US Dollar"}
                    ],
                }
            ]
        }
    )
    response = deterministic_client(tmp_path, tools).post(
        "/api/investigations/stream", json={"transaction_id": "tx_1"}
    )
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/event-stream")
    events = parse_sse(response.text)
    for _, payload in events:
        assert_no_labels(payload)

    names = [name for name, _ in events]
    assert names[0] == "started"
    assert names[-1] == "investigation_completed"
    started = events[0][1]
    assert started["route"] == "flagged_for_review"
    assert started["agent"] == "deterministic"

    began = [p for n, p in events if n == "tool_started"]
    done = [p for n, p in events if n == "tool_completed"]
    assert len(began) == len(done) == 5
    assert {p["call_id"] for p in began} == {p["call_id"] for p in done}
    assert all(p["purpose"] for p in began)
    assert {p["origin"] for p in began} == {"policy"}

    final = events[-1][1]
    streamed = {t["transaction_id"] for p in done for t in (p["evidence"] or {}).get("transactions", [])}
    assert streamed == {t["transaction_id"] for t in final["evidence"]["transactions"]}
    assert "tx_9" in streamed
    assert len(final["tool_trace"]) == 5
    assert final["escalation"]["outcome"] == "pending_review"


def test_stream_reports_graph_errors_as_an_error_event(tmp_path: Path) -> None:
    class MissingAnchor(FakeGraphTools):
        def trace_funds(self, *args: Any, **kwargs: Any) -> dict[str, Any]:
            raise ValueError("unknown transaction_id: tx_1")

    events = parse_sse(
        deterministic_client(tmp_path, MissingAnchor())
        .post("/api/investigations/stream", json={"transaction_id": "tx_1"})
        .text
    )
    assert events[0][0] == "started"
    assert events[-1] == ("error", {"status": 404, "detail": "transaction not found in graph"})
    failed = [p for n, p in events if n == "tool_failed"]
    assert failed and failed[0]["entry"]["status"] == "error"


def test_unscored_transaction_is_a_plain_404_before_streaming(tmp_path: Path) -> None:
    response = deterministic_client(tmp_path).post(
        "/api/investigations/stream", json={"transaction_id": "nope"}
    )
    assert response.status_code == 404
    assert response.json() == {"detail": "transaction not scored"}


# LLM agent over the stream --------------------------------------------------


@pytest.mark.parametrize("transport", ["mcp", "direct"])
def test_llm_stream_shows_verified_purposes_rounds_and_the_rating(
    tmp_path: Path, transport: str
) -> None:
    session = FakeSession(
        turns=[
            calls(
                ("trace_funds", {"max_hops": 2, "purpose": f"Follow where {ANCHOR} goes next."}),
                # Cites an ID nobody returned, so its purpose is withheld.
                ("detect_flow_patterns", {"pattern": "fan_out", "purpose": "Compare with hi8-tx-99999999."}),
            ),
            Turn(),
        ],
        final=draft(risk_level=5),
    )
    client, _tools, _ = make_client(tmp_path, session, agent_tool_transport=transport)
    response = client.post(
        "/api/investigations/stream",
        json={"transaction_id": ANCHOR, "max_hops": 2, "time_window_seconds": 3600,
              "result_limit": 10, "use_llm": True},
    )
    events = parse_sse(response.text)
    for _, payload in events:
        assert_no_labels(payload)
    started = events[0][1]
    assert started["agent"] == "llm"

    purposes = {
        (p["tool"], p["origin"]): p["purpose"] for n, p in events if n == "tool_started"
    }
    assert purposes[("trace_funds", "model")] == f"Follow where {ANCHOR} goes next."
    assert purposes[("detect_flow_patterns", "model")] == (
        "The agent gave no verifiable purpose for this call."
    )
    assert purposes[("inspect_counterparties", "policy")].startswith("Fetch the alert transfer")

    phases = [p["phase"] for n, p in events if n == "agent_step"]
    assert phases[0] == "round_started"
    assert phases[-1] == "report_finished"

    final = events[-1][1]
    assert final["report"]["source"] == "llm"
    assert final["report"]["risk_level"] == 5
    assert final["report"]["reasoning"][0]["evidence_ids"] == [ANCHOR, SECOND]
    assert final["escalation"]["outcome"] == "block"
    assert final["escalation"]["decided_by"] == "agent"


def test_reasoning_citing_unreturned_records_is_rejected(tmp_path: Path) -> None:
    session = FakeSession(
        turns=[Turn()],
        final=draft(
            reasoning=[{"statement": "Unrelated.", "evidence_ids": ["hi8-tx-99999999"]}]
        ),
    )
    client, _tools, _ = make_client(tmp_path, session)
    body = client.post(
        "/api/investigations",
        json={"transaction_id": ANCHOR, "use_llm": True},
    ).json()
    assert body["report"]["source"] == "deterministic"
    assert body["report"]["llm"]["fallback_reason"] == "verification_failed"
    assert body["escalation"]["outcome"] == "pending_review"
    assert body["escalation"]["risk_level"] is None


def test_risk_level_out_of_range_is_invalid_output(tmp_path: Path) -> None:
    session = FakeSession(turns=[Turn()], final=draft(risk_level=7))
    client, _tools, _ = make_client(tmp_path, session)
    body = client.post("/api/investigations", json={"transaction_id": ANCHOR, "use_llm": True}).json()
    assert body["report"]["llm"]["fallback_reason"] == "invalid_output"


# Cypher recording ------------------------------------------------------------


class FakeResult:
    def __init__(self, rows: int) -> None:
        self.result_set = [[i] for i in range(rows)]


class FakeGraph:
    def query(self, cypher: str, params: dict[str, Any] | None = None, timeout: int = 0) -> FakeResult:
        return FakeResult(3)


class QueryingTools(FakeGraphTools):
    """Fake tools that issue statements through a recording handle."""

    def __init__(self) -> None:
        super().__init__()
        self.graph = RecordingGraph(FakeGraph())

    def trace_funds(self, transaction_id: str, max_hops: int, time_window_seconds: int, result_limit: int) -> dict[str, Any]:
        self.graph.query(
            "MATCH (t:Transaction {transaction_id: $transaction_id}) RETURN t",
            params={"transaction_id": transaction_id, "ids": ["a", "b"]},
            timeout=5000,
        )
        return super().trace_funds(transaction_id, max_hops, time_window_seconds, result_limit)


def test_recording_tools_attach_executed_cypher_only_while_active() -> None:
    tools = QueryingTools()
    plain = tools.trace_funds("tx_1", 2, 60, 10)
    assert EXECUTED_CYPHER_KEY not in plain

    recorded = CypherRecordingTools(tools).trace_funds("tx_1", 2, 60, 10)
    [statement] = recorded[EXECUTED_CYPHER_KEY]
    assert statement["cypher"].startswith("MATCH (t:Transaction")
    assert statement["parameters"] == {"transaction_id": "tx_1", "ids": ["a", "b"]}
    assert statement["rows"] == 3


def test_executed_cypher_crosses_the_mcp_boundary(tmp_path: Path) -> None:
    from test_llm_agent import LlmFakeTools

    class RecordingLlmTools(LlmFakeTools):
        def __init__(self) -> None:
            super().__init__()
            self.graph = RecordingGraph(FakeGraph())

        def trace_funds(self, transaction_id: str, max_hops: int, time_window_seconds: int, result_limit: int) -> dict[str, Any]:
            self.graph.query("MATCH (n) RETURN n", params={"max_hops": max_hops}, timeout=1)
            return super().trace_funds(transaction_id, max_hops, time_window_seconds, result_limit)

    session = FakeSession(
        turns=[calls(("trace_funds", {"max_hops": 2, "purpose": "Trace the flow."})), Turn()],
        final=draft(),
    )
    client, _tools, _ = make_client(
        tmp_path, session, RecordingLlmTools(), agent_tool_transport="mcp"
    )
    events = parse_sse(
        client.post(
            "/api/investigations/stream", json={"transaction_id": ANCHOR, "use_llm": True}
        ).text
    )
    [traced] = [p for n, p in events if n == "tool_completed" and p["entry"]["tool"] == "trace_funds"]
    assert traced["entry"]["transport"] == "mcp"
    assert traced["statements"][0]["cypher"] == "MATCH (n) RETURN n"


def test_stream_carries_the_executed_cypher(tmp_path: Path) -> None:
    events = parse_sse(
        deterministic_client(tmp_path, QueryingTools())
        .post("/api/investigations/stream", json={"transaction_id": "tx_1"})
        .text
    )
    traced = [
        p for n, p in events if n == "tool_completed" and p["entry"]["tool"] == "trace_funds"
    ]
    assert traced[0]["statements"][0]["parameters"]["transaction_id"] == "tx_1"
    final = events[-1][1]
    assert EXECUTED_CYPHER_KEY not in json.dumps(final)
