# TraceAML Architecture

## System boundaries

TraceAML is a local-first investigation workbench for replaying synthetic AML transactions. The first iteration includes data preparation and model evaluation, a FalkorDB-backed investigation service, deterministic decision policy, evidence validation, and an analyst UI.

It does not connect to banks, freeze funds, file regulatory reports, or claim production effectiveness. Distributed queues, Redis, vector search, Kubernetes, graph neural networks, and model fine-tuning are deferred.

## Repository map

```text
apps/web/                 Next.js analyst workbench
services/api/             FastAPI, policy, investigation orchestration
ml/                       Data inspection, preparation, features, models, metrics
bench/                    Latency, capacity, and cost benchmark suite (make bench)
graph/                    FalkorDB schema, indexes, and Cypher query definitions
data/raw/                 User-provided source data; ignored by Git
data/processed/           Normalized Parquet and split artifacts; ignored by Git
artifacts/                Generated models and benchmark runs; ignored by Git
docs/                     Product, architecture, contracts, decisions, role charters
compose.yaml              Local FalkorDB service
```

## Component flow

```mermaid
flowchart LR
    CSV["IBM AMLworld CSVs"] --> Inspect["Profile and validate"]
    Inspect --> Parquet["Normalized Parquet"]
    Parquet --> Split["Chronological split and past-only features"]
    Split --> Models["Logistic / LightGBM / LightGBM + graph features"]
    Parquet --> Loader["Idempotent graph loader"]
    Loader --> Graph[("FalkorDB")]
    Models --> API["FastAPI scoring and policy"]
    Graph --> Tools["Bounded investigation tools"]
    API --> UI["Next.js analyst workbench"]
    Tools --> Verifier["Evidence validation"]
    Verifier --> Report["Structured investigation report"]
    Report --> UI
    API --> Audit[("Audit records")]
```

## Data and evaluation

Parquet is the analytical source of truth. The current workspace uses HI-Small Kaggle version 8. `traceaml-inspect-hi-small` writes an aggregate-only source profile; `traceaml-prepare-hi-small` validates and normalizes the transaction file and writes `data/processed/hi-small-v8/transactions.parquet` plus `split-manifest.json`. The manifest records the source hash, schema, composite account-key rule, exact split algorithm, boundaries, and label counts. Use Polars for generic CSV inspection, DuckDB for local analytical queries, and PyArrow/Parquet for durable intermediate tables.

Use a chronological train/validation/test split when timestamps permit it. HI-Small timestamps have one-minute resolution; choose nearest cumulative-count cutoffs to 70%/85% while keeping each full timestamp group together. Feature construction for transaction `t` may use only records strictly earlier than `t`; records at the same minute are simultaneous. Keep labels and typology ground truth in the offline evaluation path. They must not be written to the inference graph or returned by inference queries.

The first benchmark ladder is logistic regression, LightGBM with tabular and historical behavior features, and LightGBM with the same features plus graph-derived features. Train and tune without reading the frozen test labels, and report all models on the same held-out cohort.

## FalkorDB graph

FalkorDB is the authoritative source for transaction topology and structural investigation evidence. The initial graph contains `Account` and `Transaction` nodes connected by `SENT` and `RECEIVED` relationships. Transaction nodes carry a stable source transaction ID, timestamp, amounts, currencies, and payment type as supported by the input schema. Account keys include institution or bank when account IDs are reused.

The graph layer owns schema, indexes, ingestion, and parameterized Cypher. It exposes bounded operations for fund tracing, counterparty inspection, and selected flow patterns. Every traced transfer includes the sender and receiver account keys stored on its transaction node, as well as transaction references, timestamps, graph paths, and query duration. The pass-through query bounds both transfers to the requested time window. A missing graph result remains missing; neither the API, UI, nor LLM fills it in. The loader projects only inference-safe columns and preserves row-derived transaction IDs and duplicate source rows. Its default `merge` mode is idempotent and batched. The `create` mode is for fresh graphs only: it creates each account once, then creates transactions and edges without existence checks. Each account stores `last_epoch`, its latest sent-or-received epoch, which anchors account windows.

Query shape (ADR-017): every account- or transaction-anchored statement binds the indexed key first and then expands that node's adjacency. Only `Account.account_key` and `Transaction.transaction_id` are indexed; Transaction timestamp indexes are not created, because they led the planner into window-wide scans. Fan-out and fan-in run as one statement. Pass-through uses an epoch histogram plus a bounded detail fetch instead of a cross product. Per-call cost therefore grows with the anchor's degree, not with graph size or window volume. `traceaml-graph-bench` (`make graph-bench`) runs the warmup + N-sample latency protocol against a named graph, and `traceaml-synthetic-fixture` writes seeded, label-free latency fixtures. Measured results: `docs/benchmarks/iteration-2-graph-performance.md`.

Offline graph features are computed by default from the Parquet projection with a vectorized builder (`traceaml-build-graph-features-batch`, ADR-015). DuckDB reads and orders only transaction ID, timestamp, and sender/receiver account keys; NumPy deduplicates transfers to pair-minute events and answers every point-in-time distinct-counterparty count with sorted interval keys and binary search, and reverse flow with a first-transfer lookup. It applies the same minute-group visibility rule, window bounds, and smoke-mode trailing-minute drop as the FalkorDB builder, and a parity test asserts row-for-row identical output. On a 5,078,345-row synthetic heavy-tailed input it ran in about 12-14 seconds with about 1.4 GiB peak process memory; on a 200,000-row synthetic prefix it took 1.1 seconds against 130 seconds for the FalkorDB builder, with identical output. These are synthetic measurements on the local development machine.

The FalkorDB builder remains available as a cross-check (`make graph-features-falkordb`). It uses a separate compact `FAccount`/`FLOW` feature graph, so historical feature construction does not alter the transaction-evidence graph. DuckDB externally sorts a projection containing only transaction ID, timestamp, and sender/receiver account keys. The builder processes complete same-minute groups by querying prior state before applying that minute. It creates an account-key index and writes a target-free Parquet sidecar with recent 24-hour in/out counterparty counts for both endpoints and a prior reverse-flow flag. Labels, split assignments, and pattern metadata are not read. The full 5,078,345-row extraction completed in 1,563 seconds, and all rows reconciled. On the frozen test cohort, LightGBM with these graph features scored below the tabular baseline: average precision was 0.1521 versus 0.1587, and recall at a 0.1% alert budget was 14.73% versus 15.89%.

Iteration 1 loaded a 500,000-row prefix (about 706 MiB, 31.3 seconds) and projected about 7 GiB for the full graph. Iteration 2 loaded the full 5,078,345-transaction HI-Small v8 graph (515,088 accounts) in create mode in 521 seconds; all transaction and edge counts reconciled. `GRAPH.MEMORY USAGE` reported 2,514 MB, and the server's `used_memory` peaked at 4.13 GiB during the load. On that graph, the iteration-1 case's five investigation tools summed to 23.2 ms P50, while the five calls anchored on high-degree accounts (degree up to 169,756) summed to 207 ms P95. These are serial measurements on the local development machine (`docs/benchmarks/iteration-2-graph-performance.md`). The compact feature graph is independently built and measured; its capacity does not establish full transaction-graph capacity.

## API, policy, and investigation

FastAPI uses strict Pydantic request and response models. Implemented routes serve a ranked alert queue and benchmark artifacts, then combine target-free replay scores with deterministic `allow`/`review` policy and FalkorDB evidence. The API rejects unknown label-like fields and the score repository fails closed if the replay artifact contains target, split, or typology columns. The default report is a deterministic evidence summary. An optional Gemini tool-calling agent (`api.llm`, ADR-020) runs only when a request sets `use_llm`: it selects among the approved bounded graph tools, drafts a structured report, and deterministic verification checks every cited ID, amount, timestamp, and path against retrieved evidence. Any provider failure or unverifiable claim returns the deterministic report.

The single entrypoint is `api.app:app`. Investigation tool calls run concurrently on pooled FalkorDB connections; the pattern queries overlap the fund-tracing traversal, and the response reports evidence-phase wall time plus per-tool durations (ADR-016). Domain errors map through centralized handlers to fixed-detail 404/409/503/504 responses. Analyst cases and their append-only review history persist in a local SQLite file (`TRACEAML_CASE_DB_PATH`).

The investigation model is optional and is invoked only for selected cases. It receives a score plus records returned by approved graph tools. It may propose hypotheses and summarize evidence, but deterministic validation checks transaction IDs, paths, amounts, and timestamps against retrieved records before showing claims as established. Provider errors or invalid output fall back to deterministic review.

Only explicit analyst confirmation promotes entities into confirmed case memory. Dismissal preserves the transaction history and audit trail. Test/evaluation records never become confirmed memory automatically.

## Analyst workbench

The workbench (`apps/web/`, rebuilt in Iteration 3, ADR-022) is a Next.js App Router application in strict TypeScript with Tailwind CSS v4 and shadcn-style primitives on Radix. TanStack Query holds server state, Zod validates every API response at the client boundary, React Flow renders the investigation graph with a deterministic dagre layout, and Apache ECharts draws benchmark charts. A public landing page at `/` (ADR-025) introduces the product and links in. The workbench behind it has exactly three screens:

- **Overview (`/overview`):** the alert queue (TanStack Table over `GET /api/alerts`, paged by the API; filter and column sort apply to the loaded page), three counts (scored transactions, open cases, analyst decisions), service status from `/api/health`, and lookup by transaction ID.
- **Investigation (`/investigation/[id]`):** the agent review. The left pane is a conversation: the analyst starts a review (bounds, and the opt-in Gemini agent), and every graph tool call appears as it runs with its stated purpose, the executed Cypher and its parameters, its measured duration, and what it added to the graph. The review ends with a verdict: the simulated decision, the risk level, the path through the escalation chain, the verified reasoning with clickable evidence, the hypothesis, and the case of the transaction with its gated and analyst actions. The right pane is the graph, growing with each tool result. `/investigation` without an ID offers lookup.
- **Performance (`/performance`):** model metrics, latency, capacity sweeps and cost from `GET /api/benchmarks`, with run provenance and the recorded host caveats. Measured values and estimates are labelled separately. No precision-recall curve is drawn, because the API serves aggregate metrics only.

Graph: accounts and transactions are both nodes, linked by `SENT` and `RECEIVED` edges, as in the graph contract. Element IDs come from source identifiers. Each tool result is merged into the graph by ID and laid out once on arrival: earlier nodes keep their positions, new nodes are placed next to a neighbour already on screen, scale in with a brief accent ring, and new edges draw from source to target. While the agent works the camera follows the newest results; when it stops the whole graph is shown. The alert transfer glows red and its two accounts are labelled as its sender and receiver. Transcript, graph and verdict all derive from one session state, so they cannot disagree. Selection emphasis is a generated stylesheet keyed on the `data-id` attribute React Flow puts on each element, so selecting an element does not re-render nodes.

Activity: the screen reads `POST /api/investigations/stream` (server-sent events). Each event is validated against its schema, and nothing is shown that the API did not send. The deterministic agent finishes in tens of milliseconds, so events are displayed at a readable pace (a few hundred milliseconds apart) with every duration taken from the API; "Show all now" and `prefers-reduced-motion` remove the pacing. A tool that ran and matched nothing is shown differently from a tool that failed, a stopped or failed review keeps what already arrived, and a stream that closes without a final event is reported as such. Model reasoning is never streamed: the screen shows each call's verified purpose and the verified reasoning points of the final report.

Case actions: "Propose case through the gate" runs the review again with `act: true`, so policy proposes and the deterministic gate decides. An analyst can also open a case directly and confirm or dismiss it (forms validated with React Hook Form and Zod). After every action the case is read back from the API. `GET /api/cases` has no transaction filter, so the screen pages through at most 1,000 cases to find the case for a transaction and says when the scan was partial.

The shell is a sidebar with the three screens and a compact service indicator, on the Obsidian theme (near-black canvas, one orange accent) defined once as tokens in `apps/web/src/app/globals.css` and shared with the landing page. Orange marks the product, agent and tool activity, green verified evidence, amber review, and red critical risk and the alert anchor. Every status also carries an icon and a word. Fonts (Inter and JetBrains Mono) are self-hosted from npm. Motion respects `prefers-reduced-motion`. The UI never creates graph facts locally, never treats browser state as the record of a case, and states that the data is a synthetic replay.

The web client calls the same-origin `/api` path. Next.js rewrites those requests to `TRACEAML_API_ORIGIN` (default `http://127.0.0.1:8000`), avoiding browser CORS configuration for local development. The API and graph loader both use `TRACEAML_GRAPH_NAME`, so the loader must target the same graph configured for the API. Setup, tests and measured graph rendering costs are in `apps/web/README.md`.

## Local services and reliability

Docker Compose runs FalkorDB locally. The web app and API can run in their native development environments with pnpm and uv. Keep provider credentials in ignored environment files.

If FalkorDB is unavailable, graph-dependent investigation reports an explicit service error rather than presenting a partial graph as complete. If the optional LLM is unavailable or returns invalid data, continue with verified graph evidence and deterministic policy. Bound depth, time windows, result counts, and query execution time to protect the service and browser.
