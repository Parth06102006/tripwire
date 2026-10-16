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

Two builders produce the same target-free sidecar (`transaction_id` plus
five `gfeat_*` int64 columns) with row-for-row identical values:

- `traceaml-build-graph-features-batch` (default, `make graph-features`):
  vectorized offline build from the Parquet projection. No database needed.
- `traceaml-build-graph-features` (cross-check,
  `make graph-features-falkordb`): streams minute groups through a FalkorDB
  feature graph.

### Vectorized builder (default)

```sh
uv run --project graph traceaml-build-graph-features-batch \
  --parquet data/processed/hi-small-v8/transactions.parquet \
  --features-out data/processed/hi-small-v8/graph-features.parquet \
  --manifest-out data/processed/hi-small-v8/graph-features-manifest.json
```

Same CLI shape as the FalkorDB builder (`--limit`, `--window-seconds`,
`--spill-dir`). DuckDB reads only the four allowlisted columns ordered by
`(timestamp, transaction_id)`. NumPy then deduplicates transfers to
pair-minute events. Event `i` of pair `(a, b)` contributes to query minutes `e`
in `(t_i, min(next_i, t_i + window)]`, so each distinct-counterparty count is
`#{starts < e} - #{ends < e}` over account-major sorted keys (two binary
searches). Prior reverse flow compares the first `b -> a` transfer minute
with `e`. Semantics shared with the FalkorDB builder:

- Group epoch is the timestamp truncated to the minute; naive timestamps are UTC.
- Rows see only transfers in strictly earlier minutes; same-minute peers are
  mutually invisible.
- Recent-eligible: the pair's latest earlier transfer minute is
  `>= group_epoch - window` (inclusive lower bound).
- Reverse flow is all-time prior (not windowed).
- Self-transfers are ordinary pairs: an account counts as its own out- and
  in-counterparty.
- Duplicate rows each get an output row.
- `--limit` drops the final, possibly partial minute.

The batch builder rejects null projected values instead of coercing them.
The manifest records the source sha256, row reconciliation, distinct
minutes/accounts, window, semantics, phase timings, and peak process memory.

Synthetic benchmark on the local machine. The data is random with Zipf-like degrees and is
not HI-Small:

| Input | FalkorDB builder | Batch builder |
| --- | ---: | ---: |
| 200,000-row prefix | 130.1 s | 1.1 s (identical output) |
| 5,078,345 rows, 18 days | not run (Iteration 1 real data: 1,563 s) | 11.3-13.2 s, 1.4 GiB peak |

Reproduce with:

```sh
uv run --project graph traceaml-synth-transactions --out data/interim/synthetic/hi-small-shape.parquet
uv run --project graph traceaml-build-graph-features-batch \
  --parquet data/interim/synthetic/hi-small-shape.parquet \
  --features-out data/interim/synthetic/bench/batch.parquet \
  --manifest-out data/interim/synthetic/bench/batch.json
```

Parity tests: `tests/test_feature_batch.py` compares the batch builder with
a brute-force evaluation of the semantics and with the streaming builder on an
in-memory fake graph. `tests/test_feature_parity.py` compares it with the
real FalkorDB builder on the seeded adversarial synthetic table. That test uses
throwaway `agentfeat-parity-*` graphs and skips when FalkorDB is unreachable.

### FalkorDB builder (cross-check)

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
