"""SQLAlchemy ORM models for cases and analyst audit provenance."""

from datetime import UTC, datetime

from sqlalchemy import Float, ForeignKey, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from api.database import Base


def _now_iso() -> str:
    return datetime.now(UTC).isoformat()


class CaseModel(Base):
    """Database model representing an AML investigation case."""

    __tablename__ = "cases"

    case_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    transaction_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="suspected", index=True)
    risk_score: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    created_at: Mapped[str] = mapped_column(String(64), default=_now_iso)
    updated_at: Mapped[str] = mapped_column(String(64), default=_now_iso, onupdate=_now_iso)

    reviews: Mapped[list["CaseReviewModel"]] = relationship(
        "CaseReviewModel",
        back_populates="case",
        cascade="all, delete-orphan",
        order_by="CaseReviewModel.timestamp.desc()",
        lazy="selectin",
    )


class CaseReviewModel(Base):
    """Immutable audit trail of analyst decisions."""

    __tablename__ = "case_reviews"

    review_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    case_id: Mapped[str] = mapped_column(String(64), ForeignKey("cases.case_id"), nullable=False, index=True)
    action: Mapped[str] = mapped_column(String(32), nullable=False)
    reviewer_id: Mapped[str] = mapped_column(String(64), nullable=False)
    pattern_type: Mapped[str | None] = mapped_column(String(64), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    timestamp: Mapped[str] = mapped_column(String(64), default=_now_iso)

    case: Mapped["CaseModel"] = relationship("CaseModel", back_populates="reviews")


Index("ix_cases_status_created", CaseModel.status, CaseModel.created_at)
