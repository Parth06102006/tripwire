"""Alerts domain constants and policy thresholds."""

from typing import Literal

PolicyAction = Literal["allow", "review", "simulated_block"]
RiskLevel = Literal["low", "medium", "high"]

DEFAULT_ALLOW_THRESHOLD = 0.35
DEFAULT_BLOCK_THRESHOLD = 0.80
