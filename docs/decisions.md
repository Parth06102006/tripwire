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

Keep target labels and typology ground truth in offline evaluation data. The feature-generation stage must not read target values; the separate offline evaluator joins labels by transaction ID and split, and reads test labels only after thresholds are locked. For HI-Small v8, use a chronological transaction split with target proportions 70%/15%/15%. The source timestamp resolution is one minute; choose the nearest cumulative-count boundaries while keeping every same-minute group in one split. Freeze the resulting test cohort in the split manifest. Historical features for transaction `t` may use only records with timestamps strictly earlier than `t`; same-minute transactions are simultaneous and cannot contribute to each other's features. No inference query returns labels.

## ADR-005: Start with three reproducible model experiments

**Status:** Accepted

Compare logistic regression, LightGBM with transaction-local and past-only behavior features, and LightGBM with the same features plus graph-derived features. All share one train/validation/test protocol and frozen test cohort. Use a phase-separated offline pipeline with normalized Parquet, a versioned split manifest, model artifacts, and machine-readable metrics. Tracer's pipeline structure and fixed-recall reporting are references; its account-stratified split and full-period account aggregates are not used for TraceAML's transaction-time benchmark. Defer GNNs and graph transformers until this benchmark identifies a reason to add them.

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

## ADR-010: Pin HI-Small v8 and keep data artifacts local

**Status:** Accepted

Use IBM AMLworld HI-Small Kaggle version 8 for Iteration 1. The local workspace has `HI-Small_Trans.csv`, `HI-Small_accounts.csv`, and `HI-Small_Patterns.txt` under `data/raw/hi-small/`; keep all source files, processed Parquet, profiles, model artifacts, and credentials out of Git. Record source hashes and schema in the generated profile and split manifest. Preserve the dataset's CDLA-Sharing-1.0 licensing and attribution separately from this repository's code license.

## ADR-011: Preserve currency units in evaluation

**Status:** Accepted

Keep `Amount Paid` paired with `Payment Currency` and `Amount Received` paired with `Receiving Currency`. Do not compare these amounts directly when currencies differ, and do not sum different currencies into one dollar-weighted recall. Report value-weighted recall by currency or defer a combined valuation until a dated, documented FX source is selected. Never describe repeated transfer amounts as unique recovered funds.

## ADR-012: Learn from Tracer without vendoring its benchmark

**Status:** Accepted

Use Tracer's phase-separated processing, shared model artifacts, validation-selected thresholds, and fixed-recall/alert-budget comparisons as implementation references. Keep TraceAML's Next.js, FastAPI, and FalkorDB stack and its chronological transaction-level evaluation. Do not import Tracer's model scores, account-level labels, shuffled 60/20/20 split, or full-period aggregates into TraceAML. No Tracer source is vendored; if code is reused later, retain its Apache-2.0 notices and identify the upstream revision. The detailed review is in [the Tracer reference note](research/tracer-aml-reference.md).

## ADR-013: Preserve exact duplicate source rows

**Status:** Accepted

The HI-Small v8 transaction file contains 9 exact duplicate rows across its 11 source fields. Preserve all source rows rather than guessing that a repeated record is accidental. Assign each a distinct stable ID from its source row number and recorded file hash. Record the duplicate count in the profile so later experiments can evaluate a deduplication sensitivity analysis without changing the primary cohort.

## ADR-014: Keep baseline reruns deterministic and report both decision framings

**Status:** Accepted

Sort every joined train/validation/test split by transaction ID before encoding. Train LightGBM 4.7 in documented deterministic CPU mode with fixed seeds and thread count, native categorical features, and validation early stopping; keep logistic regression on the identical feature set and split. Record package versions, thread settings, seeds, and feature/split manifest hashes in each run config. Two clean-directory reruns must reproduce predictions and metrics exactly (tolerance: bitwise identity); record any deviation with its magnitude instead of averaging it away.

Report validation-threshold results and fixed review-capacity results as distinct framings. The max-F1 validation threshold admits a variable-size alert set and answers "how does the tuned operating point perform". The predeclared 0.1% alert budget admits exactly that many top-scored test transactions and answers "what fits a fixed review capacity". Never present a budget-selected set as threshold performance or vice versa. Day-level model metrics additionally require at least 10 positives per day; thinner days report counts only.

## ADR-015: Iteration 2 detection model and test-look discipline

**Status:** Proposed (pending lead review)

Adopt the Iteration 2 all-family LightGBM (`s1_all_reg_neg100`) as the detection model for the held-out replay. It uses 76 strictly past-only features in seven families, built by `ml.feature_families`, with regularized LightGBM. It was selected on validation (AP 0.6088) and evaluated once on the frozen test cohort (AP 0.7525; Sept 9-10 bulk AP 0.5996), against Iteration 1's 0.1587. Results and audits are in [the Iteration 2 detection report](benchmarks/iteration-2-detection.md).

Test candidates are pre-declared in `ml/experiments/iteration2_candidates.json` and committed before any test look. Every test evaluation, including re-analysis of frozen scores, is appended to the run's `test_ledger.jsonl` and reported. Report Sept 9-10 bulk metrics next to full-cohort metrics, because the Sept 11-18 tail is near-separable and dominates full-cohort budget recall. Report per-currency amount-weighted recall as defined in ADR-011, never summed across currencies. Treat the static account registry (`kyc` family) as serving-time metadata and keep the no-registry variant (test AP 0.7326) as the robustness reference.
