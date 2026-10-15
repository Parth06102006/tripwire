"""Global exception definitions and handlers for TraceAML API."""


from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse


class TraceAMLError(Exception):
    """Base domain exception for TraceAML."""

    def __init__(self, message: str, code: str = "INTERNAL_ERROR") -> None:
        super().__init__(message)
        self.message = message
        self.code = code


class GraphUnavailableError(TraceAMLError):
    """Raised when FalkorDB is unreachable."""

    def __init__(self, message: str = "FalkorDB is unavailable.") -> None:
        super().__init__(message, code="GRAPH_UNAVAILABLE")


class GraphQueryError(TraceAMLError):
    """Raised when a Cypher query execution fails or times out."""

    def __init__(self, message: str = "Graph query execution failed.") -> None:
        super().__init__(message, code="GRAPH_QUERY_ERROR")


class EntityNotFoundError(TraceAMLError):
    """Raised when a requested entity does not exist."""

    def __init__(self, message: str = "Entity not found.") -> None:
        super().__init__(message, code="ENTITY_NOT_FOUND")


class EvidenceValidationError(TraceAMLError):
    """Raised when investigation claims fail deterministic verification."""

    def __init__(self, message: str = "Investigation claims failed verification.") -> None:
        super().__init__(message, code="EVIDENCE_VALIDATION_ERROR")


def setup_exception_handlers(app: FastAPI) -> None:
    """Register centralized exception handlers mapping domain exceptions to HTTP responses."""

    @app.exception_handler(GraphUnavailableError)
    async def graph_unavailable_handler(
        _request: Request, exc: GraphUnavailableError
    ) -> JSONResponse:
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={"detail": exc.message},
        )

    @app.exception_handler(EntityNotFoundError)
    async def entity_not_found_handler(
        _request: Request, exc: EntityNotFoundError
    ) -> JSONResponse:
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content={"detail": exc.message},
        )

    @app.exception_handler(EvidenceValidationError)
    async def evidence_validation_handler(
        _request: Request, exc: EvidenceValidationError
    ) -> JSONResponse:
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content={"detail": exc.message},
        )
