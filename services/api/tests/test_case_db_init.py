"""Case store initialization under concurrent first requests.

A fresh deployment's first page load issues several case requests at once;
each one initializes the store. They must all succeed.
"""

from __future__ import annotations

import asyncio
from pathlib import Path

from sqlalchemy import text

from api.database import CaseDatabase


def test_concurrent_first_initialization_succeeds(tmp_path: Path) -> None:
    async def scenario() -> list[int]:
        database = CaseDatabase(tmp_path / "cases" / "cases.db")
        try:
            await asyncio.gather(*(database.initialize() for _ in range(8)))
            async with database.sessions() as session:
                count = await session.execute(text("SELECT count(*) FROM cases"))
                return [int(count.scalar_one())]
        finally:
            await database.close()

    for _ in range(5):
        assert asyncio.run(scenario()) == [0]
        for path in tmp_path.rglob("cases.db*"):
            path.unlink()
