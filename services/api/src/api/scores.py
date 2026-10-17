"""Target-free replay score repository.

Reads per-transaction scores from the published inference artifact. The
artifact must carry ``transaction_id``, ``timestamp``, and ``score`` columns
and must not contain any label, typology, or split column; a violating
artifact fails closed so labels can never flow into API responses. A missing
artifact maps to an explicit service error at the route layer, never a raw
exception.

Ranking is deterministic: score descending with ``transaction_id`` ascending
as the tie-break, so paged queue reads are stable. Loading is cached per
artifact path so the 761k-row file is read once per process, not per
request; a changed path naturally loads a fresh repository.
"""

from __future__ import annotations

from bisect import bisect_left, bisect_right
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path

ROUTES: tuple[str, ...] = ("blocked_by_rule", "flagged_for_review", "standard_path")

REQUIRED_COLUMNS: tuple[str, ...] = ("transaction_id", "timestamp", "score")
FORBIDDEN_COLUMNS: tuple[str, ...] = (
    "target_is_laundering",
    "is_laundering",
    "is_illicit",
    "label",
    "typology",
    "pattern",
    "split",
)


class ScoreArtifactUnavailable(Exception):
    """Raised when the score artifact is missing or unreadable."""


class ScoreArtifactInvalid(Exception):
    """Raised when the score artifact violates the target-free schema."""


@dataclass(frozen=True)
class AlertFilter:
    """Which scored transactions the queue shows. Empty fields match everything.

    ``date_from`` and ``date_to`` are inclusive ``YYYY-MM-DD`` days compared with
    the first ten characters of the queued timestamp; ``text`` is a
    lower-case substring of the lower-cased transaction ID.
    """

    routes: frozenset[str] = field(default_factory=frozenset)
    min_score: float | None = None
    max_score: float | None = None
    date_from: str | None = None
    date_to: str | None = None
    text: str | None = None

    @property
    def scans_rows(self) -> bool:
        """Whether answering needs a pass over rows, not just score ranges."""
        return bool(self.date_from or self.date_to or self.text)


@dataclass(frozen=True)
class AlertPage:
    """One page of matches plus the match counts per route.

    ``route_counts`` ignores the route selection but honours every other
    filter, so a route chip can show how many alerts it would add.
    """

    rows: list[tuple[str, float, str]]
    total: int
    route_counts: dict[str, int]


class ScoreRepository:
    """In-memory lookup over the target-free inference score artifact."""

    def __init__(self, entries: dict[str, tuple[float, str]]) -> None:
        self._scores = {key: score for key, (score, _) in entries.items()}
        self._timestamps = {key: timestamp for key, (_, timestamp) in entries.items()}
        self._ranked = sorted(entries.items(), key=lambda kv: (-kv[1][0], kv[0]))
        # Negated scores ascend with rank, so score ranges map to rank ranges.
        self._negated = [-score for _, (score, _) in self._ranked]

    @classmethod
    def load(cls, path: Path) -> ScoreRepository:
        """Load and validate the artifact; fail closed on any violation."""
        import pyarrow.parquet as pq

        if not path.is_file():
            raise ScoreArtifactUnavailable(f"score artifact not found: {path}")
        try:
            schema_names = pq.read_schema(path).names
        except Exception as exc:
            raise ScoreArtifactUnavailable(f"score artifact unreadable: {path}") from exc
        missing = [name for name in REQUIRED_COLUMNS if name not in schema_names]
        if missing:
            raise ScoreArtifactInvalid(f"score artifact missing columns: {missing}")
        leaked = [name for name in FORBIDDEN_COLUMNS if name in schema_names]
        if leaked:
            raise ScoreArtifactInvalid(f"score artifact carries label columns: {leaked}")
        table = pq.read_table(path, columns=list(REQUIRED_COLUMNS))
        columns = table.to_pydict()
        entries = {
            str(transaction_id): (float(score), str(timestamp))
            for transaction_id, timestamp, score in zip(
                columns["transaction_id"], columns["timestamp"], columns["score"]
            )
        }
        return cls(entries)

    def score_for(self, transaction_id: str) -> float | None:
        """Return the score or None when the transaction is not scored."""
        return self._scores.get(transaction_id)

    def timestamp_for(self, transaction_id: str) -> str | None:
        """Return the queued timestamp or None when not scored."""
        return self._timestamps.get(transaction_id)

    def ranked(self, limit: int, offset: int) -> list[tuple[str, float, str]]:
        """Return (transaction_id, score, timestamp) ranked by risk, paged."""
        return [
            (transaction_id, score, self._timestamps[transaction_id])
            for transaction_id, (score, _) in self._ranked[offset : offset + limit]
        ]

    def query(
        self,
        selection: AlertFilter,
        *,
        review_threshold: float,
        block_threshold: float | None,
        limit: int,
        offset: int,
    ) -> AlertPage:
        """Page through the ranked alerts that match a filter.

        Route and score filters are rank ranges found by bisection. Date and
        text filters need one pass over the matching score window.
        """
        count = len(self._negated)
        window_start = (
            0 if selection.max_score is None else bisect_left(self._negated, -selection.max_score)
        )
        window_end = (
            count
            if selection.min_score is None
            else bisect_right(self._negated, -selection.min_score)
        )

        def at_least(threshold: float) -> int:
            return bisect_right(self._negated, -threshold)

        blocked_end = 0 if block_threshold is None else at_least(block_threshold)
        review_end = max(blocked_end, at_least(review_threshold))
        bounds = {
            "blocked_by_rule": (0, blocked_end),
            "flagged_for_review": (blocked_end, review_end),
            "standard_path": (review_end, count),
        }
        segments = {
            route: (max(start, window_start), min(end, window_end))
            for route, (start, end) in bounds.items()
        }
        wanted = selection.routes or frozenset(ROUTES)

        rows: list[tuple[str, float, str]] = []
        counts = dict.fromkeys(ROUTES, 0)
        total = 0
        # Every route is counted; only wanted routes fill the page. Segments are
        # visited in rank order, so the page keeps the queue's ranking.
        for route in ROUTES:
            start, end = segments[route]
            if end <= start:
                continue
            if not selection.scans_rows:
                counts[route] = end - start
                if route in wanted:
                    first = max(start, start + offset - total)
                    last = min(end, start + offset + limit - total)
                    if first < last:
                        rows.extend(self._row(index) for index in range(first, last))
                    total += end - start
                continue
            for index in range(start, end):
                transaction_id, (_, timestamp) = self._ranked[index]
                if not _matches_rows(selection, transaction_id, timestamp):
                    continue
                counts[route] += 1
                if route in wanted:
                    if offset <= total < offset + limit:
                        rows.append(self._row(index))
                    total += 1
        return AlertPage(rows=rows, total=total, route_counts=counts)

    def _row(self, index: int) -> tuple[str, float, str]:
        transaction_id, (score, timestamp) = self._ranked[index]
        return (transaction_id, score, timestamp)

    def __len__(self) -> int:
        return len(self._scores)


def _matches_rows(selection: AlertFilter, transaction_id: str, timestamp: str) -> bool:
    day = timestamp[:10]
    if selection.date_from and day < selection.date_from:
        return False
    if selection.date_to and day > selection.date_to:
        return False
    return not selection.text or selection.text in transaction_id.lower()


@lru_cache(maxsize=8)
def load_scores(path_str: str) -> ScoreRepository:
    """Cached artifact loader keyed by path; isolates file IO for tests."""
    return ScoreRepository.load(Path(path_str))
