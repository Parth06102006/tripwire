// TraceAML bounded investigation queries (declarative reference).
//
// The executable authority is graph/src/graph/queries.py, which selects
// among these fixed variants using validated integers and binds every value
// as a parameter. This file mirrors those statements for review.
//
// Bounds applied to every tool query:
//   hop depth ......... 1-3 (fixed MATCH variants UNIONed; no dynamic bounds)
//   time window ....... $time_window_seconds, integer within 1-2592000 (30d)
//   row limit ......... LIMIT $result_limit, integer within 1-100
//   execution timeout . client-side timeout= milliseconds (default 5000,
//                       max 30000) passed to graph.query; not a Cypher clause.
//
// Property allowlist (inference-safe only): transaction_id, timestamp,
// timestamp_epoch, sender_account_key, receiver_account_key, account_key,
// bank, account_id, amount_paid, payment_currency, amount_received,
// receiving_currency, payment_format, source_row_number.
// Forbidden here by design: target_is_laundering, split, pattern metadata,
// typology ground truth.
//
// Timestamps: Transaction.timestamp is a "%Y-%m-%d %H:%M" display string;
// Transaction.timestamp_epoch (integer seconds) carries every range filter.

// -- trace_funds: anchor lookup (also resolves the anchor evidence record) --
// Params: $transaction_id
MATCH (anchor:Transaction {transaction_id: $transaction_id})
MATCH (sender:Account)-[:SENT]->(anchor)-[:RECEIVED]->(receiver:Account)
RETURN anchor.transaction_id AS transaction_id, anchor.timestamp AS timestamp,
  sender.account_key AS sender_key, receiver.account_key AS receiver_key,
  anchor.amount_paid AS amount_paid, anchor.payment_currency AS payment_currency,
  anchor.amount_received AS amount_received,
  anchor.receiving_currency AS receiving_currency,
  anchor.payment_format AS payment_format
LIMIT 1;

// -- trace_funds outgoing, depth 1 (depths 2-3 extend the segment chain;
//    the executed query UNIONs depths 1..$max_hops with NULL-filled columns) --
// Params: $transaction_id, $time_window_seconds, $result_limit
MATCH (anchor:Transaction {transaction_id: $transaction_id})
MATCH (anchor)-[:RECEIVED]->(a0:Account)-[:SENT]->(t1:Transaction)-[:RECEIVED]->(a1:Account)
WHERE t1.timestamp_epoch >= anchor.timestamp_epoch - $time_window_seconds
  AND t1.timestamp_epoch <= anchor.timestamp_epoch + $time_window_seconds
RETURN anchor.transaction_id AS anchor_id, 1 AS depth,
  t1.transaction_id AS transaction_id_1, t1.timestamp AS timestamp_1,
  t1.amount_paid AS amount_paid_1, t1.payment_currency AS payment_currency_1,
  t1.amount_received AS amount_received_1, t1.receiving_currency AS receiving_currency_1,
  NULL AS transaction_id_2, NULL AS timestamp_2, NULL AS amount_paid_2,
  NULL AS payment_currency_2, NULL AS amount_received_2, NULL AS receiving_currency_2,
  NULL AS transaction_id_3, NULL AS timestamp_3, NULL AS amount_paid_3,
  NULL AS payment_currency_3, NULL AS amount_received_3, NULL AS receiving_currency_3,
  a0.account_key AS account_key_0, a1.account_key AS account_key_1,
  NULL AS account_key_2, NULL AS account_key_3
LIMIT $result_limit;

// -- trace_funds incoming, depth 1 (depths 2-3 mirror the outgoing chain) --
// Params: $transaction_id, $time_window_seconds, $result_limit
MATCH (anchor:Transaction {transaction_id: $transaction_id})
MATCH (anchor)<-[:SENT]-(a0:Account)<-[:RECEIVED]-(t1:Transaction)<-[:SENT]-(a1:Account)
WHERE t1.timestamp_epoch >= anchor.timestamp_epoch - $time_window_seconds
  AND t1.timestamp_epoch <= anchor.timestamp_epoch + $time_window_seconds
RETURN anchor.transaction_id AS anchor_id, 1 AS depth,
  t1.transaction_id AS transaction_id_1, t1.timestamp AS timestamp_1,
  t1.amount_paid AS amount_paid_1, t1.payment_currency AS payment_currency_1,
  t1.amount_received AS amount_received_1, t1.receiving_currency AS receiving_currency_1,
  NULL AS transaction_id_2, NULL AS timestamp_2, NULL AS amount_paid_2,
  NULL AS payment_currency_2, NULL AS amount_received_2, NULL AS receiving_currency_2,
  NULL AS transaction_id_3, NULL AS timestamp_3, NULL AS amount_paid_3,
  NULL AS payment_currency_3, NULL AS amount_received_3, NULL AS receiving_currency_3,
  a0.account_key AS account_key_0, a1.account_key AS account_key_1,
  NULL AS account_key_2, NULL AS account_key_3
LIMIT $result_limit;

// -- inspect_counterparties anchored at a transaction: sibling transfers --
// Params: $transaction_id, $time_window_seconds, $result_limit
MATCH (anchor:Transaction {transaction_id: $transaction_id})
MATCH (sender:Account)-[:SENT]->(anchor)-[:RECEIVED]->(receiver:Account)
MATCH (sender)-[:SENT]->(t:Transaction)-[:RECEIVED]->(other:Account)
WHERE t.transaction_id <> anchor.transaction_id
  AND t.timestamp_epoch >= anchor.timestamp_epoch - $time_window_seconds
  AND t.timestamp_epoch <= anchor.timestamp_epoch + $time_window_seconds
RETURN t.transaction_id AS transaction_id, t.timestamp AS timestamp,
  sender.account_key AS sender_key, other.account_key AS receiver_key,
  t.amount_paid AS amount_paid, t.payment_currency AS payment_currency,
  t.amount_received AS amount_received, t.receiving_currency AS receiving_currency,
  t.payment_format AS payment_format
ORDER BY t.timestamp_epoch
LIMIT $result_limit;

// -- inspect_counterparties / detect_flow_patterns anchor clock --
// Latest activity across both SENT and RECEIVED legs, so receiver-only
// accounts stay investigable. ORDER BY applies to the combined UNION
// result (documented FalkorDB UNION semantics).
// Params: $account_key
MATCH (a:Account {account_key: $account_key})-[:SENT]->(t:Transaction)
RETURN t.timestamp_epoch AS epoch
UNION
MATCH (a:Account {account_key: $account_key})<-[:RECEIVED]-(t:Transaction)
RETURN t.timestamp_epoch AS epoch
ORDER BY epoch DESC
LIMIT 1;

// -- inspect_counterparties anchored at an account, step 2: sent leg --
// Params: $account_key, $min_epoch, $max_epoch, $result_limit
MATCH (a:Account {account_key: $account_key})-[:SENT]->(t:Transaction)-[:RECEIVED]->(other:Account)
WHERE t.timestamp_epoch >= $min_epoch AND t.timestamp_epoch <= $max_epoch
RETURN t.transaction_id AS transaction_id, t.timestamp AS timestamp,
  a.account_key AS sender_key, other.account_key AS receiver_key,
  t.amount_paid AS amount_paid, t.payment_currency AS payment_currency,
  t.amount_received AS amount_received, t.receiving_currency AS receiving_currency,
  t.payment_format AS payment_format, 'sent' AS involvement
ORDER BY t.timestamp_epoch DESC
LIMIT $result_limit;

// -- inspect_counterparties anchored at an account, step 2: received leg --
// Params: $account_key, $min_epoch, $max_epoch, $result_limit
MATCH (a:Account {account_key: $account_key})<-[:RECEIVED]-(t:Transaction)<-[:SENT]-(other:Account)
WHERE t.timestamp_epoch >= $min_epoch AND t.timestamp_epoch <= $max_epoch
RETURN t.transaction_id AS transaction_id, t.timestamp AS timestamp,
  other.account_key AS sender_key, a.account_key AS receiver_key,
  t.amount_paid AS amount_paid, t.payment_currency AS payment_currency,
  t.amount_received AS amount_received, t.receiving_currency AS receiving_currency,
  t.payment_format AS payment_format, 'received' AS involvement
ORDER BY t.timestamp_epoch DESC
LIMIT $result_limit;

// -- detect_flow_patterns fan_out, step 1: distinct-counterparty gate --
// Groups the anchor's windowed transfers by distinct counterparty account.
// The detail query below runs only when the gate meets $min_fanout (2-10,
// validated client-side and therefore not a query parameter).
// Params: $account_key, $min_epoch, $max_epoch
MATCH (a:Account {account_key: $account_key})-[:SENT]->(t:Transaction)-[:RECEIVED]->(other:Account)
WHERE t.timestamp_epoch >= $min_epoch AND t.timestamp_epoch <= $max_epoch
RETURN count(DISTINCT other) AS distinct_counterparties, count(t) AS transfers;

// -- detect_flow_patterns fan_out, step 2: supporting transfers --
// Params: $account_key, $min_epoch, $max_epoch, $result_limit
MATCH (a:Account {account_key: $account_key})-[:SENT]->(t:Transaction)-[:RECEIVED]->(other:Account)
WHERE t.timestamp_epoch >= $min_epoch AND t.timestamp_epoch <= $max_epoch
RETURN other.account_key AS counterparty_key,
  t.transaction_id AS transaction_id, t.timestamp AS timestamp,
  t.amount_paid AS amount_paid, t.payment_currency AS payment_currency,
  t.amount_received AS amount_received, t.receiving_currency AS receiving_currency
ORDER BY t.timestamp_epoch
LIMIT $result_limit;

// -- detect_flow_patterns fan_in: gate then detail (legs mirrored) --
// Params: $account_key, $min_epoch, $max_epoch
MATCH (other:Account)-[:SENT]->(t:Transaction)-[:RECEIVED]->(a:Account {account_key: $account_key})
WHERE t.timestamp_epoch >= $min_epoch AND t.timestamp_epoch <= $max_epoch
RETURN count(DISTINCT other) AS distinct_counterparties, count(t) AS transfers;

// Params: $account_key, $min_epoch, $max_epoch, $result_limit
MATCH (other:Account)-[:SENT]->(t:Transaction)-[:RECEIVED]->(a:Account {account_key: $account_key})
WHERE t.timestamp_epoch >= $min_epoch AND t.timestamp_epoch <= $max_epoch
RETURN other.account_key AS counterparty_key,
  t.transaction_id AS transaction_id, t.timestamp AS timestamp,
  t.amount_paid AS amount_paid, t.payment_currency AS payment_currency,
  t.amount_received AS amount_received, t.receiving_currency AS receiving_currency
ORDER BY t.timestamp_epoch
LIMIT $result_limit;

// -- detect_flow_patterns pass_through: two-hop chain via the anchor --
// Params: $account_key, $min_epoch, $max_epoch, $dwell_seconds, $result_limit
MATCH (a1:Account)-[:SENT]->(t1:Transaction)-[:RECEIVED]->(b:Account {account_key: $account_key})
MATCH (b)-[:SENT]->(t2:Transaction)-[:RECEIVED]->(a2:Account)
WHERE t1.timestamp_epoch >= $min_epoch AND t2.timestamp_epoch <= $max_epoch
  AND t2.timestamp_epoch >= t1.timestamp_epoch
  AND t2.timestamp_epoch <= t1.timestamp_epoch + $dwell_seconds
RETURN a1.account_key AS entry_key, b.account_key AS middle_key, a2.account_key AS exit_key,
  t1.transaction_id AS transaction_id_1, t1.timestamp AS timestamp_1,
  t1.amount_paid AS amount_paid_1, t1.payment_currency AS payment_currency_1,
  t1.amount_received AS amount_received_1, t1.receiving_currency AS receiving_currency_1,
  t2.transaction_id AS transaction_id_2, t2.timestamp AS timestamp_2,
  t2.amount_paid AS amount_paid_2, t2.payment_currency AS payment_currency_2,
  t2.amount_received AS amount_received_2, t2.receiving_currency AS receiving_currency_2
ORDER BY t1.timestamp_epoch, t2.timestamp_epoch
LIMIT $result_limit;
