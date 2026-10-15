"""Typed FastAPI application for the TraceAML API service."""

from pathlib import Path
from typing import Annotated, Any

from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.responses import JSONResponse

from api import schemas
from api.graph import GraphUnavailable, open_graph, probe_graph
from api.investigate import (
    FalkorGraphTools,
    GraphTools,
    InvestigationFailure,
    build_investigation,
)
from api.scores import (
    ScoreArtifactInvalid,
    ScoreArtifactUnavailable,
    ScoreRepository,
    load_scores,
)
from api.settings import REPOSITORY_ROOT, Settings, get_settings


def resolve_path(value: str) -> Path:
    """Resolve a configured path relative to the repository root."""
    path = Path(value)
    return path if path.is_absolute() else REPOSITORY_ROOT / path


def get_score_repository(settings: Annotated[Settings, Depends(get_settings)]) -> ScoreRepository:
    """Load the target-free score artifact or raise an explicit service error."""
    try:
        return load_scores(str(resolve_path(settings.score_artifact)))
    except (ScoreArtifactUnavailable, ScoreArtifactInvalid) as exc:
        raise HTTPException(status_code=503, detail="score artifact unavailable") from exc


def read_threshold(settings: Settings) -> float:
    """Read the locked validation threshold for the configured score model."""
    import json

    try:
        config = json.loads(resolve_path(settings.baseline_config_path).read_text(encoding="utf-8"))
        return float(config["thresholds"][settings.score_model])
    except (OSError, ValueError, KeyError, TypeError) as exc:
        raise HTTPException(status_code=503, detail="decision threshold unavailable") from exc


def get_graph_tools(settings: Annotated[Settings, Depends(get_settings)]) -> GraphTools:
    """Open the FalkorDB graph or raise an explicit service error."""
    try:
        graph = open_graph(settings.falkordb_host, settings.falkordb_port, settings.graph_name)
    except GraphUnavailable as exc:
        raise HTTPException(status_code=503, detail="graph unavailable") from exc
    return FalkorGraphTools(graph)


def read_benchmarks(settings: Settings) -> schemas.BenchmarksResponse:
    """Load benchmark metrics or raise an explicit service error."""
    import json

    try:
        payload = json.loads(
            resolve_path(settings.baseline_metrics_path).read_text(encoding="utf-8")
        )
        if "models" not in payload:
            payload = {"models": payload}
        graph_metrics_path = resolve_path(settings.graph_metrics_path)
        if graph_metrics_path.is_file():
            graph_payload = json.loads(graph_metrics_path.read_text(encoding="utf-8"))
            graph_models = graph_payload.get("models", graph_payload)
            if not isinstance(graph_models, dict):
                raise ValueError("graph benchmark artifact must contain a models object")
            for model_name, metrics in graph_models.items():
                payload["models"].setdefault(model_name, metrics)
        return schemas.BenchmarksResponse.model_validate(payload)
    except (OSError, ValueError) as exc:
        raise HTTPException(status_code=503, detail="benchmark artifact unavailable") from exc


def create_app() -> FastAPI:
    """Build the FastAPI application."""
    app = FastAPI(title="TraceAML API", version="0.1.0")

    @app.get("/api/health", response_model=schemas.HealthResponse)
    def get_health(settings: Annotated[Settings, Depends(get_settings)]) -> schemas.HealthResponse:
        return schemas.HealthResponse(
            status="ok",
            falkordb=probe_graph(settings.falkordb_host, settings.falkordb_port),
            version=settings.app_version,
        )

    @app.get("/api/alerts", response_model=schemas.AlertsResponse)
    def get_alerts(
        settings: Annotated[Settings, Depends(get_settings)],
        repo: Annotated[ScoreRepository, Depends(get_score_repository)],
        limit: Annotated[int, Query(ge=1, le=200)] = 50,
        offset: Annotated[int, Query(ge=0)] = 0,
    ) -> schemas.AlertsResponse:
        threshold = read_threshold(settings)
        items = [
            schemas.AlertItem(
                transaction_id=transaction_id,
                timestamp=timestamp,
                score=score,
                decision="review" if score >= threshold else "allow",
            )
            for transaction_id, score, timestamp in repo.ranked(limit, offset)
        ]
        return schemas.AlertsResponse(items=items, total=len(repo), limit=limit, offset=offset)

    @app.get("/api/benchmarks", response_model=schemas.BenchmarksResponse)
    def get_benchmarks(
        settings: Annotated[Settings, Depends(get_settings)],
    ) -> schemas.BenchmarksResponse:
        return read_benchmarks(settings)

    @app.post("/api/investigations", response_model=schemas.InvestigationResponse)
    def post_investigation(
        request: schemas.InvestigationRequest,
        settings: Annotated[Settings, Depends(get_settings)],
        repo: Annotated[ScoreRepository, Depends(get_score_repository)],
        tools: Annotated[GraphTools, Depends(get_graph_tools)],
    ) -> schemas.InvestigationResponse:
        score = repo.score_for(request.transaction_id)
        if score is None:
            raise HTTPException(status_code=404, detail="transaction not scored")
        threshold = read_threshold(settings)
        try:
            return build_investigation(
                request.transaction_id,
                score,
                threshold,
                tools,
                max_hops=request.max_hops,
                time_window_seconds=request.time_window_seconds,
                result_limit=request.result_limit,
            )
        except InvestigationFailure as exc:
            raise HTTPException(status_code=500, detail=str(exc)) from exc

    @app.exception_handler(Exception)
    async def unhandled_handler(_request: Any, _exc: Exception) -> JSONResponse:
        """Last-resort guard: never leak raw exception text."""
        return JSONResponse(status_code=500, content={"detail": "internal error"})

    return app


app = create_app()
