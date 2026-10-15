"""Case domain dependencies."""

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from api.cases.service import CaseService
from api.database import get_db


def get_case_service(session: AsyncSession = Depends(get_db)) -> CaseService:
    """FastAPI dependency for CaseService."""
    return CaseService(session)
