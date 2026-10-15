# TraceAML Architecture Decisions

These decisions lock the Iteration 1 foundation. Revisit a decision when measurements or source-data inspection reveal a concrete reason.

## ADR-001: Keep a pnpm and uv monorepo

**Status:** Accepted

Use `apps/web/` for the Next.js application and Python projects under `services/` and `ml/`. Use pnpm only for JavaScript packages and uv only for Python environments and dependencies. This keeps the frontend and data/API toolchains independently reproducible.

## ADR-002: FalkorDB is the topology source of truth

**Status:** Accepted

FalkorDB owns graph topology and structural investigation evidence. UI graph payloads must come from executed Cypher. Parquet remains the source of truth for analytical tables, experiment splits, and model feature sets; graph materialization does not replace that offline data layer.

## ADR-003: Use first-class transaction nodes

**Status:** Accepted

Represent each transfer as `(:Account)-[:SENT]->(:Transaction)-[:RECEIVED]->(:Account)`. Transaction nodes provide stable audit references and support bounded temporal traversals. Do not store transfers only as `TRANSFER` relationships.

## ADR-004: Isolate labels and use past-only features

**Status:** Accepted

Keep target labels and typology ground truth in offline evaluation data. Build chronological splits where timestamps permit, freeze the test cohort, and ensure each feature uses only information available at the scored transaction time. No inference query returns labels.

## ADR-005: Start with three reproducible model experiments

**Status:** Accepted

Compare logistic regression, LightGBM with tabular and historical behavior features, and LightGBM with the same features plus graph-derived features. All share one train/validation/test protocol. Defer GNNs and graph transformers until this benchmark identifies a reason to add them.

## ADR-006: Keep scoring and action policy separate

**Status:** Accepted

Models emit scores. Deterministic policy maps validated scores and graph signals to `allow`, `review`, or a clearly labelled simulated `block`. An LLM does not own scoring, thresholds, or final policy. Provider and graph failures take a safe fallback path.

## ADR-007: Make the investigator evidence-bound

**Status:** Accepted

One optional tool-calling LLM may select among approved graph tools and draft a structured report. Deterministic code validates transaction IDs, paths, amounts, and timestamps against retrieved evidence. Unsupported claims are rejected or clearly marked as unverified. No fine-tuning or Jev-like model is required in Iteration 1.

## ADR-008: Require analyst confirmation for case memory

**Status:** Accepted

Only explicit analyst confirmation promotes a suspected entity into confirmed graph memory. Record reviewer, decision, time, and evidence provenance. Dismissal keeps transaction history and audit records; evaluation data cannot automatically seed confirmed memory.

## ADR-009: Keep local infrastructure small

**Status:** Accepted

Use Docker Compose for FalkorDB and native pnpm/uv development processes for the web app and API. Do not add Kafka, Redis, a vector database, or Kubernetes without measured need.

## ADR-010: Use HI-Small only after the user supplies it

**Status:** Accepted

Prepare for the IBM AMLworld HI-Small transaction, accounts, and pattern files, but do not fetch or commit them. Verify exact file version and schema when received. Keep raw data, processed Parquet, model artifacts, and credentials out of Git. Preserve the dataset's CDLA-Sharing-1.0 licensing and attribution separately from code licensing.
