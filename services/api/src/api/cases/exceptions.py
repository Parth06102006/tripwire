"""Case domain exceptions."""

from api.exceptions import EntityNotFoundError, TraceAMLError


class CaseNotFoundError(EntityNotFoundError):
    """Raised when a specified case ID does not exist."""

    def __init__(self, case_id: str) -> None:
        super().__init__(f"Case '{case_id}' was not found.")
        self.case_id = case_id


class CaseAlreadyReviewedError(TraceAMLError):
    """Raised when an action is attempted on an already closed/confirmed case."""

    def __init__(self, case_id: str, status: str) -> None:
        super().__init__(
            f"Case '{case_id}' is already {status} and cannot be modified.",
            code="CASE_ALREADY_REVIEWED",
        )
