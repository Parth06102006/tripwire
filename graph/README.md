# TraceAML Graph (`graph`)

uv-managed FalkorDB graph layer. Python >= 3.12. All commands run from the
repository root with `uv run --project graph`. It covers idempotent
transaction-graph ingestion and the bounded investigation queries
(`trace_funds`, `inspect_counterparties`, `detect_flow_patterns`).

This package never reads `target_is_laundering`, `split`, or pattern metadata.
Its Parquet projection is an explicit allowlist, and all command output is
aggregate-only (counts, timings, IDs never printed as row samples).

## Setup

```sh
uv sync --project graph
```

## Loader

Batch-loads first-class transfers:

```text
(:Account)-[:SENT]->(:Transaction)-[:RECEIVED]->(:Account)
```

```sh
uv run --project graph traceaml-load-graph --parquet data/processed/hi-small-v8/transactions.parquet
```

Representative smoke load (file-order prefix, for memory/runtime probing only,
never an evaluation sample):

```sh
uv run --project graph traceaml-load-graph --parquet data/processed/hi-small-v8/transactions.parquet --limit 1000
```

Validate without a database:

```sh
uv run --project graph traceaml-load-graph --parquet data/processed/hi-small-v8/transactions.parquet --limit 5000 --dry-run
```

Loader guarantees:

- Row-derived transaction IDs (`hi8-tx-{source_row_number:08d}`) are preserved,
  so the 9 exact duplicate source rows become 9 distinct `Transaction` nodes.
- Account keys are validated as `{bank}::{account}` with both components kept
  as strings (leading zeroes preserved); rows with empty components, embedded
  separators, or key mismatches abort the load with the offending
  `source_row_number` only.
- Batches are parameterized (`UNWIND $rows`) idempotent `MERGE` statements;
  re-running the loader creates no duplicate nodes or relationships.
- Range indexes are created before unique constraints, through the supported
  client API (`create_node_range_index`, then `create_node_unique_constraint`).
- Count reconciliation compares ingested rows against graph-side
  `Transaction`/`SENT`/`RECEIVED` counts and fails on mismatch.
- The summary reports rows, batches, elapsed time, peak memory, and
  reconciliation counts as JSON.

FalkorDB must already be running (`docker compose up -d falkordb` from the
repository root). Connection defaults: host `localhost`, port `6379`, graph
`traceaml`, overridable with `--host`, `--port`, `--graph-name` or the
`TRACEAML_FALKORDB_HOST` / `TRACEAML_FALKORDB_PORT` environment variables.

## Bounded investigation queries

`src/graph/queries.py` builds the three approved tools; `queries.cypher`
holds the same parameterized statements as a declarative reference. Every
query declares explicit bounds: hop depth 1-3, time window capped at 30 days,
row limit 1-100, and a client-side execution timeout (default 5 s, max 30 s)
passed as `timeout=` milliseconds to `graph.query`. Results carry source
transaction IDs, timestamps, amounts with their own currencies, account keys,
paths, and `query_duration_ms`.

## Tests (no database required)

```sh
uv run --project graph --group dev pytest
uv run --project graph --group dev ruff check graph
```

Tests use an in-memory fake graph client at the `graph.query` seam, so they
never need Docker or the dataset.

## Point-in-time graph features

`traceaml-build-graph-features` streams the normalized Parquet through a
DuckDB out-of-core sort over exactly four columns
(`transaction_id`, `timestamp`, `sender_account_key`,
`receiver_account_key`) into a temporary ignored sorted Parquet, then
processes complete same-minute groups against a separate aggregate feature
graph (`traceaml-features`; `FAccount` nodes, one directed `FLOW` edge per
distinct account pair with `last_epoch`). Features for a minute are queried
from prior graph state first; the minute applies only afterwards, so
same-minute peers never observe one another. The main
transaction-evidence graph is never touched, and labels/splits/patterns are
never selected.

```sh
uv run --project graph traceaml-build-graph-features \
  --parquet data/processed/hi-small-v8/transactions.parquet \
  --features-out data/processed/hi-small-v8/graph-features.parquet \
  --manifest-out data/processed/hi-small-v8/graph-features-manifest.json
```

Smoke (plumbing only; prefix-relative features, never evaluation data):

```sh
uv run --project graph traceaml-build-graph-features \
  --parquet data/processed/hi-small-v8/transactions.parquet \
  --features-out data/interim/traceaml-graph-features/smoke/features.parquet \
  --manifest-out data/interim/traceaml-graph-features/smoke/manifest.json \
  --feature-graph traceaml-features-smoke --limit 50000
```

Aggregate-only preflight without sorting, database, or output:

```sh
uv run --project graph traceaml-build-graph-features \
  --parquet data/processed/hi-small-v8/transactions.parquet \
  --features-out data/interim/traceaml-graph-features/preflight/features.parquet \
  --manifest-out data/interim/traceaml-graph-features/preflight/manifest.json \
  --dry-run
```

Candidate features (`gfeat_` prefix): recent 24-hour distinct
out/in counterparties for sender and receiver, and a prior reverse-flow indicator. A `FLOW` edge
is recent-eligible iff `group_epoch - window <= last_epoch < group_epoch`.
The manifest records the source hash, row counts, window, feature
definitions, UTC assumption, and proof that target/split were not read.
FalkorDB must already be running; an existing feature graph is deleted and
recreated at the start of every build so reruns reproduce identical output.
The `FAccount.account_key` range index is created before lookups to avoid
label scans.
