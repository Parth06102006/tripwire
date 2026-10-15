"""Pagination schemas and dependency parameters."""

from pydantic import BaseModel, Field

from api.constants import DEFAULT_PAGINATION_LIMIT, MAX_PAGINATION_LIMIT


class PaginationParams(BaseModel):
    """Pagination query parameters."""

    limit: int = Field(
        default=DEFAULT_PAGINATION_LIMIT,
        ge=1,
        le=MAX_PAGINATION_LIMIT,
        description="Maximum number of items to return",
    )
    offset: int = Field(
        default=0,
        ge=0,
        description="Number of items to skip",
    )


class PaginatedResponse[T](BaseModel):
    """Generic paginated response envelope."""

    items: list[T]
    total: int
    limit: int
    offset: int
