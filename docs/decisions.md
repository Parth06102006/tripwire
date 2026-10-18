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

## ADR-015: Compute offline graph features from Parquet; keep FalkorDB authoritative for evidence

**Status:** Accepted

The Iteration 1 graph feature sidecar was built by streaming every same-minute group through a compact FalkorDB feature graph. All 5,078,345 rows took 1,563 seconds, of which 1,561.8 seconds were graph round trips. The five features (recent 24-hour distinct in/out counterparties for both endpoints and a prior reverse-flow flag) are aggregate functions of the past transfer stream; they do not need a database traversal.

Build them by default with `traceaml-build-graph-features-batch` (`graph/src/graph/feature_batch.py`). It reads the same four allowlisted columns, applies the same minute-group visibility rule (strictly earlier minutes only; same-minute peers invisible), the inclusive `group_epoch - window` lower bound, all-time prior reverse flow, self-transfers as ordinary pairs, and the same smoke-mode trailing-minute drop, and writes the same schema. It rejects null projected values instead of coercing them. Seeded synthetic tests check it against a brute-force evaluation of the written semantics, against the streaming builder on an in-memory fake graph, and against the real FalkorDB builder row for row (skipped when FalkorDB is unreachable).

Measured on synthetic data on the local development machine (Ryzen 9 8945HS): a 5,078,345-row, 18-day input with Zipf-like degrees ran in about 12-14 seconds end to end with about 1.4 GiB peak process memory. On its first 200,000 rows the FalkorDB builder took 130.1 seconds and the batch builder 1.1 seconds, with identical output (about 114x). These are synthetic results, not HI-Small measurements.

FalkorDB remains the source of truth for graph topology and structural investigation evidence (ADR-002). The FalkorDB feature builder stays available as an independent cross-check (`make graph-features-falkordb`). This decision changes only how offline model features are computed.

## ADR-016: One API entrypoint with concurrent, pooled graph tools

**Status:** Accepted

The API has a single application, `api.app:app`, used by `make dev-api`, the service README, and the container image. A parallel rewrite (`api.main`) that served hardcoded alerts, seeded fake cases, and queried graph properties absent from the loader schema was removed; its case-review module was kept and rebuilt on the score artifact, without seed data.

Investigation tools run concurrently on a bounded thread pool. Each worker thread holds its own falkordb-py graph handle (the handle caches schema state) over one shared, bounded Redis connection pool per process, so requests reuse sockets instead of connecting per request. Pattern queries start as soon as either stage-one tool returns the anchor transfer's account keys. Every query keeps its server-side timeout, and the evidence phase has an overall deadline derived from it. Evidence merges in a fixed order, so concurrency does not change results. `query_duration_ms` now reports evidence-phase wall time, with per-tool durations in `tool_durations_ms`. Iteration 1 measurements summed serial tool time and are not directly comparable.

Case history is append-only in SQLite (`TRACEAML_CASE_DB_PATH`), enforced by triggers. Graph-side case links are deferred.

## ADR-017: Anchor graph queries on indexed keys; maintain Account.last_epoch; fresh-load create path

**Status:** Accepted

Iteration 1 flow-pattern tools took about 0.9-1.7 seconds even with zero matches. `GRAPH.PROFILE` showed the cause: with a `Transaction.timestamp_epoch` range index present, the planner started account-anchored statements from a timestamp range scan (528,982 rows for a one-day window on a 1M-transaction graph) and traversed back to the account, instead of starting from the `Account.account_key` index. The same profile exposed a correctness bug: `TRACE_ACCOUNT_LATEST_EPOCH` used `UNION ... ORDER BY epoch DESC LIMIT 1`, and in Cypher the trailing `ORDER BY`/`LIMIT` binds only to the last `UNION` branch, so the window end was an arbitrary epoch from the first branch. On the 500-account equivalence fixture the legacy statement was wrong for 497 accounts. On the iteration-1 case (`hi8-tx-03863669`) the sender's window ended 31.7 hours before its latest activity. Legacy fan-out found 2 distinct counterparties and no match; the corrected window finds 7 counterparties and 7 matches. Iteration-1 pattern results and their latency depended on that arbitrary window. The same `UNION`/`LIMIT` binding meant `trace_funds` limited only its last branch.

Decisions:

- Account- and transaction-anchored statements bind the indexed anchor first (`MATCH ... WITH a MATCH (a)-[:SENT]->(t)`), so expansion starts at the anchor. The `Transaction(timestamp)` and `Transaction(timestamp_epoch)` range indexes are no longer created; only `Account.account_key` and `Transaction.transaction_id` are indexed (with unique constraints).
- `Account.last_epoch` (maximum sent-or-received `timestamp_epoch`) is maintained by the loader and read with one index lookup. Graphs without it fall back to `max()` aggregated per direction. It is derived only from inference-safe columns.
- `fan_out`/`fan_in` compute the distinct-counterparty gate and the earliest `result_limit` transfers in one statement, reading counterparty keys from the denormalized `sender_account_key`/`receiver_account_key` transaction properties (kept for this reason) instead of a second expansion.
- `pass_through` no longer forms the incoming x outgoing cross product. One statement returns an outgoing epoch histogram. A second returns the first `result_limit` incoming legs that have an outgoing leg within the dwell, using interval tests derived from the histogram. Python plans the exact first pairs, and a third statement fetches only the outgoing legs at the needed epochs. Ordering is `(t1, t2)` time as before; ties, unspecified in iteration 1, are broken by transaction ID.
- `trace_funds` applies `LIMIT $result_limit` per `(direction, depth)` branch. Each branch stays lazy and bounded; results are unchanged whenever no branch exceeded the limit.
- Copying `timestamp_epoch` onto `SENT`/`RECEIVED` edges was measured and rejected: filtering on the edge property was slower than on the node property (15.7 ms vs 11.2 ms median for 8,808 edges).
- The loader de-duplicates accounts per batch. `--mode create` is a fresh-load path: it refuses a non-empty graph, creates every account once with its final `last_epoch` (Arrow group-by), then `CREATE`s transactions and edges. `--mode merge` (default) stays idempotent. `source_row_number` is no longer stored; it is never returned and is recoverable from the row-derived ID.
- `TransactionNotFound` and `AccountNotFound` subclass `ValueError` and keep the iteration-1 messages.

Equivalence: `graph/tests/test_equivalence_live.py` builds a seeded synthetic graph and checks every tool against complete reference result sets from the frozen iteration-1 statements (`graph/src/graph/legacy_queries.py`). Records must be identical, counts must equal `min(limit, reference size)`, and the leading sort-key sequence must match. Legacy window ends are corrected for the comparison. It also checks that merge mode, create mode and the self-contained `BATCH_CYPHER` build identical graphs. Measured results are in `docs/benchmarks/iteration-2-graph-performance.md`.

## ADR-018: Iteration 2 detection model and test-look discipline

**Status:** Proposed (pending lead review)

Adopt the Iteration 2 all-family LightGBM (`s1_all_reg_neg100`) as the detection model for the held-out replay. It uses 76 strictly past-only features in seven families, built by `ml.feature_families`, with regularized LightGBM. It was selected on validation (AP 0.6088) and evaluated once on the frozen test cohort (AP 0.7525; Sept 9-10 bulk AP 0.5996), against Iteration 1's 0.1587. Results and audits are in [the Iteration 2 detection report](benchmarks/iteration-2-detection.md).

Test candidates are pre-declared in `ml/experiments/iteration2_candidates.json` and committed before any test look. Every test evaluation, including re-analysis of frozen scores, is appended to the run's `test_ledger.jsonl` and reported. Report Sept 9-10 bulk metrics next to full-cohort metrics, because the Sept 11-18 tail is near-separable and dominates full-cohort budget recall. Report per-currency amount-weighted recall as defined in ADR-011, never summed across currencies. Treat the static account registry (`kyc` family) as serving-time metadata and keep the no-registry variant (test AP 0.7326) as the robustness reference.

## ADR-019: Separate uv benchmark project with contamination-aware protocol

Status: accepted (Iteration 2).

Context: latency, capacity, and cost need one reproducible command. The model workload needs LightGBM and the capacity workload needs an async HTTP client and process meters. None of these belong in the API's runtime dependencies. The host and FalkorDB server are shared with other jobs.

Decisions:

- `bench/` is its own uv project (`make bench`, `traceaml-bench`). It depends on `traceaml-api` and `traceaml-graph` as editable path dependencies, so it measures the code in the working tree. Direct tool timings go through `api.investigate.FalkorGraphTools` with the investigation's arguments.
- Protocol: warmups, then N samples, reporting P50/P95/P99/mean (linear interpolation). Capacity runs closed-loop clients in a separate load-generator process against a real uvicorn process. Each run records hardware, OS, Git commit, package versions, FalkorDB configuration, graph counts, input sha256 hashes, and the protocol in `results.json`.
- Shared-host handling: a quiet gate checks foreign graph calls, blocked FalkorDB clients, FalkorDB CPU, and background host threads before every phase, within a run-wide budget. Every window records background load, contaminated capacity levels are re-measured once, and flagged results are labelled in the summary and snapshot. `--resume` adds missing workloads to an interrupted run after re-checking input hashes.
- Cost is an explicit estimate: measured CPU-seconds and resident memory at dated, cited cloud list prices, reported both metered and provisioned. LLM cost is reported as zero calls.
- The demo graph is built by the graph loader (`--mode create --window-around`); the suite's DuckDB slice is only a row-count and hash cross-check. Benchmark graphs must be named `agentbench-*` before the suite deletes or reloads them.

## ADR-020: Gemini report agent: opt-in, bounded, verified, fail-safe

**Status:** Accepted

Implement the PRD's tool-calling investigator with Gemini through the `google-genai` SDK, as an opt-in path (`use_llm` on `POST /api/investigations`) beside the deterministic report. The default path stays deterministic so the measured Iteration 2 latency and zero cost are unchanged; model calls take seconds and cost tokens.

The model is a proposer, not an authority (ADR-006, ADR-007). Automatic SDK function calling is disabled so only whitelisted tools with validated arguments execute: `trace_funds` and `detect_flow_patterns`. It cannot choose the anchor, window, limits, or write Cypher. Total tool calls, rounds, and wall time are capped. The final report is a separate stateless JSON request, which avoids combining tool use with structured output. Code, not the model, fixes the recommendation to human review, and the score and decision are read-only inputs.

A draft is shown only after deterministic verification: cited IDs exist, structured claims match evidenced records field by field, cited paths equal returned paths, and prose identifiers and amount-sized numbers come from evidence. Free-text numbers below 1,000 and descriptive wording are not verified; amounts and dates belong in `cited_claims`, and the prompt requires it. Failures fall back to the deterministic report with a coarse reason code. Graph errors are not masked.

Configuration uses the existing `LLM_PROVIDER`, `LLM_API_KEY`, and `LLM_MODEL` names (also `GEMINI_API_KEY` and `TRACEAML_`-prefixed forms). The key is a Pydantic `SecretStr` read from the git-ignored `.env`, is never logged or returned, and provider error text is discarded. Cost is reported only when both per-million-token prices are configured; none is assumed. The default model alias is `gemini-flash-latest`, configurable because model names change. Retrieved synthetic evidence is sent to Google only on opt-in requests.

Status: unit-tested with a scripted model and an SDK-level stub; not yet exercised against the live Gemini API. A live smoke test is provided and skipped unless a key and `TRACEAML_LIVE_LLM_TEST=1` are set.

## ADR-021: MCP boundary and gated case actions for the agent

**Status:** Accepted

The agent reaches graph tools through an MCP server instead of direct function calls, and its case actions pass a deterministic gate.

MCP: `api.mcp_graph` exposes exactly `trace_funds`, `inspect_counterparties`, and `detect_flow_patterns` as typed, bounded MCP tools. They delegate to the existing parameterized queries (no Cypher is duplicated or generated) and reject out-of-range arguments before any database call. The agent runtime calls them through a real MCP client session (in-memory transport, one per LLM request) behind the existing `GraphTools` seam, so the investigation, verifier, and tests are unchanged. The provider's function calls are mapped onto MCP tool calls; the deterministic path keeps direct calls. `TRACEAML_AGENT_TOOL_TRANSPORT=direct` bypasses the protocol. The same server runs over stdio (`python -m api.mcp_graph`). The `mcp` package is pinned below 2.0 because 2.x renames the server API.

Outcomes and trace: every tool call is recorded (tool, bounded arguments, who chose it, outcome, counts, truncation, duration). Results use `evidence_found`, `no_matching_path`, `unknown_anchor`, or `inconclusive`; a capped result without a path is `inconclusive`, never a clean negative.

Action: the agent proposes `open_case` or `enrich_case` in its draft (with a reason that is verified like the hypothesis); without an LLM, policy makes the same proposal. Code applies it only when evidence was found, the decision is `review` for opening, every evidence reference exists in the returned evidence, and the case state allows it. Writes go to the SQLite case store as append-only evidence with tool-run IDs and a score and decision snapshot, never to FalkorDB. Cases stay `suspected` until an analyst confirms or dismisses them (ADR-006, case memory rule). The action is opt-in per request (`act`).

Status: unit-tested with a scripted model, a fake graph, and a real MCP session. The live tests against FalkorDB (`test_agent_live_graph.py`) skip when it is unreachable and have not been run against a live graph yet.

## ADR-022: Rebuilt workbench: three screens, React Flow, ECharts, honest request/response activity

**Status:** Accepted

The Iteration 2 workbench (six screens, Cytoscape.js, Recharts, browser-kept run history, Recorded mode) was removed and `apps/web/` rebuilt with three screens: Overview, Investigation and Performance. The case of a transaction is part of the Investigation screen.

Graph library: React Flow (`@xyflow/react`) with a dagre layout. Investigation subgraphs are bounded by the API (at most 100 rows per tool and branch, 1 to 3 hops). The largest response measured on the demo graph, 254 nodes and 284 edges at maximum bounds, renders and zooms without long tasks apart from the one-time layout of each run. Custom React nodes for accounts, transactions and the alert anchor carry the evidence styling. Cytoscape.js stays the fallback if real responses outgrow this; the client display limit (`NEXT_PUBLIC_GRAPH_NODE_LIMIT`, default 600) is where that would show first. The layout is a pure fold over the runs of the session, so the same responses always produce the same positions, and later runs only add nodes.

Charts: Apache ECharts with only the bar and line modules registered, rendered as SVG. Series colours are a categorical set validated for colour-vision deficiency on the dark surface and kept clear of the status colours.

Activity: the API returns an investigation as one response. The timeline does not simulate streaming. It shows the request, a truthful waiting state, then the events the response reports. A streaming endpoint (for example server-sent events carrying each tool-trace entry and its evidence as it completes) would let the graph grow per tool. It is recorded as a backend requirement, not built into the UI.

Data handling: Zod validates every response at the client boundary and strips unknown fields. Unit and component tests use invented identifiers. End-to-end tests run against a live stack and write to the case store the API is configured with, so they run against a scratch `TRACEAML_CASE_DB_PATH`.

## ADR-023: Escalation chain, agent risk level, and a streamed agent review

**Status:** Accepted

The deterministic model gathers suspicious transactions for operators; the agent review is the review of a flagged transaction. The escalation chain is:

1. Traditional model and rules. A score at or above `TRACEAML_BLOCK_THRESHOLD` is a simulated block. The default `0.999` is a placeholder chosen without validation labels (it covers 42 of the 1,627 flagged test transactions) and must be set from validation precision before it is relied on. Blank disables the rule.
2. Review routing. At or above the validation-selected review threshold the transaction is flagged for agent review; below it, it takes the standard path and is allowed.
3. Agent review. The Gemini agent proposes a risk level from 1 to 5 under a fixed rubric, with reasoning points that cite returned transactions. Code verifies both like the hypothesis, then maps 4 to 5 to a block and 1 to 3 to an allow. Without a verified level the transaction stays flagged for an operator; it is not silently allowed. The agent cannot reverse an upstream block and does not change a standard-path allow.

This keeps ADR-006: the model proposes and deterministic policy decides, and every block is simulated. Policy version moves to `v2`; the `decision` field and the case gate are unchanged, and the outcome is a new `escalation` object.

Streaming: `POST /api/investigations/stream` sends server-sent events as tool calls start and finish, replacing the "backend requirement" recorded in ADR-022. A listener on the traced tools (both the direct and the MCP transport) emits each call with its arguments, a stated purpose (fixed text for policy calls, the agent's verified one-sentence intent for model calls), the evidence it returned shaped through the existing allowlists, and the Cypher it executed. Cypher is captured by a proxy on the pooled graph handle while a call runs on its worker thread, so `graph/` is unchanged and the statements shown are the statements sent. The model never receives them. The final event is the full response, which remains the authority.

Model text between tool calls is not streamed or shown; only counts of rounds and calls. The UI paces the display of real events so the graph visibly grows; it never invents, reorders or delays the recording of an event, and it shows the API's measured durations.

Status: the escalation table, verification of the level and reasoning, both transports, Cypher capture across MCP, and stream errors are covered by `services/api/tests/test_stream.py`. The live stream was exercised against FalkorDB with the deterministic agent. The Gemini agent path is tested with a scripted model only; no provider key was available to run it live.

## ADR-024: Every scored transaction must be investigable; availability is reported, never filtered

**Status:** Accepted

The demo graphs were slices, so many queued alerts could not be investigated and failed only when an analyst opened them. The working environment now loads the full HI-Small v8 graph (5,078,345 transactions) under the contract name `traceaml`, so every scored transaction exists in the graph the agent queries.

As a safeguard against partial or failed ingestion, `GET /api/alerts` reports `graph_status` per alert from one bounded, indexed lookup per page. The queue marks a missing alert instead of hiding it: filtering would silently drop flagged alerts, which an AML queue must never do, and a visible gap gets the ingestion fixed. When FalkorDB cannot be asked the status is `unknown` and the queue still loads. Demo slices remain available through `make graph-load-demo` for fast local work, with the same visible marking.

## ADR-025: A public landing page at `/`, one theme for landing and workbench

**Status:** Accepted

The landing page built on the `feat/landing-page` branch is merged into the rebuilt workbench as it was. It lives in `apps/web/src/components/landing/` and is served at `/`, so the Overview screen moved to `/overview`. A route group `(workbench)` keeps the sidebar shell on `/overview`, `/investigation` and `/performance`, while `(landing)` renders full width without it. The landing links that pointed at the old six-page workbench now point at the three screens.

The workbench adopts the landing theme rather than the reverse: the near-black canvas, the single orange accent, and Inter with JetBrains Mono. The landing vocabulary (`canvas`, `card`, `ink`, `dim`, `line`, `accent`, `safe`, `warning`, `critical`) and the workbench vocabulary (`background`, `surface`, `fg`, `fg-muted`, `border`) resolve to the same variables in `globals.css`. Colour meaning is unchanged: orange for the product, agent and alert anchor, green for verified evidence, amber for review, red for critical risk. The former `violet`, `teal`, `amber` and `coral` utility names were renamed to `accent`, `safe`, `warning` and `critical` so the names match what the colours now are.

The landing page keeps its own content. Its recorded-metrics strip reads the same `/api/benchmarks` data as the Performance screen through the shared client.

## ADR-026: Detection benchmarks come from the Iteration 2 results; the alert queue filters on the server

**Status:** Accepted

The performance screen had been serving the Iteration 1 baseline metrics, which `docs/benchmarks/iteration-2-detection.md` supersedes. `/api/benchmarks` now serves the four rows of that document's summary (the frozen Iteration 1 baseline, C3, C2, and the selected model C1) from a committed export, `docs/benchmarks/iteration-2-detection.json`. `ml/experiments/export_api_benchmarks.py` writes it from the frozen test ledger, so the figures are not retyped, and a test pins the C1 values. The Sept 9-10 bulk is exported beside the full-cohort figures and the screen leads with it, because the document shows the full-cohort numbers are inflated by a near-separable 1,108-row tail. The export adds metrics only: no scores, labels or per-row outcomes. The replay queue is still scored by the Iteration 1 artifact until `TRACEAML_SCORE_ARTIFACT` is switched as the document describes.

The overview queue now filters on the API (route, score range, day range, transaction ID text) instead of only within the loaded page, so a filter reaches all 761,639 scored transactions. Route and score filters are rank ranges found by bisection; date and text filters take one pass over the matching score window. The queue never drops an alert silently: filters are explicit, shown, and clearable, and `scored_total` stays visible. The overview is one viewport tall from the `xl` breakpoint up, and only the queue table scrolls.

