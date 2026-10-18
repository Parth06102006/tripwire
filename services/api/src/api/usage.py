"""Per-user investigation allowance: N per rolling hour and M per rolling day.

Every investigation a signed-in user starts is one row. A request is allowed
only when the user has fewer than the hourly limit in the last 3,600 seconds
and fewer than the daily limit in the last 86,400. The check and the insert are
one SQL statement, so two requests arriving together cannot both take the last
slot, even across several API processes sharing the file.

A started investigation counts whether or not it later succeeds: the cost it
guards (graph queries and, with the agent on, a model call) is spent at the
start. Requests that fail before any work, such as an unknown transaction or a
malformed body, are not counted.
"""

from __future__ import annotations

import math
import time
from collections.abc import Callable
from dataclasses import dataclass

from fastapi import Request
from sqlalchemy import Float, Index, Integer, String, and_, delete, func, insert, literal, select
from sqlalchemy.orm import Mapped, mapped_column

from api.database import Base, CaseDatabase
from api.exceptions import RateLimitedError

HOUR_SECONDS = 3_600
DAY_SECONDS = 86_400
# Rows older than this are of no use to either window and are removed.
RETENTION_SECONDS = 2 * DAY_SECONDS


class InvestigationUsage(Base):
    """One started investigation."""

    __tablename__ = "investigation_usage"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(String(128), nullable=False)
    started_at: Mapped[float] = mapped_column(Float, nullable=False)

    __table_args__ = (Index("ix_investigation_usage_user_time", "user_id", "started_at"),)


@dataclass(frozen=True)
class WindowUsage:
    limit: int
    used: int
    # Seconds until the oldest counted investigation leaves the window and a
    # slot comes back; None when nothing is counted.
    resets_in_seconds: int | None

    @property
    def remaining(self) -> int:
        return max(0, self.limit - self.used)


@dataclass(frozen=True)
class Usage:
    hour: WindowUsage
    day: WindowUsage


def _window(times: list[float], now: float, seconds: int, limit: int) -> WindowUsage:
    inside = [t for t in times if t > now - seconds]
    resets = math.ceil(inside[0] + seconds - now) if inside else None
    return WindowUsage(limit=limit, used=len(inside), resets_in_seconds=resets)


def _retry_after(times: list[float], now: float, seconds: int, limit: int) -> int:
    """Seconds until a slot frees in one full window."""
    inside = [t for t in times if t > now - seconds]
    # The slot opens when the (used - limit + 1)th oldest entry leaves.
    freeing = inside[len(inside) - limit]
    return max(1, math.ceil(freeing + seconds - now))


def get_usage_limiter(request: Request) -> UsageLimiter:
    """The limiter built at startup."""
    limiter: UsageLimiter = request.app.state.usage_limiter
    return limiter


class UsageLimiter:
    """Counts and limits investigations per user."""

    def __init__(
        self,
        database: CaseDatabase,
        *,
        hour_limit: int,
        day_limit: int,
        clock: Callable[[], float] = time.time,
    ) -> None:
        self._database = database
        self.hour_limit = hour_limit
        self.day_limit = day_limit
        self._clock = clock

    async def _times(self, user_id: str, now: float) -> list[float]:
        async with self._database.sessions() as session:
            rows = await session.execute(
                select(InvestigationUsage.started_at)
                .where(
                    InvestigationUsage.user_id == user_id,
                    InvestigationUsage.started_at > now - DAY_SECONDS,
                )
                .order_by(InvestigationUsage.started_at)
            )
            return [float(value) for value in rows.scalars().all()]

    async def usage(self, user_id: str) -> Usage:
        """The user's current counts, without using an allowance."""
        await self._database.initialize()
        now = self._clock()
        times = await self._times(user_id, now)
        return Usage(
            hour=_window(times, now, HOUR_SECONDS, self.hour_limit),
            day=_window(times, now, DAY_SECONDS, self.day_limit),
        )

    async def claim(self, user_id: str) -> Usage:
        """Take one allowance, or raise ``RateLimitedError`` with advice."""
        await self._database.initialize()
        now = self._clock()

        def count_since(seconds: int):
            return (
                select(func.count())
                .select_from(InvestigationUsage)
                .where(
                    InvestigationUsage.user_id == user_id,
                    InvestigationUsage.started_at > now - seconds,
                )
                .scalar_subquery()
            )

        # One statement: insert only while both windows have room.
        statement = insert(InvestigationUsage).from_select(
            ["user_id", "started_at"],
            select(literal(user_id), literal(now)).where(
                and_(
                    count_since(HOUR_SECONDS) < self.hour_limit,
                    count_since(DAY_SECONDS) < self.day_limit,
                )
            ),
        )
        async with self._database.sessions() as session, session.begin():
            result = await session.execute(statement)
            allowed = result.rowcount == 1
            if allowed:
                await session.execute(
                    delete(InvestigationUsage).where(
                        InvestigationUsage.started_at < now - RETENTION_SECONDS
                    )
                )
        if allowed:
            return await self.usage(user_id)

        times = await self._times(user_id, now)
        hour = _window(times, now, HOUR_SECONDS, self.hour_limit)
        day = _window(times, now, DAY_SECONDS, self.day_limit)
        waits: dict[str, int] = {}
        if hour.used >= self.hour_limit:
            waits["hour"] = _retry_after(times, now, HOUR_SECONDS, self.hour_limit)
        if day.used >= self.day_limit:
            waits["day"] = _retry_after(times, now, DAY_SECONDS, self.day_limit)
        # The request needs every full window to open, so the longer wait rules.
        window = max(waits, key=lambda name: waits[name]) if waits else "hour"
        retry = waits.get(window, 1)
        limit = self.hour_limit if window == "hour" else self.day_limit
        raise RateLimitedError(
            f"investigation limit reached: {limit} per {window}",
            headers={"Retry-After": str(retry)},
            extra={"window": window, "limit": limit, "retry_after_seconds": retry},
        )
