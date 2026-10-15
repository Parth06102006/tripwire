# TraceAML Delivery Gates

This document tracks Iteration 1 outcomes without retaining the previous dated hackathon plans. The full product scope and acceptance criteria are in [docs/prd.md](../prd.md).

## Current state

The repository began as project documentation with no application or dependency scaffold. The web app, uv-managed API and ML projects, and local FalkorDB service are now set up. No dataset files or benchmark results are present yet.

## Shared delivery gates

### Repository foundation

- [x] Next.js analyst workbench scaffold is installable with pnpm.
- [x] FastAPI and ML Python packages are reproducible with uv.
- [x] Docker Compose starts local FalkorDB.
- [x] Contracts, schema, environment examples, and ignore rules agree.

### Data and evaluation

- [ ] Verify the exact user-provided HI-Small version, license, schema, and source hashes.
- [ ] Resolve account IDs using bank/institution context where required.
- [ ] Produce chronological split manifest and past-only features.
- [ ] Evaluate logistic regression, LightGBM, and LightGBM plus graph features on the same frozen cohort.

### Graph and API

- [ ] Ingest data idempotently into first-class `Transaction` nodes.
- [ ] Implement bounded `trace_funds`, `inspect_counterparties`, and `detect_flow_patterns`.
- [ ] Serve validated scoring and investigation contracts through FastAPI.
- [ ] Preserve deterministic policy and human-confirmed case-memory provenance.

### Analyst workbench and evidence

- [ ] Present alerts, investigation paths, verified report, and benchmark measurements.
- [ ] Confirm graph evidence is API output from actual FalkorDB Cypher.
- [ ] Verify report IDs, paths, amounts, and timestamps against retrieved records.
- [ ] Label synthetic replay clearly and avoid claims of real-world effectiveness.

### Release evidence

- [ ] Document clean setup and data placement without committing data or credentials.
- [ ] Record metric definitions, split, feature set, hardware, concurrency, latency, throughput, and cost methodology.
- [ ] Provide graph schema and queries, reproducible benchmark instructions, and demo materials.

## Ownership

See [team ownership](README.md) and the individual member charters. Shared schema changes are reviewed by the user as integration lead and by the relevant subsystem owner.
