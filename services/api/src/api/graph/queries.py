"""Parameterized Cypher query builders for approved bounded graph tools.

No typology labels or target ground truth appear in queries or results.
"""

# Query for tracing funds forward and backward around a transaction
QUERY_TRACE_FUNDS = """
MATCH (src:Account)-[:SENT]->(t:Transaction {transaction_id: $transaction_id})-[:RECEIVED]->(dst:Account)
OPTIONAL MATCH (dst)-[:SENT]->(next_t:Transaction)-[:RECEIVED]->(next_dst:Account)
WHERE $time_window_seconds IS NULL OR (next_t.timestamp >= t.timestamp AND next_t.timestamp <= t.timestamp + $time_window_seconds)
WITH t, src, dst, next_t, next_dst
RETURN 
    t.transaction_id AS tx_id,
    t.timestamp AS tx_timestamp,
    src.account_key AS src_key,
    dst.account_key AS dst_key,
    t.amount AS amount,
    t.currency AS currency,
    t.payment_type AS payment_type,
    next_t.transaction_id AS next_tx_id,
    next_t.timestamp AS next_timestamp,
    next_dst.account_key AS next_dst_key,
    next_t.amount AS next_amount,
    next_t.currency AS next_currency,
    next_t.payment_type AS next_payment_type
LIMIT $limit
"""

# Query for inspecting counterparties connected to an account or transaction
QUERY_INSPECT_COUNTERPARTIES = """
MATCH (a:Account)-[:SENT]->(t:Transaction)-[:RECEIVED]->(b:Account)
WHERE t.transaction_id = $entity_id OR a.account_key = $entity_id OR b.account_key = $entity_id
RETURN 
    t.transaction_id AS tx_id,
    t.timestamp AS tx_timestamp,
    a.account_key AS src_key,
    b.account_key AS dst_key,
    t.amount AS amount,
    t.currency AS currency,
    t.payment_type AS payment_type
ORDER BY t.timestamp DESC
LIMIT $limit
"""

# Query for detecting flow patterns (e.g. cycles, rapid pass-through)
QUERY_DETECT_FLOW_PATTERNS = """
MATCH path = (a:Account)-[:SENT]->(t1:Transaction)-[:RECEIVED]->(b:Account)-[:SENT]->(t2:Transaction)-[:RECEIVED]->(c:Account)
WHERE (t1.transaction_id = $entity_id OR a.account_key = $entity_id)
  AND ($time_window_seconds IS NULL OR (t2.timestamp >= t1.timestamp AND t2.timestamp <= t1.timestamp + $time_window_seconds))
RETURN 
    t1.transaction_id AS t1_id,
    t1.timestamp AS t1_timestamp,
    a.account_key AS a_key,
    b.account_key AS b_key,
    t1.amount AS t1_amount,
    t1.currency AS t1_currency,
    t1.payment_type AS t1_payment_type,
    t2.transaction_id AS t2_id,
    t2.timestamp AS t2_timestamp,
    c.account_key AS c_key,
    t2.amount AS t2_amount,
    t2.currency AS t2_currency,
    t2.payment_type AS t2_payment_type
LIMIT $limit
"""
