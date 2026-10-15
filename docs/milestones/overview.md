# TraceAML Delivery Gates

This document tracks Iteration 1 outcomes without retaining the previous dated hackathon plans. The full product scope and acceptance criteria are in [docs/prd.md](../prd.md).

## Current state

The web app, uv-managed API and ML projects, and local FalkorDB service are set up. HI-Small Kaggle version 8 is present locally and ignored by Git. Its aggregate source profile records 5,078,345 transactions, 5,177 positive labels, 9 exact duplicate rows, a 2022-09-01 through 2022-09-18 timestamp range, and per-currency amount ranges. Normalized transaction Parquet and a chronological split manifest are generated. The frozen boundaries are train through 2022-09-07 14:55, validation through 2022-09-09 03:16, then test. Past-only transaction and account-history features plus logistic regression and LightGBM baselines are generated. On the 761,639-row test split (0.205% positive prevalence), the latest LightGBM run has average precision 0.1853; at its validation-selected threshold it reaches 28.32% precision and 23.06% recall, and at a fixed 0.1% alert budget it reaches 17.36% recall. Results and config are in the ignored run directory `artifacts/runs/hi-small-v8/baselines/`. A rerun after isolating labels changed the LightGBM result from the earlier run; the source of that variation is not isolated, so results need a repeatability check. Test prevalence is higher than train and validation; results are synthetic benchmark evidence only.

## Shared delivery gates

### Repository foundation

- [x] Next.js analyst workbench scaffold is installable with pnpm.
- [x] FastAPI and ML Python packages are reproducible with uv.
- [x] Docker Compose starts local FalkorDB.
- [x] Contracts, schema, environment examples, and ignore rules agree.

### Data and evaluation

- [x] Verify HI-Small version 8, license, schema, and source hashes in the local profile and split manifest.
- [x] Resolve account IDs using bank plus account strings; preserve leading zeroes and the duplicate source account columns by position.
- [x] Generate past-only behavioral features and validate row/split/hash reconciliation over the frozen chronological split.
- [ ] Evaluate logistic regression and LightGBM plus LightGBM with graph features on the same frozen cohort. (Transaction-only logistic regression and LightGBM are complete; graph features await the graph team's point-in-time feature contract.)

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
