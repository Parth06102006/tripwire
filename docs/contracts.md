# TraceAML Contracts

This file records shared API and graph contracts. Pydantic models and executable Cypher are the implementation authority; update this document when either changes.

## API conventions

- Base path: `/api`
- JSON requests and responses use validated Pydantic models.
- Transaction IDs and account keys are source-backed identifiers.
- Target labels and typology truth never appear in inference responses.
- Errors use standard HTTP status codes and a JSON `detail` value. Graph-dependent operations return `503` when FalkorDB is unavailable.

## Implemented endpoints

### `GET /api/health`

Returns service readiness and dependency status.

```json
{
  "status": "ok",
  "falkordb": "available",
  "version": "0.1.0"
}
```

Allowed status values for dependencies are `available`, `unavailable`, and `not_configured`. Health output contains no credentials or dataset labels.

### `GET /api/alerts`

Accepts `limit` from 1-200 and a non-negative `offset`. Returns `total`, `limit`, `offset`, and items containing `transaction_id`, `timestamp`, `score`, and deterministic `decision` (`allow` or `review`). Items sort by score descending, then transaction ID ascending. Decisions use the validation-selected LightGBM threshold. The API reads only the target-free `inference_scores.parquet` artifact.

### `GET /api/benchmarks`

Returns the `logreg` and `lgbm` sections from the offline `baseline_metrics.json` artifact under a `models` key. When `TRACEAML_GRAPH_METRICS_PATH` points to an existing graph-ablation run, its model entries (including `lgbm_graph`) are merged into the response. A missing graph-ablation artifact is allowed while that experiment is pending. It reports measured synthetic benchmark results; it does not expose test labels or individual test outcomes.

### `POST /api/investigations`

Request:

```json
{
  "transaction_id": "source-transaction-id",
  "max_hops": 2,
  "time_window_seconds": 86400,
  "result_limit": 50
}
```

`max_hops` is bounded to 1–3. `result_limit` is bounded to 1–100. The server enforces a query timeout independently of these request values.

Response shape:

```json
{
  "investigation_id": "inv_...",
  "transaction_id": "source-transaction-id",
  "risk_score": 0.0,
  "decision": "review",
  "policy_version": "v1",
  "evidence": {
    "transactions": [],
    "accounts": [],
    "paths": [],
    "query_duration_ms": 0.0
  },
  "report": {
    "hypothesis": "...",
    "supporting_transaction_ids": [],
    "counterevidence_ids": [],
    "recommendation": "review",
    "validation": "validated"
  },
  "created_at": "2026-10-15T00:00:00Z"
}
```

The score is loaded from the target-free replay artifact. Deterministic policy compares it with the validation-selected threshold. The current report is a deterministic summary; it does not call an LLM. Evidence arrays contain only records returned by executed queries. The API calls `trace_funds`, `inspect_counterparties`, and bounded `detect_flow_patterns` variants. Query duration covers all calls. Unknown scored IDs return 404, unavailable graph or score artifacts return 503, and invalid request bounds return 422.

### Investigation record fields

`TransactionEvidence` contains `transaction_id`, `timestamp`, `source_account_key`, `destination_account_key`, sent/received amount and currency when present, and payment type when present. `GraphPath` contains ordered account and transaction references. `InvestigationReport` contains a hypothesis, supporting transaction IDs, counterevidence IDs, a human-review recommendation, and validation status. The report cannot supply risk probabilities or references outside the retrieved evidence set.

## Graph contract

Graph name: `traceaml`.

| Label | Required properties | Notes |
| --- | --- | --- |
| `Account` | `account_key` | Stable key; include bank/institution when necessary to disambiguate IDs |
| `Transaction` | `transaction_id`, `timestamp` | Also store source-supported amount, currency, and payment type properties |

Relationships:

- `(:Account)-[:SENT]->(:Transaction)` identifies the sender.
- `(:Transaction)-[:RECEIVED]->(:Account)` identifies the receiver.
- Each transaction has exactly one sender and one receiver in the normalized graph.

The inference graph excludes laundering labels and typology ground truth. Case memory additions require explicit analyst action and must include provenance.

Create property indexes before applying unique node constraints. FalkorDB unique constraints are created through the supported client constraint API after those indexes exist; do not use unsupported Neo4j-only constraint syntax in Cypher files.

## Planned case review contract (not implemented)

`GET /api/cases` returns cases with status `suspected`, `under_review`, `confirmed`, or `dismissed`, using bounded pagination.

`POST /api/cases/{case_id}/review` accepts an explicit `confirm` or `dismiss` action, reviewer ID, optional pattern type, and analyst notes. A confirmation may write provenance-backed case/ring links. A dismissal preserves the transaction history and audit record and does not erase graph data.

## Approved graph tools

| Tool | Input | Output |
| --- | --- | --- |
| `trace_funds` | Transaction ID, direction, bounded depth, time window, row limit | Ordered transaction/account paths with IDs, timestamps, amount/currency, and query duration |
| `inspect_counterparties` | Account or transaction ID, bounded window and row limit | Related accounts and source-backed repeated transaction records |
| `detect_flow_patterns` | Transaction or account ID, bounded pattern set, time window, row limit | Defined pattern matches with supporting transaction IDs and query duration |

All tool queries are parameterized and bounded. An empty result is not evidence that no suspicious activity exists outside the query scope.

The current query implementation caps traversal at 1-3 hops, time windows at 30 days, result counts at 100, and client query timeouts at 30 seconds. `trace_funds` measures its anchor lookup and traversal together. Account-anchored inspection and pattern queries center their window on the account's latest sent or received transaction. `fan_in` and `fan_out` require a minimum count of distinct counterparties; `pass_through` returns two-hop chains within the configured dwell time. Amounts retain their source currencies.

## Data and model evaluation contract

Every benchmark run records dataset version and input hashes, split boundaries, feature set, model version, threshold, alert budget, test cohort, hardware, concurrency, and metric definitions. All candidate models use the same frozen test cohort. Test labels are accessible only to the offline evaluation process.

Primary metrics are precision, recall, F1, average precision/PR-AUC, and recall at a named alert budget. Latency reports include P50/P95 and warm-up method. Dollar-weighted recall must state how value is counted and must not imply unique recovered funds.

### HI-Small v8 offline table

`data/processed/hi-small-v8/transactions.parquet` is the normalized offline transaction table. The source's two `Account` columns are mapped by position to `sender_account` and `receiver_account`. The canonical account keys are `{bank}::{account}` with both values preserved as strings. `transaction_id` is derived from the source row number and is stable only for the recorded transaction-file SHA-256.

Exact duplicate source rows are retained as distinct transaction records with distinct row-derived IDs. HI-Small v8 contains 9 such rows; the profile records the count. Do not deduplicate the primary benchmark cohort silently.

The table contains `transaction_id`, `timestamp`, sender/receiver bank and account fields, sender/receiver account keys, `amount_paid`, `payment_currency`, `amount_received`, `receiving_currency`, `payment_format`, `target_is_laundering`, `source_row_number`, and `split`. `target_is_laundering` is the only transaction label and is offline-only. `split` is one of `train`, `validation`, or `test` and is fixed by the adjacent `split-manifest.json`.

The generated `features.parquet` contains no target column. Feature generation projects only source transaction inputs, transaction IDs, and frozen split assignments. The offline baseline evaluator joins labels from the normalized transaction table by `(transaction_id, split)`, loads train and validation labels for fitting and threshold selection, then loads test labels only after thresholds are locked. This labeled evaluation path must not be wired into the graph, API, or inference feature path.

The source timestamp has minute resolution. All rows at one timestamp belong to one chronological split. A feature for transaction `t` may use only transactions strictly earlier than `t`; same-minute transactions are excluded from prior-history features. Keep each amount paired with its own currency. The patterns sidecar is not part of this feature table.

### Point-in-time graph feature sidecar

`traceaml-build-graph-features` writes a target-free Parquet sidecar keyed by `transaction_id`. Its exact columns are the transaction ID plus `gfeat_sender_out_24h`, `gfeat_sender_in_24h`, `gfeat_receiver_out_24h`, `gfeat_receiver_in_24h`, and `gfeat_prior_reverse_flow`. The graph builder reads only `transaction_id`, `timestamp`, `sender_account_key`, and `receiver_account_key`; it never reads target, split, or pattern columns. DuckDB sorts those fields by `(timestamp, transaction_id)`, and the builder queries FalkorDB state before applying each complete minute. Recent counterparties use the inclusive 24-hour lower bound and strict earlier-minute upper bound. Reverse flow means a prior directed edge from receiver to sender. The builder uses a separate `FAccount`/`FLOW` graph with an account-key range index and records source hash, row reconciliation, feature definitions, ordering, and timings in a manifest.

The baseline trainer accepts this sidecar only through `--graph-features`. It requires the exact target-free schema, unique non-null IDs, integer features, and a binary reverse-flow flag. The offline evaluator joins by transaction ID and fails if any split loses rows; labels and split assignments continue to come only from the offline evaluation tables. The `lgbm_graph` arm shares the baseline's frozen split, threshold-selection rules, categorical encoding, and alert budget.
