# TraceAML

TraceAML is a graph-powered AML detection and investigation workbench built for reproducible experiments on IBM AMLworld HI-Small. The repository is named Tripwire. The product replays synthetic transactions, compares classical and graph-enhanced models, retrieves bounded evidence from FalkorDB, and presents investigations for human review.

The dataset has not been added. The user will provide it; do not commit raw data, processed tables, credentials, or generated models.

## Repository layout

```text
apps/web/       Next.js analyst workbench
services/api/   FastAPI service, policy, investigation integration
ml/             Data inspection, feature preparation, models, evaluation
graph/          FalkorDB schema, indexes, and query definitions
docs/           Product, architecture, API contracts, decisions, and role charters
compose.yaml    Local FalkorDB service
```

## Requirements

- Node.js 20.9 or newer and pnpm
- Python 3.12 or newer and uv
- Docker Compose

## Local setup

Install the frontend dependencies and start the web app:

```bash
pnpm install
pnpm dev:web
```

Start FalkorDB:

```bash
docker compose up -d falkordb
```

Install and run the API from the repository root:

```bash
uv sync --project services/api
uv run --project services/api fastapi dev services/api/src/api/app.py
```

The API listens on `http://127.0.0.1:8000`; interactive API documentation is at `/docs`. Copy `.env.example` to `.env` to override local service settings. Do not put real credentials in the example file.

## Dataset placement

Place user-provided HI-Small files under `data/raw/`:

- `HI-Small_Trans.csv`
- `HI-Small_accounts.csv`
- `HI-Small_Patterns.txt`

Confirm the exact version, schema, license, and file hashes before training or graph ingestion. The expected dataset is synthetic and uses CDLA-Sharing-1.0; dataset terms are distinct from the code license. Raw and generated data paths are ignored by Git.

Once the transaction CSV is present, inspect it without writing or downloading data:

```bash
uv run --project ml traceaml-profile-csv data/raw/HI-Small_Trans.csv
```

## Evaluation principles

The first benchmark compares logistic regression, LightGBM with tabular and past-only behavioral features, and LightGBM with the same feature set plus graph signals. Use one chronological split and one frozen test cohort across experiments. Tune only on training and validation data. Keep labels and typology truth out of graph inference data and API responses.

Report precision, recall, F1, average precision/PR-AUC, recall at a stated alert budget, and clearly defined dollar-weighted recall. Record split boundaries, feature availability, model configuration, hardware, concurrency, P50/P95 latency, throughput, and cost methodology. No benchmark numbers are claimed until produced by a reproducible run.

## Graph and investigation

FalkorDB is the source of graph topology and investigation evidence. Transfers use first-class transaction nodes:

```text
(:Account)-[:SENT]->(:Transaction)-[:RECEIVED]->(:Account)
```

Approved investigation tools are `trace_funds`, `inspect_counterparties`, and `detect_flow_patterns`. They use bounded parameterized queries and return source transaction IDs, times, values, paths, and query duration. The optional LLM can choose tools and summarize retrieved evidence; deterministic code verifies claims before display. Models and LLM output do not decide policy actions.

See [architecture](docs/architecture.md), [API and graph contracts](docs/contracts.md), [decisions](docs/decisions.md), and [team role charters](docs/milestones/README.md).
