"""Typed FastAPI application for the TraceAML API service.

This module is the single service entrypoint (``api.app:app``), used by
``make dev-api``, the README commands, and the container image.
"""

from __future__ import annotations

import logging
import queue
import threading
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from datetime import date
from typing import Annotated

import anyio.to_thread
from fastapi import Depends, FastAPI, HTTPException, Query, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from api import schemas
from api.actions import apply_case_action
from api.cases.router import router as cases_router
from api.cypher_log import CypherRecordingTools
from api.database import CaseDatabase
from api.dependencies import (
    GraphPresence,
    SettingsDep,
    get_graph_presence,
    get_graph_tools,
    get_llm_session_factory,
    get_score_repository,
    read_benchmarks,
    read_threshold,
    resolve_path,
)
from api.exceptions import (
    ServiceUnavailableError,
    TraceAMLError,
    TransactionNotFoundError,
    setup_exception_handlers,
)
from api.graph import SOCKET_TIMEOUT_MARGIN_SECONDS, close_graph_pools, probe_graph
from api.investigate import POLICY_VERSION, GraphTools, build_investigation
from api.llm import SessionFactory, run_llm_investigation
from api.llm.agent import AgentProgress
from api.mcp_graph import McpGraphTools
from api.policy import escalate, route_for
from api.scores import (
    AlertFilter,
    ScoreArtifactInvalid,
    ScoreArtifactUnavailable,
    ScoreRepository,
    load_scores,
)
from api.settings import Settings
from api.stream import StreamListener, sse
from api.tooltrace import ToolListener, TracedTools, TracingTools

__all__ = ["app", "create_app", "get_graph_tools", "get_score_repository"]

logger = logging.getLogger("api")

# Sequential database calls per tool, worst case: stage one tools run two
# queries, pattern tools three. Used to bound the whole evidence phase.
QUERIES_PER_INVESTIGATION_PATH = 5


def investigation_wait_seconds(settings: Settings) -> float:
    """Upper bound for the evidence phase derived from the per-query timeout."""
    per_query = settings.graph_query_timeout_ms / 1000.0
    return QUERIES_PER_INVESTIGATION_PATH * per_query + 2 * SOCKET_TIMEOUT_MARGIN_SECONDS


def create_app(settings: Settings | None = None) -> FastAPI:
    """Build the FastAPI application with settings captured once."""
    resolved = settings if settings is not None else Settings()
    case_db = CaseDatabase(resolve_path(resolved.case_db_path))

    @asynccontextmanager
    async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
        # Warm the cached score artifact so the first queue read is not the
        # one paying for the parquet load; absence is reported per request.
        try:
            await anyio.to_thread.run_sync(
                load_scores, str(resolve_path(resolved.score_artifact))
            )
        except (ScoreArtifactUnavailable, ScoreArtifactInvalid):
            pass
        yield
        await case_db.close()
        close_graph_pools()

    app = FastAPI(title="TraceAML API", version=resolved.app_version, lifespan=lifespan)
    app.state.settings = resolved
    app.state.case_db = case_db
    setup_exception_handlers(app)

    @app.get("/api/health", response_model=schemas.HealthResponse)
    def get_health(settings: SettingsDep) -> schemas.HealthResponse:
        return schemas.HealthResponse(
            status="ok",
            falkordb=probe_graph(settings.falkordb_host, settings.falkordb_port),
            version=settings.app_version,
            llm="configured" if settings.llm_configured else "not_configured",
        )

    @app.get("/api/alerts", response_model=schemas.AlertsResponse)
    def get_alerts(
        settings: SettingsDep,
        repo: Annotated[ScoreRepository, Depends(get_score_repository)],
        presence: Annotated[GraphPresence, Depends(get_graph_presence)],
        limit: Annotated[int, Query(ge=1, le=200)] = 50,
        offset: Annotated[int, Query(ge=0)] = 0,
        route: Annotated[list[schemas.ModelRoute] | None, Query()] = None,
        min_score: Annotated[float | None, Query(ge=0, le=1)] = None,
        max_score: Annotated[float | None, Query(ge=0, le=1)] = None,
        date_from: Annotated[date | None, Query()] = None,
        date_to: Annotated[date | None, Query()] = None,
        q: Annotated[str | None, Query(max_length=64)] = None,
    ) -> schemas.AlertsResponse:
        if min_score is not None and max_score is not None and min_score > max_score:
            raise HTTPException(status_code=422, detail="min_score must not exceed max_score")
        if date_from is not None and date_to is not None and date_from > date_to:
            raise HTTPException(status_code=422, detail="date_from must not be after date_to")
        threshold = read_threshold(settings)
        page = repo.query(
            AlertFilter(
                routes=frozenset(route or ()),
                min_score=min_score,
                max_score=max_score,
                date_from=date_from.isoformat() if date_from else None,
                date_to=date_to.isoformat() if date_to else None,
                text=q.strip().lower() if q and q.strip() else None,
            ),
            review_threshold=threshold,
            block_threshold=settings.block_threshold,
            limit=limit,
            offset=offset,
        )
        ranked = page.rows
        # One indexed graph lookup for the page. Alerts missing from the graph
        # are reported, never dropped: a flagged alert must stay visible.
        present = presence([transaction_id for transaction_id, _, _ in ranked])
        items = [
            schemas.AlertItem(
                transaction_id=transaction_id,
                timestamp=timestamp,
                score=score,
                decision="review" if score >= threshold else "allow",
                route=route_for(score, threshold, settings.block_threshold),
                graph_status=(
                    "unknown"
                    if present is None
                    else "available"
                    if transaction_id in present
                    else "missing"
                ),
            )
            for transaction_id, score, timestamp in ranked
        ]
        return schemas.AlertsResponse(
            items=items,
            total=page.total,
            limit=limit,
            offset=offset,
            scored_total=len(repo),
            route_counts=schemas.RouteCounts(**page.route_counts),
        )

    @app.get("/api/benchmarks", response_model=schemas.BenchmarksResponse)
    def get_benchmarks(settings: SettingsDep) -> schemas.BenchmarksResponse:
        return read_benchmarks(settings)

    @app.post("/api/investigations", response_model=schemas.InvestigationResponse)
    async def post_investigation(
        request: schemas.InvestigationRequest,
        http_request: Request,
        settings: SettingsDep,
        repo: Annotated[ScoreRepository, Depends(get_score_repository)],
        tools: Annotated[GraphTools, Depends(get_graph_tools)],
        session_factory: Annotated[SessionFactory, Depends(get_llm_session_factory)],
    ) -> schemas.InvestigationResponse:
        score = repo.score_for(request.transaction_id)
        if score is None:
            raise TransactionNotFoundError()
        threshold = read_threshold(settings)
        response = await anyio.to_thread.run_sync(
            lambda: run_investigation(request, score, threshold, tools, settings, session_factory)
        )
        return await finish_investigation(request, response, threshold, settings, http_request)

    @app.post("/api/investigations/stream")
    async def stream_investigation(
        request: schemas.InvestigationRequest,
        http_request: Request,
        settings: SettingsDep,
        repo: Annotated[ScoreRepository, Depends(get_score_repository)],
        tools: Annotated[GraphTools, Depends(get_graph_tools)],
        session_factory: Annotated[SessionFactory, Depends(get_llm_session_factory)],
    ) -> StreamingResponse:
        # Errors known before the first event keep their plain HTTP status.
        score = repo.score_for(request.transaction_id)
        if score is None:
            raise TransactionNotFoundError()
        threshold = read_threshold(settings)
        started = schemas.StreamStarted(
            transaction_id=request.transaction_id,
            risk_score=score,
            decision="review" if score >= threshold else "allow",
            route=route_for(score, threshold, settings.block_threshold),
            review_threshold=threshold,
            block_threshold=settings.block_threshold,
            policy_version=POLICY_VERSION,
            max_hops=request.max_hops,
            time_window_seconds=request.time_window_seconds,
            result_limit=request.result_limit,
            agent="llm" if request.use_llm and settings.llm_configured else "deterministic",
            llm_provider=settings.llm_provider if request.use_llm else None,
            llm_model=settings.llm_model if request.use_llm else None,
        )
        events: queue.Queue[tuple[str, BaseModel] | None] = queue.Queue()

        def emit(name: str, payload: BaseModel) -> None:
            events.put((name, payload))

        def work() -> None:
            try:
                response = run_investigation(
                    request,
                    score,
                    threshold,
                    CypherRecordingTools(tools),
                    settings,
                    session_factory,
                    listener=StreamListener(emit, request.transaction_id),
                    progress=lambda phase, round_number, calls: emit(
                        "agent_step",
                        schemas.StreamAgentStep(phase=phase, round=round_number, tool_calls=calls),
                    ),
                )
                emit(RESULT_EVENT, response)
            except TraceAMLError as exc:
                emit("error", schemas.StreamError(status=exc.status_code, detail=exc.detail))
            except Exception:
                logger.exception("stream investigation failed")
                emit("error", schemas.StreamError(status=500, detail="internal error"))
            finally:
                events.put(None)

        async def body() -> AsyncIterator[str]:
            yield sse("started", started)
            threading.Thread(target=work, name="investigation-stream", daemon=True).start()
            while (item := await anyio.to_thread.run_sync(events.get)) is not None:
                name, payload = item
                if name != RESULT_EVENT:
                    yield sse(name, payload)
                    continue
                assert isinstance(payload, schemas.InvestigationResponse)
                try:
                    final = await finish_investigation(
                        request, payload, threshold, settings, http_request
                    )
                except TraceAMLError as exc:
                    yield sse("error", schemas.StreamError(status=exc.status_code, detail=exc.detail))
                    continue
                yield sse("investigation_completed", final)

        return StreamingResponse(
            body(),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no"},
        )

    app.include_router(cases_router)
    return app


RESULT_EVENT = "__result__"


def run_investigation(
    request: schemas.InvestigationRequest,
    score: float,
    threshold: float,
    tools: GraphTools,
    settings: Settings,
    session_factory: SessionFactory,
    *,
    listener: ToolListener | None = None,
    progress: AgentProgress | None = None,
) -> schemas.InvestigationResponse:
    """Run the deterministic or LLM investigation on the calling thread."""
    # The LLM agent reaches graph tools through the MCP boundary; the
    # deterministic path calls them directly. Both record a trace.
    traced: TracedTools
    if request.use_llm and settings.agent_tool_transport == "mcp":
        traced = McpGraphTools(tools)
    else:
        traced = TracingTools(tools)
    traced.listener = listener
    try:
        if request.use_llm:
            return run_llm_investigation(
                request.transaction_id,
                score,
                threshold,
                traced,
                max_hops=request.max_hops,
                time_window_seconds=request.time_window_seconds,
                result_limit=request.result_limit,
                settings=settings,
                session_factory=session_factory,
                wait_timeout_seconds=investigation_wait_seconds(settings),
                progress=progress,
            )
        return build_investigation(
            request.transaction_id,
            score,
            threshold,
            traced,
            max_hops=request.max_hops,
            time_window_seconds=request.time_window_seconds,
            result_limit=request.result_limit,
            wait_timeout_seconds=investigation_wait_seconds(settings),
        )
    finally:
        traced.close()


async def finish_investigation(
    request: schemas.InvestigationRequest,
    response: schemas.InvestigationResponse,
    threshold: float,
    settings: Settings,
    http_request: Request,
) -> schemas.InvestigationResponse:
    """Attach the escalation decision and, if requested, the gated case action."""
    response = response.model_copy(
        update={
            "escalation": escalate(
                score=response.risk_score,
                review_threshold=threshold,
                block_threshold=settings.block_threshold,
                report=response.report,
                agent_requested=request.use_llm,
            )
        }
    )
    if not request.act:
        return response
    database: CaseDatabase = http_request.app.state.case_db
    try:
        await database.initialize()
    except Exception as exc:
        raise ServiceUnavailableError("case store unavailable") from exc
    async with database.sessions() as session:
        action = await apply_case_action(response, session)
    return response.model_copy(update={"action": action})


app = create_app()
