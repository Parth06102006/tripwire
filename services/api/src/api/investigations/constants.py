"""Investigation domain constants."""

from typing import Literal

MIN_HOPS = 1
MAX_HOPS = 3
DEFAULT_HOPS = 2

MIN_RESULT_LIMIT = 1
MAX_RESULT_LIMIT = 100
DEFAULT_RESULT_LIMIT = 50

ValidationStatus = Literal["verified", "rejected", "unverified"]
