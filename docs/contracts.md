# TraceAML Contracts

This file records shared API and graph contracts. Pydantic models and executable Cypher are the implementation authority; update this document when either changes.

## API conventions

- Base path: `/api`
- JSON requests and responses use validated Pydantic models.
- Transaction IDs and account keys are source-backed identifiers.
- Target labels and typology truth never appear in inference responses.
- Errors use standard HTTP status codes and a JSON `detail` value. Graph-dependent operations return `503` when FalkorDB is unavailable.

## Initial endpoints

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
  "evidence": {
    "transactions": [],
    "accounts": [],
    "paths": [],
    "query_duration_ms": 0.0
  },
  "report": null,
  "created_at": "2026-10-15T00:00:00Z"
}
```

Evidence arrays contain only records returned by executed queries. A report is absent until the optional investigator runs and its claims pass validation.

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

## Case review contract

`GET /api/cases` returns cases with status `suspected`, `under_review`, `confirmed`, or `dismissed`, using bounded pagination.

`POST /api/cases/{case_id}/review` accepts an explicit `confirm` or `dismiss` action, reviewer ID, optional pattern type, and analyst notes. A confirmation may write provenance-backed case/ring links. A dismissal preserves the transaction history and audit record and does not erase graph data.

## Approved graph tools

| Tool | Input | Output |
| --- | --- | --- |
| `trace_funds` | Transaction ID, direction, bounded depth, time window, row limit | Ordered transaction/account paths with IDs, timestamps, amount/currency, and query duration |
| `inspect_counterparties` | Account or transaction ID, bounded window and row limit | Related accounts and source-backed repeated transaction records |
| `detect_flow_patterns` | Transaction or account ID, bounded pattern set, time window, row limit | Defined pattern matches with supporting transaction IDs and query duration |

All tool queries are parameterized and bounded. An empty result is not evidence that no suspicious activity exists outside the query scope.

## Data and model evaluation contract

Every benchmark run records dataset version and input hashes, split boundaries, feature set, model version, threshold, alert budget, test cohort, hardware, concurrency, and metric definitions. All candidate models use the same frozen test cohort. Test labels are accessible only to the offline evaluation process.

Primary metrics are precision, recall, F1, average precision/PR-AUC, and recall at a named alert budget. Latency reports include P50/P95 and warm-up method. Dollar-weighted recall must state how value is counted and must not imply unique recovered funds.
