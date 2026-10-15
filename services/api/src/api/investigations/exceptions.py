"""Investigation domain exceptions."""

from api.exceptions import EvidenceValidationError, TraceAMLError


class InvalidInvestigationBoundsError(TraceAMLError):
    """Raised when investigation parameters violate contract boundaries."""

    def __init__(self, message: str) -> None:
        super().__init__(message, code="INVALID_INVESTIGATION_BOUNDS")


__all__ = ["EvidenceValidationError", "InvalidInvestigationBoundsError"]
