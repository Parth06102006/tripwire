"""Case domain constants and types."""

from typing import Literal

CaseStatus = Literal["suspected", "under_review", "confirmed", "dismissed"]
ReviewAction = Literal["confirm", "dismiss"]
