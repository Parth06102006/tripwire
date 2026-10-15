# TraceAML ML (`ml`)

uv-managed offline evaluation project. Python >= 3.12.

## Setup

Run these commands from the repository root:

```sh
uv sync --project ml
```

## CSV profiler (read-only)

Profiles a user-supplied local CSV. Never modifies, copies, or downloads data.

```sh
uv run --project ml traceaml-profile-csv /path/to/file.csv
uv run --project ml traceaml-profile-csv /path/to/file.csv --sample-rows 3
```

Output is JSON: row/column counts, column names, dtypes, null counts, and a
small sample. Missing paths exit with code 2.
