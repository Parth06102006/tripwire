"""Main application module for TraceAML API service.

Adheres strictly to zhanymkanov/fastapi-best-practices.
"""

from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.alerts.router import router as alerts_router
from api.cases.router import router as cases_router
from api.config import get_settings
from api.constants import APP_NAME, APP_VERSION
from api.database import close_db, init_db
from api.exceptions import setup_exception_handlers
from api.health.router import router as health_router
from api.investigations.router import router as investigations_router


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncGenerator[None, None]:
    """Lifespan context manager for startup and shutdown events."""
    # Startup: Initialize database schema
    await init_db()
    yield
    # Teardown: Close database connections
    await close_db()


def create_app() -> FastAPI:
    """Build and configure the FastAPI application."""
    settings = get_settings()

    app = FastAPI(
        title=APP_NAME,
        version=APP_VERSION,
        lifespan=lifespan,
    )

    # Cross-Origin Resource Sharing (CORS)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Register centralized exception handlers
    setup_exception_handlers(app)

    # Include domain routers under base prefix /api
    app.include_router(health_router, prefix="/api")
    app.include_router(alerts_router, prefix="/api")
    app.include_router(cases_router, prefix="/api")
    app.include_router(investigations_router, prefix="/api")

    return app


app = create_app()
