"""Idempotent FalkorDB loader for normalized TraceAML transactions.

Reads the normalized Parquet table in streaming batches and materializes
first-class transfers::

    (:Account)-[:SENT]->(:Transaction)-[:RECEIVED]->(:Account)

Label isolation: the Parquet projection is an explicit allowlist
(:data:`LOAD_COLUMNS`). ``target_is_laundering``, ``split``, and pattern
metadata are never read, never bound to query parameters, and never written
to the graph. All stdout output is aggregate-only; no source row values are
printed.

Reproducible entry (from the repository root)::

    uv run --project graph traceaml-load-graph \\
        --parquet data/processed/hi-small-v8/transactions.parquet

Context7-verified client usage (falkordb-py):

- ``graph.query(query, params, timeout=ms)`` for parameterized batches with a
  per-batch execution timeout in milliseconds.
- ``graph.create_node_range_index(label, property)`` before
  ``graph.create_node_unique_constraint(label, property)``; indexes are
  created first, constraints second (supported order).
- ``UNWIND $rows`` batch binding is supported Cypher.
"""

from __future__ import annotations

import argparse
import json
import os
import resource
import time
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

GRAPH_NAME_DEFAULT = "traceaml"
HOST_DEFAULT = "localhost"
PORT_DEFAULT = 6379
BATCH_SIZE_DEFAULT = 1000
TIMEOUT_MS_DEFAULT = 30_000
LIMIT_HELP = (
    "Load only the first N rows in file order as a representative prefix "
    "for memory/runtime probing. This is a smoke-test prefix, never an "
    "evaluation sample."
)

# Explicit allowlist projection. Every column not listed here -- in
# particular ``target_is_laundering``, ``split``, and anything derived from
# HI-Small_Patterns.txt -- is never read from Parquet, so it cannot leak
# into parameters, properties, or logs.
LOAD_COLUMNS: tuple[str, ...] = (
    "transaction_id",
    "timestamp",
    "sender_bank",
    "sender_account",
    "receiver_bank",
    "receiver_account",
    "sender_account_key",
    "receiver_account_key",
    "amount_paid",
    "payment_currency",
    "amount_received",
    "receiving_currency",
    "payment_format",
    "source_row_number",
)

# Property allowlist mirrored into Transaction nodes. Must stay free of
# offline-only columns; see OFFLINE_ONLY_GUARD in tests.
TRANSACTION_PROPERTIES: tuple[str, ...] = (
    "timestamp",
    "timestamp_epoch",
    "sender_account_key",
    "receiver_account_key",
    "amount_paid",
    "payment_currency",
    "amount_received",
    "receiving_currency",
    "payment_format",
    "source_row_number",
)

TIMESTAMP_DISPLAY_FORMAT = "%Y-%m-%d %H:%M"

BATCH_CYPHER = """\
UNWIND $rows AS r
MERGE (s:Account {account_key: r.sender_key})
ON CREATE SET s.bank = r.sender_bank, s.account_id = r.sender_account
MERGE (d:Account {account_key: r.receiver_key})
ON CREATE SET d.bank = r.receiver_bank, d.account_id = r.receiver_account
MERGE (t:Transaction {transaction_id: r.transaction_id})
ON CREATE SET
  t.timestamp = r.timestamp,
  t.timestamp_epoch = r.timestamp_epoch,
  t.sender_account_key = r.sender_key,
  t.receiver_account_key = r.receiver_key,
  t.amount_paid = r.amount_paid,
  t.payment_currency = r.payment_currency,
  t.amount_received = r.amount_received,
  t.receiving_currency = r.receiving_currency,
  t.payment_format = r.payment_format,
  t.source_row_number = r.source_row_number
MERGE (s)-[:SENT]->(t)
MERGE (t)-[:RECEIVED]->(d)
"""

COUNT_TRANSACTIONS_CYPHER = "MATCH (t:Transaction) RETURN count(t) AS n"
COUNT_SENT_CYPHER = "MATCH ()-[r:SENT]->() RETURN count(r) AS n"
COUNT_RECEIVED_CYPHER = "MATCH ()-[r:RECEIVED]->() RETURN count(r) AS n"
COUNT_ACCOUNTS_CYPHER = "MATCH (a:Account) RETURN count(a) AS n"


@dataclass
class LoaderStats:
    """Aggregate-only load counters for the final JSON summary."""

    rows_attempted: int = 0
    batches_executed: int = 0
    elapsed_seconds: float = 0.0
    peak_rss_mb: float = 0.0


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    """Build the CLI parser and parse arguments."""
    parser = argparse.ArgumentParser(
        description=(
            "Idempotently load normalized TraceAML transactions into FalkorDB "
            "as (:Account)-[:SENT]->(:Transaction)-[:RECEIVED]->(:Account). "
            "Never reads labels, splits, or typology metadata."
        ),
        epilog=(
            "Reproducible examples (from the repository root):\n"
            "  uv run --project graph traceaml-load-graph "
            "--parquet data/processed/hi-small-v8/transactions.parquet\n"
            "  uv run --project graph traceaml-load-graph "
            "--parquet data/processed/hi-small-v8/transactions.parquet --limit 1000\n"
            "  uv run --project graph traceaml-load-graph "
            "--parquet data/processed/hi-small-v8/transactions.parquet "
            "--limit 5000 --dry-run"
        ),
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("--parquet", type=Path, required=True)
    parser.add_argument("--host", default=os.environ.get("TRACEAML_FALKORDB_HOST", HOST_DEFAULT))
    parser.add_argument(
        "--port", type=int, default=int(os.environ.get("TRACEAML_FALKORDB_PORT", PORT_DEFAULT))
    )
    parser.add_argument(
        "--graph-name",
        default=os.environ.get("TRACEAML_GRAPH_NAME", GRAPH_NAME_DEFAULT),
    )
    parser.add_argument("--batch-size", type=int, default=BATCH_SIZE_DEFAULT)
    parser.add_argument("--limit", type=int, default=None, help=LIMIT_HELP)
    parser.add_argument("--timeout-ms", type=int, default=TIMEOUT_MS_DEFAULT)
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Stream, validate, and count Parquet batches without connecting to FalkorDB.",
    )
    parser.add_argument(
        "--skip-schema",
        action="store_true",
        help="Skip index/constraint creation (batches only).",
    )
    args = parser.parse_args(argv)
    if args.batch_size <= 0:
        parser.error("--batch-size must be positive")
    if args.limit is not None and args.limit <= 0:
        parser.error("--limit must be positive")
    if args.timeout_ms <= 0:
        parser.error("--timeout-ms must be positive")
    return args


def validate_account_key(*, bank: Any, account: Any, key: Any, source_row_number: int) -> None:
    """Validate one ``{bank}::{account}`` composite key.

    Raises with the source row number and field name only; offending values
    are never included so logs stay aggregate-safe.
    """
    if not isinstance(bank, str) or bank == "":
        raise ValueError(f"empty bank component at source row {source_row_number}")
    if not isinstance(account, str) or account == "":
        raise ValueError(f"empty account component at source row {source_row_number}")
    if "::" in bank or "::" in account:
        raise ValueError(f"embedded separator in key component at source row {source_row_number}")
    if not isinstance(key, str) or key != f"{bank}::{account}":
        raise ValueError(f"account key mismatch at source row {source_row_number}")


def validate_transaction_id(value: Any, *, source_row_number: int) -> str:
    """Validate a row-derived transaction ID, returning it typed as str."""
    if not isinstance(value, str) or value == "":
        raise ValueError(f"empty transaction_id at source row {source_row_number}")
    return value


def row_to_params(record: dict[str, Any]) -> dict[str, Any]:
    """Convert one projected Parquet record into Cypher parameters.

    ``record`` holds only :data:`LOAD_COLUMNS` values. Amounts keep their own
    currencies; no conversion or cross-currency comparison happens here.
    Naive source timestamps are interpreted as UTC for ``timestamp_epoch``
    derivation, independent of the host local timezone.
    """
    source_row_number = int(record["source_row_number"])
    transaction_id = validate_transaction_id(record["transaction_id"], source_row_number=source_row_number)
    validate_account_key(
        bank=record["sender_bank"],
        account=record["sender_account"],
        key=record["sender_account_key"],
        source_row_number=source_row_number,
    )
    validate_account_key(
        bank=record["receiver_bank"],
        account=record["receiver_account"],
        key=record["receiver_account_key"],
        source_row_number=source_row_number,
    )
    timestamp = record["timestamp"]
    if isinstance(timestamp, datetime):
        # Source timestamps carry no zone; interpret them as UTC explicitly
        # so epoch derivation never depends on the host local timezone.
        moment = timestamp if timestamp.tzinfo is not None else timestamp.replace(tzinfo=UTC)
    else:  # pragma: no cover - defensive; Parquet schema types timestamp[us]
        raise TypeError(f"non-datetime timestamp at source row {source_row_number}")
    for field in ("amount_paid", "amount_received"):
        amount = record[field]
        if not isinstance(amount, (int, float)):
            raise TypeError(f"non-numeric {field} at source row {source_row_number}")
    for field in ("payment_currency", "receiving_currency", "payment_format"):
        if not isinstance(record[field], str) or record[field] == "":
            raise ValueError(f"empty {field} at source row {source_row_number}")
    return {
        "transaction_id": transaction_id,
        "timestamp": moment.strftime(TIMESTAMP_DISPLAY_FORMAT),
        "timestamp_epoch": int(moment.timestamp()),
        "sender_key": record["sender_account_key"],
        "receiver_key": record["receiver_account_key"],
        "sender_bank": record["sender_bank"],
        "sender_account": record["sender_account"],
        "receiver_bank": record["receiver_bank"],
        "receiver_account": record["receiver_account"],
        "amount_paid": float(record["amount_paid"]),
        "payment_currency": record["payment_currency"],
        "amount_received": float(record["amount_received"]),
        "receiving_currency": record["receiving_currency"],
        "payment_format": record["payment_format"],
        "source_row_number": source_row_number,
    }


def iter_param_batches(
    parquet_path: Path, *, batch_size: int, limit: int | None
) -> Any:
    """Yield validated ``UNWIND $rows`` parameter batches in file order.

    Streams via ``ParquetFile.iter_batches`` with the :data:`LOAD_COLUMNS`
    projection, so memory stays bounded by one batch. ``limit`` truncates to
    a file-order prefix. Yields ``(batch, rows_in_batch)`` tuples.
    """
    import pyarrow.parquet as pq

    parquet_file = pq.ParquetFile(parquet_path)
    remaining = limit
    for record_batch in parquet_file.iter_batches(batch_size=batch_size, columns=list(LOAD_COLUMNS)):
        table = record_batch.to_pylist()
        if remaining is not None:
            table = table[:remaining]
            remaining -= len(table)
        params = [row_to_params(record) for record in table]
        if params:
            yield params
        if remaining is not None and remaining <= 0:
            break


def ensure_schema(graph: Any) -> dict[str, str]:
    """Create range indexes before unique constraints (supported order).

    Uses the client constraint API; plain Neo4j-only ``CONSTRAINT`` Cypher is
    never issued. Returns a status map for the summary. Re-runs are safe:
    already-existing indexes/constraints are reported, not fatal.
    """
    status: dict[str, str] = {}
    steps = [
        ("index:Account(account_key)", graph.create_node_range_index, ("Account", "account_key")),
        (
            "index:Transaction(transaction_id)",
            graph.create_node_range_index,
            ("Transaction", "transaction_id"),
        ),
        (
            "index:Transaction(timestamp)",
            graph.create_node_range_index,
            ("Transaction", "timestamp"),
        ),
        (
            "index:Transaction(timestamp_epoch)",
            graph.create_node_range_index,
            ("Transaction", "timestamp_epoch"),
        ),
        (
            "unique:Account(account_key)",
            graph.create_node_unique_constraint,
            ("Account", "account_key"),
        ),
        (
            "unique:Transaction(transaction_id)",
            graph.create_node_unique_constraint,
            ("Transaction", "transaction_id"),
        ),
    ]
    for name, func, args in steps:
        try:
            func(*args)
            status[name] = "created"
        except Exception as exc:  # noqa: BLE001 - idempotent re-runs must not fail
            message = str(exc).lower()
            if (
                "already exists" in message
                or "already indexed" in message
                or "exists" in message
            ):
                status[name] = "exists"
            else:
                status[name] = f"warning: {type(exc).__name__}"
    return status


def scalar_count(graph: Any, cypher: str, *, timeout_ms: int) -> int:
    """Run a single-row ``count`` query and return the integer result."""
    result = graph.query(cypher, timeout=timeout_ms)
    return int(result.result_set[0][0])


def reconcile_counts(
    graph: Any, *, rows_attempted: int, timeout_ms: int
) -> dict[str, int]:
    """Compare ingested rows against graph-side entity counts.

    Every source row maps to exactly one ``Transaction`` node, one ``SENT``
    edge, and one ``RECEIVED`` edge, so all three counts must equal
    ``rows_attempted`` on a fresh graph. Account counts are reported without
    an equality assertion (accounts are shared across rows).
    """
    counts = {
        "transactions": scalar_count(graph, COUNT_TRANSACTIONS_CYPHER, timeout_ms=timeout_ms),
        "sent_edges": scalar_count(graph, COUNT_SENT_CYPHER, timeout_ms=timeout_ms),
        "received_edges": scalar_count(graph, COUNT_RECEIVED_CYPHER, timeout_ms=timeout_ms),
        "accounts": scalar_count(graph, COUNT_ACCOUNTS_CYPHER, timeout_ms=timeout_ms),
    }
    mismatches = {
        key: counts[key] for key in ("transactions", "sent_edges", "received_edges")
        if counts[key] != rows_attempted
    }
    if mismatches:
        raise ValueError(
            "count reconciliation failed "
            f"(rows_attempted={rows_attempted} counts={counts})"
        )
    return counts


def peak_rss_mb() -> float:
    """Return current peak resident set size in MiB (aggregate-only metric)."""
    return resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 1024.0


def connect(host: str, port: int, graph_name: str) -> Any:
    """Open the FalkorDB graph handle (import deferred for testability)."""
    from falkordb import FalkorDB

    return FalkorDB(host=host, port=port).select_graph(graph_name)


def main(argv: list[str] | None = None) -> int:
    """CLI entry point. Returns a process exit code."""
    args = parse_args(argv)
    if not args.parquet.is_file():
        print(json.dumps({"error": f"parquet file not found: {args.parquet}"}))
        return 2

    started = time.perf_counter()
    stats = LoaderStats()
    schema_status: dict[str, str] = {"mode": "dry-run"} if args.dry_run else {}

    try:
        graph = None
        if not args.dry_run:
            graph = connect(args.host, args.port, args.graph_name)
            if not args.skip_schema:
                schema_status = ensure_schema(graph)
            else:
                schema_status = {"mode": "schema-skipped"}

        for params in iter_param_batches(
            args.parquet, batch_size=args.batch_size, limit=args.limit
        ):
            if graph is not None:
                graph.query(BATCH_CYPHER, params={"rows": params}, timeout=args.timeout_ms)
            stats.rows_attempted += len(params)
            stats.batches_executed += 1

        reconciliation: dict[str, int] = {}
        if graph is not None:
            reconciliation = reconcile_counts(
                graph, rows_attempted=stats.rows_attempted, timeout_ms=args.timeout_ms
            )
    except (ValueError, TypeError) as exc:
        print(json.dumps({"error": str(exc), "rows_attempted": stats.rows_attempted}))
        return 1

    stats.elapsed_seconds = time.perf_counter() - started
    stats.peak_rss_mb = peak_rss_mb()
    print(
        json.dumps(
            {
                "parquet": str(args.parquet),
                "graph": args.graph_name,
                "rows": stats.rows_attempted,
                "batches": stats.batches_executed,
                "elapsed_seconds": round(stats.elapsed_seconds, 3),
                "peak_rss_mb": round(stats.peak_rss_mb, 1),
                "limit": args.limit,
                "dry_run": args.dry_run,
                "schema": schema_status,
                "reconciliation": reconciliation,
            },
            indent=2,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
