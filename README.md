# TraceAML

TraceAML is a graph-powered AML detection and investigation workbench built for reproducible experiments on IBM AMLworld HI-Small. The repository is named Tripwire. The product replays synthetic transactions, compares classical and graph-enhanced models, retrieves bounded evidence from FalkorDB, and presents investigations for human review.

The local workspace contains IBM AMLworld HI-Small Kaggle version 8 under `data/raw/hi-small/`. Dataset files are ignored by Git and are not included in this repository. Do not commit raw data, processed tables, credentials, or generated models.

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

## Dataset and data preparation

The pinned input is HI-Small dataset version 8 from Kaggle. The source data is synthetic and licensed separately from this repository's code (CDLA-Sharing-1.0). Keep these files under `data/raw/hi-small/`:

- `HI-Small_Trans.csv`
- `HI-Small_accounts.csv`
- `HI-Small_Patterns.txt`

To reproduce the download with KaggleHub, request each file from the pinned dataset version using the `path` argument, then place the returned file in `data/raw/hi-small/`:

```python
from pathlib import Path
from shutil import copy2

import kagglehub

dataset = "ealtman2019/ibm-transactions-for-anti-money-laundering-aml/versions/8"
destination = Path("data/raw/hi-small")
destination.mkdir(parents=True, exist_ok=True)
for filename in (
    "HI-Small_Trans.csv",
    "HI-Small_accounts.csv",
    "HI-Small_Patterns.txt",
):
    downloaded = Path(kagglehub.dataset_download(dataset, path=filename))
    if downloaded.is_dir():
        downloaded = downloaded / filename
    copy2(downloaded, destination / filename)
```

The local aggregate profile records file hashes, schema, label counts, currency distributions, and account-key cardinalities at `artifacts/runs/hi-small-v8/profile.json`. Raw and generated data paths are ignored by Git.

Regenerate the inspection profile, normalized Parquet table, and frozen chronological split:

```bash
uv run --project ml traceaml-inspect-hi-small
uv run --project ml traceaml-prepare-hi-small
uv run --project ml traceaml-build-features
uv run --project ml traceaml-train-baselines
```

Preparation writes `data/processed/hi-small-v8/transactions.parquet` and `split-manifest.json`. The manifest contains the pinned source hash, canonical columns, split algorithm and boundaries, row counts, and positive counts. It places whole minute-resolution timestamps into one split and keeps `target_is_laundering` offline-only.

## Evaluation principles

The local v8 run has completed logistic regression and LightGBM with tabular and past-only behavioral features. On the frozen test split (761,639 transactions; 0.205% positive prevalence), the latest LightGBM run has average precision 0.1853; at its validation-selected threshold, precision is 28.32% and recall is 23.06%. At the fixed 0.1% alert budget, recall is 17.36%. Logistic regression average precision is 0.0146 and recall at that alert budget is 0%. Full metrics and configuration are in the local, Git-ignored `artifacts/runs/hi-small-v8/baselines/` directory and can be regenerated with the commands above.

The graph-feature comparison remains pending. A rerun after separating labels from feature generation changed the LightGBM result from the earlier run; the source of the variation has not been isolated, so treat these as run-specific results pending a repeatability check. Use one chronological split and one frozen test cohort across experiments. Tune only on training and validation data. Keep labels and typology truth out of graph inference data and API responses. Test prevalence is higher than train and validation; these synthetic-data results do not establish real-world AML effectiveness.

Report precision, recall, F1, average precision/PR-AUC, recall at a stated alert budget, and clearly defined dollar-weighted recall. Record split boundaries, feature availability, model configuration, hardware, concurrency, P50/P95 latency, throughput, and cost methodology. Dollar-weighted recall, latency, throughput, and cost have not yet been measured.

## Graph and investigation

FalkorDB is the source of graph topology and investigation evidence. Transfers use first-class transaction nodes:

```text
(:Account)-[:SENT]->(:Transaction)-[:RECEIVED]->(:Account)
```

Approved investigation tools are `trace_funds`, `inspect_counterparties`, and `detect_flow_patterns`. They use bounded parameterized queries and return source transaction IDs, times, values, paths, and query duration. The optional LLM can choose tools and summarize retrieved evidence; deterministic code verifies claims before display. Models and LLM output do not decide policy actions.

See [architecture](docs/architecture.md), [API and graph contracts](docs/contracts.md), [decisions](docs/decisions.md), and [team role charters](docs/milestones/README.md).

Implementation reference: [Tracer AML Graph Intelligence](docs/research/tracer-aml-reference.md). Its public results use a different account-level split and are not TraceAML benchmark results.
