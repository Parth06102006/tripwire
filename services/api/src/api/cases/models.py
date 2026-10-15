"""SQLAlchemy ORM models for cases and their append-only review history."""

from datetime import UTC, datetime

from sqlalchemy import Float, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from api.database import Base


def now_iso() -> str:
    """Current UTC time as an ISO-8601 string."""
    return datetime.now(UTC).isoformat()


class CaseModel(Base):
    """An AML investigation case opened from one scored transaction."""

    __tablename__ = "cases"

    case_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    transaction_id: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="suspected")
    risk_score: Mapped[float] = mapped_column(Float, nullable=False)
    opened_by: Mapped[str] = mapped_column(String(64), nullable=False)
    created_at: Mapped[str] = mapped_column(String(64), nullable=False, default=now_iso)
    updated_at: Mapped[str] = mapped_column(String(64), nullable=False, default=now_iso)

    reviews: Mapped[list["CaseReviewModel"]] = relationship(
        "CaseReviewModel",
        back_populates="case",
        order_by="CaseReviewModel.sequence",
        lazy="selectin",
    )


class CaseReviewModel(Base):
    """Immutable audit entry: case opening or an analyst decision.

    Rows are only ever inserted; database triggers reject updates and
    deletes (see ``api.database``).
    """

    __tablename__ = "case_reviews"

    sequence: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    review_id: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    case_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("cases.case_id"), nullable=False, index=True
    )
    action: Mapped[str] = mapped_column(String(32), nullable=False)
    reviewer_id: Mapped[str] = mapped_column(String(64), nullable=False)
    pattern_type: Mapped[str | None] = mapped_column(String(64), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    timestamp: Mapped[str] = mapped_column(String(64), nullable=False, default=now_iso)

    case: Mapped[CaseModel] = relationship("CaseModel", back_populates="reviews")


Index("ix_cases_status_updated", CaseModel.status, CaseModel.updated_at)
