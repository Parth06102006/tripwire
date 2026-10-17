"""Server-sent events for ``POST /api/investigations/stream``.

The investigation itself is unchanged: the same deterministic or LLM path
runs on a worker thread. A ``StreamListener`` on the traced tools turns each
graph tool call into events as it happens, carrying the Cypher the call
executed and the evidence it returned, shaped through the same allowlists as
the final response. The final event is the complete ``InvestigationResponse``,
which stays the authority: the per-call evidence is a progressive view of it.

Events, in order: ``started``; then ``tool_started`` and ``tool_completed``
or ``tool_failed`` per call (concurrent on the deterministic path), with
``agent_step`` between LLM rounds; then ``investigation_completed``, or
``error`` with the same fixed detail the non-streaming endpoint would send.
"""

from __future__ import annotations

import json
import logging
from collections.abc import Callable
from typing import Any

from pydantic import BaseModel

from api import schemas
from api.cypher_log import executed_statements
from api.exceptions import InvestigationError
from api.investigate import EvidenceBuilder
from api.tooltrace import ToolName

logger = logging.getLogger("api.stream")

Emit = Callable[[str, BaseModel], None]

_PATTERN_PURPOSE = {
    "fan_out": "Check whether the sender pays many different accounts in the window (fan-out).",
    "fan_in": "Check whether the receiver is paid by many different accounts in the window (fan-in).",
    "pass_through": (
        "Check whether the receiver forwards incoming funds onward within the window "
        "(pass-through)."
    ),
}


def policy_purpose(tool: ToolName, arguments: dict[str, schemas.TraceArgument]) -> str:
    """Fixed, code-written purpose for a call made by policy rather than the model."""
    if tool == "inspect_counterparties":
        return "Fetch the alert transfer and the other transfers of its two accounts in the window."
    if tool == "trace_funds":
        hops = arguments.get("max_hops")
        return f"Trace money up to {hops} hops before and after the alert transfer."
    return _PATTERN_PURPOSE.get(str(arguments.get("flow_pattern")), "Check a bounded flow pattern.")


def evidence_delta(
    anchor_transaction_id: str,
    tool: ToolName,
    arguments: dict[str, schemas.TraceArgument],
    result: dict[str, Any],
) -> schemas.EvidenceDelta | None:
    """Shape one tool result exactly as the final evidence is shaped."""
    builder = EvidenceBuilder(anchor_transaction_id)
    try:
        if tool == "detect_flow_patterns":
            pattern = str(arguments.get("flow_pattern"))
            if pattern not in ("fan_out", "fan_in", "pass_through"):
                return None
            builder.add_pattern(pattern, str(arguments.get("account_key")), result)  # type: ignore[arg-type]
        else:
            builder.add_traversal(tool, result)
    except InvestigationError:
        return None
    return schemas.EvidenceDelta(
        transactions=list(builder.transactions.values()),
        accounts=list(builder.accounts.values()),
        paths=builder.paths,
    )


class StreamListener:
    """Tool listener that emits stream events. Safe to call from many threads."""

    def __init__(self, emit: Emit, anchor_transaction_id: str) -> None:
        self._emit = emit
        self._anchor = anchor_transaction_id
        self._calls: dict[str, tuple[ToolName, dict[str, schemas.TraceArgument]]] = {}

    def tool_started(
        self,
        call_id: str,
        tool: ToolName,
        origin: schemas.ToolOrigin,
        transport: schemas.ToolTransport,
        arguments: dict[str, schemas.TraceArgument],
        purpose: str | None,
    ) -> None:
        self._calls[call_id] = (tool, arguments)
        if purpose is None:
            purpose = (
                policy_purpose(tool, arguments)
                if origin == "policy"
                else "The agent gave no verifiable purpose for this call."
            )
        self._emit(
            "tool_started",
            schemas.StreamToolStarted(
                call_id=call_id,
                tool=tool,
                origin=origin,
                transport=transport,
                arguments=arguments,
                purpose=purpose,
            ),
        )

    def tool_finished(
        self, call_id: str, entry: schemas.ToolTraceEntry, result: dict[str, Any] | None
    ) -> None:
        tool, arguments = self._calls.pop(call_id, (entry.tool, entry.arguments))
        ok = entry.status == "ok" and result is not None
        try:
            statements = executed_statements(result)
        except ValueError:
            statements = []
        self._emit(
            "tool_completed" if ok else "tool_failed",
            schemas.StreamToolFinished(
                call_id=call_id,
                entry=entry,
                statements=statements,
                evidence=evidence_delta(self._anchor, tool, arguments, result)
                if ok and result is not None
                else None,
            ),
        )


def sse(event: str, payload: BaseModel) -> str:
    """One server-sent event frame."""
    data = json.dumps(payload.model_dump(mode="json"), separators=(",", ":"))
    return f"event: {event}\ndata: {data}\n\n"
