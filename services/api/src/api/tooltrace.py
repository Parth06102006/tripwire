"""Observable trace of graph tool calls.

Every investigation records, per call: the tool, its bounded arguments, the
typed outcome, duration, result counts, and a truncation flag. The trace is
what the workbench shows and what a case action cites as ``tool_run_ids``. It
holds tool facts only, never model reasoning.

``TracingTools`` wraps any ``GraphTools`` for direct calls. The MCP bridge in
``api.mcp_graph`` extends the same base, so both transports produce the same
trace shape.
"""

from __future__ import annotations

import threading
import time
from typing import TYPE_CHECKING, Any, Literal, Protocol
from uuid import uuid4

from api import schemas

if TYPE_CHECKING:
    from api.investigate import GraphTools

ToolName = Literal["trace_funds", "inspect_counterparties", "detect_flow_patterns"]


def new_tool_run_id() -> str:
    return f"run-{uuid4().hex[:10]}"


def summarize_result(
    tool: ToolName, result: dict[str, Any], result_limit: int
) -> tuple[schemas.ToolRunOutcome, int, int, bool]:
    """Typed outcome, record count, path count, and truncation for one result.

    Truncation means a result reached its cap, so absence beyond it is unknown.
    A tool that found nothing within bounds reports ``no_matching_path``.
    """
    if tool == "detect_flow_patterns":
        matches = result.get("matches", [])
        count = len(matches)
        paths = count
    else:
        count = len(result.get("transactions", []))
        paths = len(result.get("paths", []))
    found = (paths > 0) if tool != "inspect_counterparties" else (count > 0)
    truncated = count >= result_limit or paths >= result_limit
    return ("evidence_found" if found else "no_matching_path"), count, paths, truncated


def error_outcome(exc: BaseException) -> schemas.ToolRunOutcome:
    """Map a failed tool call to ``unknown_anchor`` or ``inconclusive``."""
    from api.exceptions import TransactionNotFoundError
    from api.investigate import classify_tool_error

    if isinstance(classify_tool_error(exc), TransactionNotFoundError):
        return "unknown_anchor"
    return "inconclusive"


def classify_outcome(
    paths: list[schemas.GraphPath], trace: list[schemas.ToolTraceEntry]
) -> schemas.InvestigationOutcome:
    """Investigation-level result from the paths found and the tool trace.

    Paths win. Without paths, a capped result means the search was cut short,
    so the answer is ``inconclusive`` rather than a clean negative.
    """
    if paths:
        return "evidence_found"
    if any(entry.truncated for entry in trace):
        return "inconclusive"
    return "no_matching_path"


class ToolListener(Protocol):
    """Observer of tool calls as they start and finish (the streaming endpoint).

    Called from tool worker threads, possibly concurrently.
    """

    def tool_started(
        self,
        call_id: str,
        tool: ToolName,
        origin: schemas.ToolOrigin,
        transport: schemas.ToolTransport,
        arguments: dict[str, schemas.TraceArgument],
        purpose: str | None,
    ) -> None: ...

    def tool_finished(
        self, call_id: str, entry: schemas.ToolTraceEntry, result: dict[str, Any] | None
    ) -> None: ...


class TracedTools:
    """Base for graph tool sets that record a call trace."""

    transport: schemas.ToolTransport = "direct"

    def __init__(self) -> None:
        self.origin: schemas.ToolOrigin = "policy"
        # The agent's stated intent for the next call, set by the LLM runner
        # around each model-selected call (calls there are sequential).
        self.purpose: str | None = None
        self.listener: ToolListener | None = None
        self._trace: list[schemas.ToolTraceEntry] = []
        self._lock = threading.Lock()

    def record(self, entry: schemas.ToolTraceEntry) -> None:
        with self._lock:
            self._trace.append(entry)

    def call_started(
        self,
        tool: ToolName,
        origin: schemas.ToolOrigin,
        arguments: dict[str, schemas.TraceArgument],
    ) -> str:
        """Announce a call to the listener and return its correlation ID."""
        call_id = f"call-{uuid4().hex[:10]}"
        if self.listener is not None:
            self.listener.tool_started(
                call_id, tool, origin, self.transport, arguments, self.purpose
            )
        return call_id

    def call_finished(
        self, call_id: str, entry: schemas.ToolTraceEntry, result: dict[str, Any] | None
    ) -> None:
        """Record the trace entry and tell the listener."""
        self.record(entry)
        if self.listener is not None:
            self.listener.tool_finished(call_id, entry, result)

    def trace_snapshot(self) -> list[schemas.ToolTraceEntry]:
        with self._lock:
            return list(self._trace)

    def close(self) -> None:
        """Release transport resources. Direct calls hold none."""


def trace_arguments(**arguments: schemas.TraceArgument) -> dict[str, schemas.TraceArgument]:
    return dict(arguments)


class TracingTools(TracedTools):
    """Direct calls into a ``GraphTools`` implementation, with a trace."""

    transport: schemas.ToolTransport = "direct"

    def __init__(self, inner: GraphTools) -> None:
        super().__init__()
        self._inner = inner

    def _call(
        self,
        tool: ToolName,
        arguments: dict[str, schemas.TraceArgument],
        result_limit: int,
        call: Any,
    ) -> dict[str, Any]:
        run_id = new_tool_run_id()
        origin = self.origin
        call_id = self.call_started(tool, origin, arguments)
        started = time.perf_counter()
        try:
            result: dict[str, Any] = call()
        except Exception as exc:
            self.call_finished(
                call_id,
                schemas.ToolTraceEntry(
                    tool_run_id=run_id,
                    tool=tool,
                    transport=self.transport,
                    origin=origin,
                    arguments=arguments,
                    outcome=error_outcome(exc),
                    status="error",
                    duration_ms=(time.perf_counter() - started) * 1000.0,
                    result_count=0,
                    path_count=0,
                    truncated=False,
                ),
                None,
            )
            raise
        outcome, count, paths, truncated = summarize_result(tool, result, result_limit)
        self.call_finished(
            call_id,
            schemas.ToolTraceEntry(
                tool_run_id=run_id,
                tool=tool,
                transport=self.transport,
                origin=origin,
                arguments=arguments,
                outcome=outcome,
                status="ok",
                duration_ms=(time.perf_counter() - started) * 1000.0,
                result_count=count,
                path_count=paths,
                truncated=truncated,
            ),
            result,
        )
        return result

    def trace_funds(
        self, transaction_id: str, max_hops: int, time_window_seconds: int, result_limit: int
    ) -> dict[str, Any]:
        return self._call(
            "trace_funds",
            trace_arguments(
                transaction_id=transaction_id,
                max_hops=max_hops,
                time_window_seconds=time_window_seconds,
                result_limit=result_limit,
            ),
            result_limit,
            lambda: self._inner.trace_funds(
                transaction_id,
                max_hops=max_hops,
                time_window_seconds=time_window_seconds,
                result_limit=result_limit,
            ),
        )

    def inspect_counterparties(
        self, transaction_id: str, time_window_seconds: int, result_limit: int
    ) -> dict[str, Any]:
        return self._call(
            "inspect_counterparties",
            trace_arguments(
                transaction_id=transaction_id,
                time_window_seconds=time_window_seconds,
                result_limit=result_limit,
            ),
            result_limit,
            lambda: self._inner.inspect_counterparties(
                transaction_id,
                time_window_seconds=time_window_seconds,
                result_limit=result_limit,
            ),
        )

    def detect_flow_patterns(
        self, account_key: str, pattern: str, time_window_seconds: int, result_limit: int
    ) -> dict[str, Any]:
        return self._call(
            "detect_flow_patterns",
            trace_arguments(
                account_key=account_key,
                flow_pattern=pattern,
                time_window_seconds=time_window_seconds,
                result_limit=result_limit,
            ),
            result_limit,
            lambda: self._inner.detect_flow_patterns(
                account_key,
                pattern=pattern,
                time_window_seconds=time_window_seconds,
                result_limit=result_limit,
            ),
        )
