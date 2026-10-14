# Interface & Data Contracts: Tripwire

This document specifies the authoritative API contracts, graph database schemas, and IPC data structures for Tripwire.

---

## 1. REST API Endpoints

### 1.1 System & Health

#### `GET /api/health`
Checks connectivity to core subsystems (API, FalkorDB, Model Provider).
- **Response `200 OK`**:
```json
{
  "status": "healthy",
  "falkordb": "connected",
  "model_provider": "available",
  "version": "1.0.0",
  "timestamp": "2026-10-15T10:00:00Z"
}
```

#### `GET /api/overview`
Retrieves dashboard summary statistics and current pipeline operational state.
- **Response `200 OK`**:
```json
{
  "total_transactions_processed": 14250,
  "candidates_flagged": 382,
  "decisions": {
    "allow": 13868,
    "review": 290,
    "block": 92
  },
  "cases": {
    "suspected": 45,
    "under_review": 12,
    "confirmed": 28,
    "dismissed": 8
  },
  "replay_status": "running",
  "replay_progress": 0.45
}
```

---

### 1.2 Transactions & Replay

#### `GET /api/transactions`
Retrieves paginated transactions from the replay queue.
- **Query Parameters**:
  - `limit` (int, default: 50, max: 200)
  - `offset` (int, default: 0)
  - `risk_band` (string, optional: `low`, `medium`, `high`, `critical`)
  - `decision` (string, optional: `allow`, `review`, `block`)
  - `account_id` (string, optional)
- **Response `200 OK`**:
```json
{
  "items": [
    {
      "transaction_id": "tx_908123",
      "timestamp": "2026-10-15T10:14:22Z",
      "source_account": "acc_0481",
      "destination_account": "acc_8812",
      "amount": 4950.00,
      "currency": "USD",
      "format": "wire",
      "risk_score": 0.87,
      "risk_band": "high",
      "pattern_indicator": "scatter_gather",
      "decision": "review",
      "status": "pending_analyst"
    }
  ],
  "total": 382,
  "offset": 0,
  "limit": 50
}
```

#### `POST /api/replay/start`
Starts or resumes replay of transactions from the dataset.
- **Response `200 OK`**: `{"status": "running"}`

#### `POST /api/replay/pause`
Pauses the current replay stream.
- **Response `200 OK`**: `{"status": "paused"}`

#### `POST /api/replay/reset`
Resets the replay clock and returns the pipeline to its initial deterministic state.
- **Response `200 OK`**: `{"status": "reset", "replay_index": 0}`

#### `GET /api/events` (Server-Sent Events)
Live event channel streaming replay ticks and newly generated alert payloads.
- **Event Types**:
  - `transaction_tick`: Emitted for newly evaluated transactions.
  - `alert_created`: Emitted when an alert enters the review queue.
  - `case_updated`: Emitted when an analyst confirms or dismisses a case.

---

### 1.3 Investigations & Evidence

#### `POST /api/investigations`
Initiates an investigation on a target transaction ID.
- **Request Body**:
```json
{
  "transaction_id": "tx_908123",
  "max_hops": 3
}
```
- **Response `200 OK`**: Full `InvestigationResponse` schema.

#### `GET /api/investigations/{id}`
Retrieves complete graph evidence, feature vector, and decision metadata for an investigation.
- **Response `200 OK`**:
```json
{
  "investigation_id": "inv_4410",
  "transaction_id": "tx_908123",
  "timestamp": "2026-10-15T10:14:25Z",
  "risk_level": 4,
  "ring_detected": true,
  "suspicious_entity_id": "acc_8812",
  "risk_score": 0.87,
  "score_semantics": "uncalibrated_classifier_score",
  "action": "review",
  "graph_features": {
    "fan_in_degree": 14,
    "fan_out_degree": 1,
    "cycle_detected": false,
    "cycle_length": null,
    "path_length": 3,
    "prior_confirmed_case_distance": 2,
    "scatter_gather_score": 0.92
  },
  "evidence_paths": [
    {
      "path_id": "path_01",
      "nodes": [
        {"id": "acc_0481", "type": "Account", "label": "Sender"},
        {"id": "tx_908123", "type": "Transaction", "amount": 4950.00},
        {"id": "acc_8812", "type": "Account", "label": "Hub Account"},
        {"id": "tx_908130", "type": "Transaction", "amount": 4800.00},
        {"id": "acc_9901", "type": "Account", "label": "Exit Node"}
      ],
      "edges": [
        {"source": "acc_0481", "target": "tx_908123", "type": "SENT"},
        {"source": "tx_908123", "target": "acc_8812", "type": "RECEIVED"},
        {"source": "acc_8812", "target": "tx_908130", "type": "SENT"},
        {"source": "tx_908130", "target": "acc_9901", "type": "RECEIVED"}
      ]
    }
  ],
  "model_provider": "lightgbm_v1+jev_adapter",
  "latency_ms": 145,
  "policy_version": "v1.0.0",
  "created_at": "2026-10-15T10:14:26Z"
}
```

---

### 1.4 Cases & Memory

#### `GET /api/cases`
Lists all case records with filter support.
- **Query Parameters**: `status` (`suspected`, `under_review`, `confirmed`, `dismissed`), `limit`, `offset`.

#### `POST /api/cases/{id}/review`
Submits an analyst decision to confirm or dismiss a case.
- **Request Body**:
```json
{
  "action": "confirm",
  "reviewer_id": "analyst_sarah",
  "pattern_type": "fan_out_structuring",
  "notes": "Coordinated transfer burst observed across 8 linked shell accounts."
}
```
- **Response `200 OK`**:
```json
{
  "case_id": "case_102",
  "status": "confirmed",
  "reviewed_at": "2026-10-15T10:25:00Z",
  "reviewer_id": "analyst_sarah",
  "graph_mutation": {
    "ring_created": "ring_992",
    "nodes_tagged": 9
  }
}
```

---

## 2. Graph Database Schema (FalkorDB)

Graph name: `tripwire`

### 2.1 Node Definitions

| Label | Properties | Constraints / Indexes |
| :--- | :--- | :--- |
| `:Account` | `account_id` (string)<br>`institution` (string, optional)<br>`created_at` (int/timestamp) | `CONSTRAINT ON (a:Account) ASSERT a.account_id IS UNIQUE`<br>`INDEX FOR (a:Account) ON (a.account_id)` |
| `:Transaction` | `transaction_id` (string)<br>`amount` (float)<br>`currency` (string)<br>`timestamp` (int/epoch)<br>`format` (string) | `CONSTRAINT ON (t:Transaction) ASSERT t.transaction_id IS UNIQUE`<br>`INDEX FOR (t:Transaction) ON (t.timestamp)` |
| `:Case` | `case_id` (string)<br>`status` (string)<br>`created_at` (int/epoch)<br>`reviewed_at` (int/epoch, nullable)<br>`reviewer_id` (string, nullable)<br>`decision` (string)<br>`provenance` (string) | `CONSTRAINT ON (c:Case) ASSERT c.case_id IS UNIQUE` |
| `:Ring` | `ring_id` (string)<br>`pattern` (string)<br>`confirmation_status` (string)<br>`created_at` (int/epoch)<br>`provenance` (string) | `CONSTRAINT ON (r:Ring) ASSERT r.ring_id IS UNIQUE` |

### 2.2 Relationship Invariants

- `(:Account)-[:SENT]->(:Transaction)`: Exactly 1 incoming account per transaction node.
- `(:Transaction)-[:RECEIVED]->(:Account)`: Exactly 1 outgoing account per transaction node.
- `(:Case)-[:INVOLVES]->(:Account)`: Connects an investigated case to participating accounts.
- `(:Case)-[:SUPPORTED_BY]->(:Transaction)`: Links evidence transactions to the case.
- `(:Ring)-[:HAS_MEMBER]->(:Account)`: Associates an identified pattern with member accounts.
- `(:Case)-[:IDENTIFIES]->(:Ring)`: Records the case that established the confirmed fraud ring.

### 2.3 Core Cypher Query Contracts

#### Bounded Transaction Neighbourhood
```cypher
MATCH (tx:Transaction {transaction_id: $tx_id})
MATCH (src:Account)-[:SENT]->(tx)-[:RECEIVED]->(dst:Account)
OPTIONAL MATCH (src)<-[:RECEIVED]-(in_tx:Transaction)<-[:SENT]-(in_acc:Account)
WHERE in_tx.timestamp >= tx.timestamp - $time_window AND in_tx.timestamp <= tx.timestamp
OPTIONAL MATCH (dst)-[:SENT]->(out_tx:Transaction)-[:RECEIVED]->(out_acc:Account)
WHERE out_tx.timestamp >= tx.timestamp AND out_tx.timestamp <= tx.timestamp + $time_window
RETURN src, tx, dst, collect(DISTINCT in_tx)[..$limit] AS in_transfers, collect(DISTINCT out_tx)[..$limit] AS out_transfers
```

#### Cycle Detection
```cypher
MATCH path = (a:Account)-[:SENT|RECEIVED*2..6]->(a:Account)
WHERE ALL(n IN nodes(path)[1..-1] WHERE n <> a)
RETURN path
LIMIT 10
```

---

## 3. MCP Tool Contracts

### `ring_neighbourhood`
Retrieves bounded graph neighbourhood around an account or transaction.
- **Parameters**: `entity_id` (string), `hops` (int, default: 2, max: 3).
- **Returns**: Formatted node and relationship JSON suitable for agent inspection.

### `shortest_path`
Finds shortest directed path between two accounts or to a confirmed case node.
- **Parameters**: `source_id` (string), `target_id` (string), `max_depth` (int, default: 4).
- **Returns**: Ordered list of entity IDs and relationship types.

### `flag_case`
Creates an auditable case entity linked to flagged transactions.
- **Parameters**: `transaction_ids` (string[]), `reason` (string), `pattern` (string).
- **Returns**: `case_id` and confirmation timestamp.
