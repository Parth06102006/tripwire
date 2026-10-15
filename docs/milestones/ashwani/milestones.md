# Ashwani: Graph and Data Engineering Charter

## Role

Own FalkorDB schema, transaction graph materialization, Cypher investigation queries, and graph-derived structural signals.

## Primary paths

- `graph/`
- Graph ingestion/query modules under `services/` or `ml/`, coordinated with Parth and the evaluation lead

## Responsibilities

- Validate source account and transaction identifiers with the data owner when the dataset arrives.
- Use bank-aware composite account keys where IDs are not globally unique.
- Ingest accounts and first-class transaction nodes idempotently.
- Maintain parameterized, bounded queries for `trace_funds`, `inspect_counterparties`, and `detect_flow_patterns`.
- Return transaction IDs, timestamps, amounts/currencies, paths, limits, and query timings from actual FalkorDB results.
- Define graph features with the evaluation lead and document their point-in-time availability.
- Keep target labels and typology ground truth out of the inference graph and query results.

## Interfaces and boundaries

- Implement executable query and ingestion behavior; `docs/contracts.md` records the shared shape.
- Coordinate API integration with Parth and feature/benchmark design with the evaluation lead.
- Do not let client-side or LLM-generated structures substitute for queried topology.
- Keep traversal depth, time range, result size, and execution time bounded.

## Completion evidence

Ingestion is repeatable without duplicate graph entities, and each approved tool returns bounded, source-backed results whose records can be traced to the input data.
