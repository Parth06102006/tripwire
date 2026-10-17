"""Record the Cypher statements each graph tool call executes.

``graph.queries`` runs every statement through ``graph.query(cypher,
params=..., timeout=...)``. ``RecordingGraph`` wraps the pooled graph handle
and, while a tool call is active on the current thread, appends each
statement with its parameters, row count and duration. Recording is per
thread because every tool call runs entirely on one worker thread, for both
the direct and the MCP transport.

``CypherRecordingTools`` wraps any ``GraphTools``: it activates a log around
each call and returns the statements under ``EXECUTED_CYPHER_KEY`` beside the
tool's own result. Evidence shaping and the model payload use field
allowlists, so the statements reach the operator's stream and nothing else.
"""

from __future__ import annotations

import threading
import time
from collections.abc import Callable
from typing import Any

from api import schemas
from api.investigate import GraphTools

EXECUTED_CYPHER_KEY = "executed_cypher"

_active = threading.local()


def _parameter(value: Any) -> schemas.StatementParameter:
    if value is None or isinstance(value, str | bool | int | float):
        return value
    if isinstance(value, list | tuple):
        return [item if item is None or isinstance(item, str | bool | int | float) else str(item) for item in value]
    return str(value)


class RecordingGraph:
    """Graph handle proxy that logs statements while a recording is active."""

    def __init__(self, graph: Any) -> None:
        self._graph = graph

    def query(self, cypher: str, params: dict[str, Any] | None = None, **kwargs: Any) -> Any:
        log: list[schemas.ExecutedStatement] | None = getattr(_active, "log", None)
        started = time.perf_counter()
        result = self._graph.query(cypher, params=params, **kwargs)
        if log is not None:
            log.append(
                schemas.ExecutedStatement(
                    cypher=cypher.strip(),
                    parameters={key: _parameter(value) for key, value in (params or {}).items()},
                    rows=len(getattr(result, "result_set", None) or []),
                    duration_ms=(time.perf_counter() - started) * 1000.0,
                )
            )
        return result

    def __getattr__(self, name: str) -> Any:
        return getattr(self._graph, name)


def recording_provider(provider: Callable[[], Any]) -> Callable[[], Any]:
    """Wrap a graph-handle provider so its handles can record statements."""
    return lambda: RecordingGraph(provider())


def executed_statements(result: dict[str, Any] | None) -> list[schemas.ExecutedStatement]:
    """Statements attached to a tool result by ``CypherRecordingTools``."""
    if not result:
        return []
    raw = result.get(EXECUTED_CYPHER_KEY) or []
    return [schemas.ExecutedStatement.model_validate(item) for item in raw]


class CypherRecordingTools:
    """``GraphTools`` wrapper returning each call's executed statements."""

    def __init__(self, inner: GraphTools) -> None:
        self._inner = inner

    def _record(self, call: Callable[[], dict[str, Any]]) -> dict[str, Any]:
        log: list[schemas.ExecutedStatement] = []
        previous = getattr(_active, "log", None)
        _active.log = log
        try:
            result = call()
        finally:
            _active.log = previous
        # Plain dicts so the statements survive the MCP JSON envelope.
        return {**result, EXECUTED_CYPHER_KEY: [item.model_dump(mode="json") for item in log]}

    def trace_funds(
        self, transaction_id: str, max_hops: int, time_window_seconds: int, result_limit: int
    ) -> dict[str, Any]:
        return self._record(
            lambda: self._inner.trace_funds(
                transaction_id,
                max_hops=max_hops,
                time_window_seconds=time_window_seconds,
                result_limit=result_limit,
            )
        )

    def inspect_counterparties(
        self, transaction_id: str, time_window_seconds: int, result_limit: int
    ) -> dict[str, Any]:
        return self._record(
            lambda: self._inner.inspect_counterparties(
                transaction_id,
                time_window_seconds=time_window_seconds,
                result_limit=result_limit,
            )
        )

    def detect_flow_patterns(
        self, account_key: str, pattern: str, time_window_seconds: int, result_limit: int
    ) -> dict[str, Any]:
        return self._record(
            lambda: self._inner.detect_flow_patterns(
                account_key,
                pattern=pattern,
                time_window_seconds=time_window_seconds,
                result_limit=result_limit,
            )
        )
