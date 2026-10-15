# TraceAML Delivery Gates

This document tracks Iteration 1 outcomes without retaining the previous dated hackathon plans. The full product scope and acceptance criteria are in [docs/prd.md](../prd.md).

## Current state

The web app, uv-managed API and ML projects, and local FalkorDB service are set up. HI-Small Kaggle version 8 is present locally and ignored by Git. Its aggregate source profile records 5,078,345 transactions, 5,177 positive labels, 9 exact duplicate rows, a 2022-09-01 through 2022-09-18 timestamp range, and per-currency amount ranges. Normalized transaction Parquet and a chronological split manifest are generated. The frozen boundaries are train through 2022-09-07 14:55, validation through 2022-09-09 03:16, then test. Past-only transaction and account-history features plus logistic regression and LightGBM baselines are reproducible: two clean runs produced bitwise-identical score and model artifacts. On the 761,639-row test split (0.205% positive prevalence), LightGBM average precision is 0.1587; at its validation-selected threshold precision is 23.79%, recall is 24.79%, and F1 is 0.2428. At a fixed 0.1% alert budget it detects 248 positives (15.89% recall). These values supersede the earlier 0.1853 run. A daily report shows a low-prevalence early test period followed by a higher-prevalence tail; the data is synthetic and these results are not evidence of real-world AML effectiveness.

FalkorDB ingestion and the three bounded query tools are implemented. A 500,000-row chronological prefix in `traceaml-capacity` reconciles 500,000 transactions and each edge direction; FalkorDB used about 706 MiB and loading took 31.3 seconds. A separate 1,000-row smoke graph was reloaded idempotently and exercised through all three tools. The full graph was not loaded: a simple linear estimate is about 7 GiB, exceeding available memory with safe headroom on this host. Artifacts and graph data remain local.

The FastAPI service now serves the target-free replay alert queue, offline benchmark metrics, and bounded graph investigations. It uses a deterministic threshold policy and evidence verifier. The score artifact contains 761,639 held-out transactions and only transaction ID, timestamp, and score. Endpoint tests cover label exclusion, ranked alerts, validation, evidence grounding, and optional graph-ablation metrics; live API investigation awaits a graph containing the held-out replay cohort. The alert, investigation, and benchmark views are wired to API responses, and Next.js proxies same-origin `/api` requests to the configured API origin.

The point-in-time graph feature builder and optional `lgbm_graph` training arm are implemented. A 50,000-row prefix smoke processed four complete minutes, wrote 43,547 feature rows, and completed in 2.16 seconds with nonzero values in all five features. A full extraction attempt exposed slow two-hop expansion, so that candidate was removed before the full run; the current full feature build is in progress. The feature graph is indexed by account key and remains separate from the transaction-evidence graph.

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
- [ ] Complete the full point-in-time feature extraction and compare LightGBM with and without graph features on the frozen test cohort. (The graph feature pipeline and ablation runner are implemented; full extraction and comparison are in progress.)

### Graph and API

- [x] Ingest a bounded chronological prefix idempotently into first-class `Transaction` nodes and reconcile transaction/edge counts.
- [x] Implement and live-smoke-test bounded `trace_funds`, `inspect_counterparties`, and `detect_flow_patterns`.
- [ ] Load and benchmark the complete 5,078,345-transaction graph on hardware with sufficient memory.
- [ ] Serve validated scoring and investigation contracts through FastAPI.
- [x] Serve a ranked target-free replay queue, benchmark artifacts, deterministic decisions, and verified graph-investigation responses.
- [ ] Load the held-out replay cohort into the demo graph and verify a live API investigation against FalkorDB.
- [ ] Preserve deterministic policy and human-confirmed case-memory provenance.

### Analyst workbench and evidence

- [x] Present alerts, investigation paths, verified report, and benchmark measurements from API response contracts.
- [ ] Confirm graph evidence is API output from actual FalkorDB Cypher.
- [ ] Verify report IDs, paths, amounts, and timestamps against retrieved records.
- [ ] Label synthetic replay clearly and avoid claims of real-world effectiveness.

### Release evidence

- [ ] Document clean setup and data placement without committing data or credentials.
- [ ] Record metric definitions, split, feature set, hardware, concurrency, latency, throughput, and cost methodology.
- [ ] Provide graph schema and queries, reproducible benchmark instructions, and demo materials.

## Ownership

See [team ownership](README.md) and the individual member charters. Shared schema changes are reviewed by the user as integration lead and by the relevant subsystem owner.
