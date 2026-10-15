# TraceAML developer tasks. Recipes are plain commands so they run under both
# Windows cmd and POSIX sh. Run `make help` for the target list.

PARQUET ?= data/processed/hi-small-v8/transactions.parquet
GRAPH_NAME ?= traceaml-demo
LIMIT ?=
API_APP ?= services/api/src/api/app.py
API_IMAGE ?= traceaml-api
GRAPH_FEATURES_OUT ?= data/processed/hi-small-v8/graph-features.parquet
GRAPH_FEATURES_MANIFEST ?= data/processed/hi-small-v8/graph-features-manifest.json
FEATURE_GRAPH ?= traceaml-features
GRAPH_FEATURES_FALKORDB_OUT ?= data/processed/hi-small-v8/graph-features-falkordb.parquet
GRAPH_FEATURES_FALKORDB_MANIFEST ?= data/processed/hi-small-v8/graph-features-falkordb-manifest.json
GRAPH_ABLATION_DIR ?= artifacts/runs/hi-small-v8/graph-ablation
SYNTH_PARQUET ?= data/interim/synthetic/hi-small-shape.parquet

LIMIT_ARG = $(if $(LIMIT),--limit $(LIMIT))

.DEFAULT_GOAL := help

.PHONY: help setup env install install-web install-py \
	up down logs dev-web dev-api api-image 
	data data-inspect data-prepare data-features data-train data-train-graph data-publish 
	graph-load graph-load-dry graph-features graph-features-falkordb graph-synth 
	test test-ml test-graph test-api lint lint-web lint-py build check

help:
	@echo TraceAML make targets
	@echo   setup          Create .env and install web and Python dependencies
	@echo   up / down      Start or stop the local FalkorDB container
	@echo   logs           Follow FalkorDB logs
	@echo   dev-web        Run the Next.js workbench dev server
	@echo   dev-api        Run the FastAPI dev server (API_APP=$(API_APP))
	@echo   api-image      Build the API container image (API_IMAGE=$(API_IMAGE))
	@echo   data           Run the full ML pipeline: inspect, prepare, features, train, publish
	@echo   graph-load     Load PARQUET into GRAPH_NAME (optional LIMIT=n)
	@echo   graph-load-dry Validate a graph load without writing
	@echo   data-train-graph Build graph features, then train the lgbm_graph ablation
	@echo   graph-features Build point-in-time graph features (vectorized offline builder)
	@echo   graph-features-falkordb Cross-check build through FalkorDB (slow; FEATURE_GRAPH)
	@echo   graph-synth    Write a 5,078,345-row synthetic benchmark Parquet
	@echo   test           Run ml, graph, and api tests
	@echo   lint           Run ESLint and Ruff
	@echo   build          Build the web app for production
	@echo   check          lint + test + build

# ---------------------------------------------------------------------------
# Setup
# ---------------------------------------------------------------------------

setup: env install

env:
	uv run --no-project python -c "import os, shutil; os.path.exists('.env') or shutil.copyfile('.env.example', '.env')"

install: install-web install-py

install-web:
	pnpm install --frozen-lockfile

install-py:
	uv sync --project ml
	uv sync --project graph
	uv sync --project services/api

# ---------------------------------------------------------------------------
# Services
# ---------------------------------------------------------------------------

up:
	docker compose up -d falkordb

down:
	docker compose down

logs:
	docker compose logs -f falkordb

dev-web:
	pnpm dev:web

dev-api:
	uv run --project services/api fastapi dev $(API_APP)

api-image:
	docker build -f services/api/Dockerfile -t $(API_IMAGE) .

# ---------------------------------------------------------------------------
# Data and model pipeline (requires data/raw/hi-small/ from the user)
# ---------------------------------------------------------------------------

data: data-inspect data-prepare data-features data-train data-publish

data-inspect:
	uv run --project ml traceaml-inspect-hi-small

data-prepare:
	uv run --project ml traceaml-prepare-hi-small

data-features:
	uv run --project ml traceaml-build-features

data-train:
	uv run --project ml traceaml-train-baselines

data-train-graph: graph-features
	uv run --project ml traceaml-train-baselines --graph-features $(GRAPH_FEATURES_OUT) --output-dir $(GRAPH_ABLATION_DIR)

data-publish:
	uv run --project ml traceaml-publish-inference-scores

# ---------------------------------------------------------------------------
# Graph
# ---------------------------------------------------------------------------

graph-load:
	uv run --project graph traceaml-load-graph --parquet $(PARQUET) --graph-name $(GRAPH_NAME) $(LIMIT_ARG)

graph-load-dry:
	uv run --project graph traceaml-load-graph --parquet $(PARQUET) --graph-name $(GRAPH_NAME) $(LIMIT_ARG) --dry-run

graph-features:
	uv run --project graph traceaml-build-graph-features-batch --parquet $(PARQUET) --features-out $(GRAPH_FEATURES_OUT) --manifest-out $(GRAPH_FEATURES_MANIFEST) $(LIMIT_ARG)

graph-features-falkordb:
	uv run --project graph traceaml-build-graph-features --parquet $(PARQUET) --features-out $(GRAPH_FEATURES_FALKORDB_OUT) --manifest-out $(GRAPH_FEATURES_FALKORDB_MANIFEST) --feature-graph $(FEATURE_GRAPH) $(LIMIT_ARG)

graph-synth:
	uv run --project graph traceaml-synth-transactions --out $(SYNTH_PARQUET) --rows 5078345 --days 18

# ---------------------------------------------------------------------------
# Quality
# ---------------------------------------------------------------------------

test: test-ml test-graph test-api

test-ml:
	uv run --directory ml pytest -q

test-graph:
	uv run --directory graph pytest -q

test-api:
	uv run --directory services/api pytest -q

lint: lint-web lint-py

lint-web:
	pnpm lint

lint-py:
	uv run --directory ml ruff check .
	uv run --directory graph ruff check .
	uv run --directory services/api ruff check .

build:
	pnpm build

check: lint test build
