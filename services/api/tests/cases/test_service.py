"""Tests for case review service and audit provenance."""

import asyncio

import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from api.cases.exceptions import CaseNotFoundError
from api.cases.service import CaseService
from api.database import Base


def _run_async(coro):
    return asyncio.run(coro)


def test_case_confirmation_provenance() -> None:
    """Verify that case confirmation records reviewer provenance."""

    async def _test():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

        sessionmaker = async_sessionmaker(bind=engine, expire_on_commit=False)
        async with sessionmaker() as session:
            service = CaseService(session)
            await service.repo.seed_initial_cases()

            response = await service.review_case(
                case_id="case_001_8492",
                action="confirm",
                reviewer_id="analyst_parth",
                pattern_type="fan_out_structuring",
                notes="Multiple rapid transfers to shell accounts confirmed.",
            )

            assert response.status == "confirmed"
            assert response.reviewer_id == "analyst_parth"
            assert response.provenance_recorded is True

            # Re-fetch and check audit history
            case = await service.repo.get_by_id("case_001_8492")
            assert case is not None
            assert case.status == "confirmed"
            assert len(case.reviews) == 1
            assert case.reviews[0].reviewer_id == "analyst_parth"

        await engine.dispose()

    _run_async(_test())


def test_case_dismissal_preserves_history() -> None:
    """Verify that dismissing a case preserves history and does not erase data."""

    async def _test():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

        sessionmaker = async_sessionmaker(bind=engine, expire_on_commit=False)
        async with sessionmaker() as session:
            service = CaseService(session)
            await service.repo.seed_initial_cases()

            response = await service.review_case(
                case_id="case_002_4491",
                action="dismiss",
                reviewer_id="analyst_alice",
                notes="Legitimate payroll transfer, false positive.",
            )

            assert response.status == "dismissed"
            assert response.reviewer_id == "analyst_alice"

            # Ensure case still exists in database
            case = await service.repo.get_by_id("case_002_4491")
            assert case is not None
            assert case.status == "dismissed"
            assert len(case.reviews) == 1
            assert case.reviews[0].action == "dismiss"

        await engine.dispose()

    _run_async(_test())


def test_case_not_found() -> None:
    """Verify error when reviewing non-existent case."""

    async def _test():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

        sessionmaker = async_sessionmaker(bind=engine, expire_on_commit=False)
        async with sessionmaker() as session:
            service = CaseService(session)
            with pytest.raises(CaseNotFoundError):
                await service.review_case(
                    case_id="non_existent_case",
                    action="confirm",
                    reviewer_id="analyst_bob",
                )

        await engine.dispose()

    _run_async(_test())
