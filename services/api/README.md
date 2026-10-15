# TraceAML API (`services/api`)

uv-managed FastAPI service. Python >= 3.12.

## Setup

Run these commands from the repository root:

```sh
uv sync --project services/api
uv run --project services/api fastapi dev services/api/src/api/app.py
```

Dev tools are in the `dev` group:

```sh
uv sync --project services/api --group dev
uv run --project services/api --group dev ruff check services/api/src
```

## Health

`GET /api/health` returns:

```json
{ "status": "ok", "falkordb": "available", "version": "0.1.0" }
```

`falkordb` is one of `available`, `unavailable`, `not_configured`.
Configure with `TRACEAML_FALKORDB_HOST` (unset means `not_configured`).
Responses never include hosts, ports, credentials, or dataset labels.
