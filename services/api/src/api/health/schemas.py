"""Health domain schemas."""

from typing import Literal

from pydantic import BaseModel

GraphStatus = Literal["available", "unavailable", "not_configured"]


class HealthResponse(BaseModel):
    """Health check payload per docs/contracts.md."""

    status: Literal["ok"]
    falkordb: GraphStatus
    version: str
