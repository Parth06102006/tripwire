# TraceAML Architecture

## System boundaries

TraceAML is a local-first investigation workbench for replaying synthetic AML transactions. The first iteration includes data preparation and model evaluation, a FalkorDB-backed investigation service, deterministic decision policy, evidence validation, and an analyst UI.

It does not connect to banks, freeze funds, file regulatory reports, or claim production effectiveness. Distributed queues, Redis, vector search, Kubernetes, graph neural networks, and model fine-tuning are deferred.

## Repository map

```text
apps/web/                 Next.js analyst workbench
services/api/             FastAPI, policy, investigation orchestration
ml/                       Data inspection, preparation, features, models, metrics
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

The graph layer owns schema, indexes, ingestion, and parameterized Cypher. It exposes bounded operations for fund tracing, counterparty inspection, and selected flow patterns. Every traced transfer includes the sender and receiver account keys stored on its transaction node, as well as transaction references, timestamps, graph paths, and query duration. The pass-through query bounds both transfers to the requested time window. A missing graph result remains missing; neither the API, UI, nor LLM fills it in. The loader projects only inference-safe columns, preserves row-derived transaction IDs and duplicate source rows, and uses idempotent batched `MERGE` operations.

Offline graph features use a separate compact `FAccount`/`FLOW` feature graph, so historical feature construction does not alter the transaction-evidence graph. DuckDB externally sorts a projection containing only transaction ID, timestamp, and sender/receiver account keys. The builder processes complete same-minute groups by querying prior state before applying that minute. It creates an account-key index and writes a target-free Parquet sidecar with recent 24-hour in/out counterparty counts for both endpoints and a prior reverse-flow flag. Labels, split assignments, and pattern metadata are not read. The full feature extraction and same-cohort model comparison are still pending.

The local capacity probe loaded a 500,000-row chronological prefix into a separate transaction-evidence graph. It reconciled all transaction and edge counts, used about 706 MiB of database memory, and completed in 31.3 seconds. A simple row-proportional estimate for all 5,078,345 transactions is about 7 GiB before host headroom; the full transaction-evidence graph was not loaded on this 14 GiB host with about 5.6 GiB available. This estimate is a capacity projection, not a measured full-load result. The compact feature graph is independently built and measured; its capacity does not establish full transaction-graph capacity.

## API, policy, and investigation

FastAPI uses strict Pydantic request and response models. Implemented routes serve a ranked alert queue and benchmark artifacts, then combine target-free replay scores with deterministic `allow`/`review` policy and FalkorDB evidence. The API rejects unknown label-like fields and the score repository fails closed if the replay artifact contains target, split, or typology columns. The current report is a deterministic evidence summary; an optional tool-calling LLM is not connected yet.

The investigation model is optional and is invoked only for selected cases. It receives a score plus records returned by approved graph tools. It may propose hypotheses and summarize evidence, but deterministic validation checks transaction IDs, paths, amounts, and timestamps against retrieved records before showing claims as established. Provider errors or invalid output fall back to deterministic review.

Only explicit analyst confirmation promotes entities into confirmed case memory. Dismissal preserves the transaction history and audit trail. Test/evaluation records never become confirmed memory automatically.

## Analyst workbench

Next.js App Router, TypeScript, Tailwind CSS, and shadcn/ui provide the web application. TanStack Query manages API state, Recharts presents recorded benchmark results, and Cytoscape.js renders graph evidence. The main areas are:

- **Alerts:** ranked transactions, scores, and policy outcomes.
- **Investigations:** evidence timeline and Cytoscape rendering of query-derived paths.
- **Benchmarks:** quality at stated alert budgets, latency, throughput, and cost.
- **System:** service state and replay controls.

The UI communicates that its data is a synthetic replay. It never creates graph facts locally; graph structure is rendered from the API's query-backed response.

The web client calls the same-origin `/api` path. Next.js rewrites those requests to `TRACEAML_API_ORIGIN` (default `http://127.0.0.1:8000`), avoiding browser CORS configuration for local development. The API and graph loader both use `TRACEAML_GRAPH_NAME`, so the loader must target the same graph configured for the API.

## Local services and reliability

Docker Compose runs FalkorDB locally. The web app and API can run in their native development environments with pnpm and uv. Keep provider credentials in ignored environment files.

If FalkorDB is unavailable, graph-dependent investigation reports an explicit service error rather than presenting a partial graph as complete. If the optional LLM is unavailable or returns invalid data, continue with verified graph evidence and deterministic policy. Bound depth, time windows, result counts, and query execution time to protect the service and browser.
