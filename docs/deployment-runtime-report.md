# Deployment runtime report (draft)

Status: **draft for review, 2026-10-18.** Every figure is tagged:

- **recorded**: taken from a benchmark or doc already in the repository (source named).
- **read**: read from code or config in this checkout.
- **estimated**: reasoned from the above, not measured.
- **to measure**: needs the live stack; nothing was started to write this draft.

Nothing here comes from the production host. The recorded benchmarks ran on an Intel i5-13400F desktop (10 cores, 15.8 GiB) under Docker Desktop, so treat them as a floor for tuning and not as a service-level promise. Companion guide: `docs/deployment.md` (step by step). This report adds the per-component runtime needs, the full variable list, and what to optimise.

## 1. Verdict and blockers

**Not deployable today.** The code and deploy files are ready; the data and one config choice are not.

| # | Blocker | Why it blocks | Fix |
| --- | --- | --- | --- |
| 1 | `data/processed/hi-small-v8/transactions.parquet` is missing | The release bundle builds the graph loader's input from it (`deploy/scripts/make_release_bundle.py`) | Re-run `make data-prepare` on the restored `data/raw/hi-small/` files. This is a pipeline rerun: it needs your go-ahead |
| 2 | `artifacts/runs/hi-small-v8/` holds only the rescued `inference_scores.parquet` and a recreated `baseline_config.json` | The bundle script requires `baselines/baseline_metrics.json`, which is gone | Either regenerate the baselines (rerun) or change the bundle script to stop requiring it (the API no longer reads it by default) |
| 3 | `deploy/.env.production.example` sets `Tripwire_BASELINE_METRICS_PATH` and `Tripwire_GRAPH_METRICS_PATH` to Iteration 1 files | These override the new default, so the Performance page would show the old numbers again | Delete both lines from the template |
| 4 | The queue is scored by the Iteration 1 file, the Performance page shows Iteration 2 (C1) | The two describe different models. The Iteration 2 `inference_scores.parquet` no longer exists | Retrain C1 (a rerun), or accept and label the mismatch |
| 5 | `Tripwire_BLOCK_THRESHOLD=0.999` is a placeholder | It decides which alerts show as "Blocked by rule" (42 of 761,639 at this value, recorded in the API response) | Choose it from validation precision, or blank it to disable the rule |

Not blockers but decide before go-live: the open FalkorDB (no password) and the single-instance SQLite case store. Sign-in and the 10 an hour, 20 a day limit are now in place (ADR-027); you must create the OAuth clients and the access list.

## 2. Components at a glance

```text
Internet -443-> Caddy -> web (Next.js, :3000) -/api-> api (FastAPI, :8000) -> falkordb (:6379)
                                                          |
                                                          +-> SQLite case store (volume)
                                                          +-> Gemini API (optional, outbound)
```

| Component | Runtime | Port | RAM | CPU | Disk | State | Scale limit |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **Caddy** | `caddy:2.10.2-alpine` | 80, 443 (only public ports) | tens of MiB (estimated) | negligible | certificates, a few MB (`caddy-data`) | TLS certificates | not a limit |
| **web** | Node 24, Next.js 16.4.2 standalone | 3000 (private) | 150 to 300 MiB (estimated) | low; renders static pages, proxies `/api` | image about 250 MB, `.next/static` 2.4 MB (read) | none | stateless, scales horizontally |
| **api** | Python 3.12, FastAPI, uvicorn, one process | 8000 (private) | **535 MiB** with a 1M-transaction graph (recorded, `iteration-2-performance.md`); **about 290 MB more for the score tables is estimated**, see below | 1 core saturates near 440 `GET /api/alerts` per second and about 32 investigations per second (recorded) | image 300 to 500 MB (estimated); artifacts 13 MB | reads artifacts, writes the case store | one process unless `--workers` is added; **one API instance only while cases are SQLite** |
| **falkordb** | `falkordb-server` pinned by digest, module 4.22.1 | 6379 (private) | **2.5 GiB for the full graph, 4.13 GiB peak during the load** (recorded, `iteration-2-graph-performance.md`) | 16 query threads configured, queue 25 (recorded) | RDB snapshot about 0.7 GB (recorded in `docs/deployment.md`) | the graph (rebuildable) | single node, no replica |
| **graph-loader** | the API image, profile `tools` | none | peaked 4.13 GiB on the server during load | one stream, about 9.7k rows/s at full scale (recorded) | reads a 155 MB parquet | none | run once per data release |
| **case store** | SQLite file in the `cases` volume | none | none | none | KB to MB | **analyst decisions (cannot be rebuilt)** | single writer on block storage |
| **Gemini** | external HTTPS call, optional | outbound 443 | none | none | none | none | quota of the key |

Per-component notes follow.

### 2.1 api

- **Startup.** On first request it loads `inference_scores.parquet` into three structures: a score dict, a timestamp dict, a sorted list of 761,639 `(id, (score, timestamp))` pairs, plus a negated-score list used for the filter bisection (`services/api/src/api/scores.py`, read). Python objects cost far more than the 12.3 MB file: **about 290 MB is estimated** for the 761,639 rows; to measure.
- **Concurrency.** Default `CMD` runs one uvicorn process with no `--workers` (read, `services/api/Dockerfile`). With four workers the recorded throughput on this machine rose from about 32 to about 78 investigations per second at concurrency 1 and about 210 at concurrency 8 (recorded, capacity sweep). Four workers multiply the score tables in memory: **about 4 x (535 + 290) MiB is estimated**.
- **Graph access.** A pooled FalkorDB connection (`Tripwire_GRAPH_POOL_SIZE`, default 16) with a per-query timeout (default 5,000 ms, range 100 to 30,000). A graph outage turns into HTTP 503 for investigations and `graph_status: unknown` on the queue, never an empty queue (read).
- **Latency.** Recorded p50 and p95 on this machine: `GET /api/alerts?limit=50` 1.3 and 1.8 ms, `/api/benchmarks` 1.0 and 1.7 ms, `/api/cases` 3.7 and 6.6 ms, `POST /api/investigations` 11.0 and 13.7 ms, `/api/health` 6.0 and 22.7 ms (the health check touches the graph). Graph queries: `trace_funds` 5.7 and 6.2 ms, `inspect_counterparties` 1.6 and 2.3 ms, flow patterns about 1 to 2 ms. These are upper bounds: the host was not idle.
- **New filtered queue cost.** Date and text filters scan the matching score window in Python, so a text filter on an unfiltered queue walks up to 761,639 rows. Route and score filters are bisection and constant time. To measure: p95 for `q=` and `date_from=` on the full set. Expect tens of milliseconds, not the 1 ms of the plain queue (estimated).
- **Health check.** The compose check calls `/api/health` every 15 s, which queries FalkorDB. Cheap, but it is the slowest endpoint in the table above.

### 2.2 falkordb

- **Memory.** Graph 2,514 MB, about 500 bytes per transaction. Largest parts: transaction properties 1,175 MB, the two lookup indexes 734 MB, relation matrices 332 MB (recorded). Peak 4.13 GiB while loading. The compose limit is `FALKORDB_MEMORY_LIMIT=10g` (read).
- **Snapshot fork.** A background save forks the process; with copy-on-write the extra memory is small while the graph is idle and grows with writes. The graph is written once at load and then only read, so the fork cost is low after loading (estimated).
- **Startup.** A cold start reloads the roughly 0.7 GB RDB before answering. The compose health check allows 180 s (read). Actual time: to measure.
- **Queue limits.** `THREAD_COUNT=16`, `MAX_QUEUED_QUERIES=25`, server `TIMEOUT=1000` ms, `CACHE_SIZE=25` (recorded benchmark host settings). **Check whether the production container uses the same.** On a 2 vCPU host, 16 threads is more than the cores. The API gives up at 5 s regardless.
- **Security.** No password and no TLS; reachable only on the private Docker network (read, `docs/deployment.md`). The API and loader pass no password today.

### 2.3 web

- Next.js standalone server, `HOSTNAME=0.0.0.0`, `PORT=3000`, runs as uid 1001, health check fetches `/` every 30 s (read).
- The browser calls same-origin `/api`; the server forwards it to `Tripwire_API_ORIGIN`. That value is **baked in at build time** (`ARG Tripwire_API_ORIGIN`, default `http://api:8000`). A wrong value means rebuilding the image, not editing an env var.
- **The forward has a 30 s time limit.** Next.js uses `proxyTimeout || 30000` for rewrites (confirmed in `node_modules/next/dist/server/lib/router-utils/proxy-request.js`) and `next.config.ts` does not set it. The agent review is a server-sent stream through this path. A review with the Gemini agent can leave more than 30 s between events (30 s LLM timeout, up to 3 rounds). Whether it cuts an active stream: to measure. The Caddyfile already allows 5 minutes on the stream route, but Caddy forwards to web, not to the API, so that allowance does not reach the proxy hop. Fix in section 7.
- The landing page loads pictures and 4 SVGs from `/how-it-works/` (24 KB total, read). `/demo/sticky-teaser` ships in the build and loads images from picsum.photos; it is marked no-index but reachable.
- Build: Node 24, pnpm 12, about 7 to 12 s compile (observed in this session's builds); image build time: to measure.

### 2.4 caddy

- Terminates TLS (Let's Encrypt, needs port 80 reachable and `ACME_EMAIL`), adds HSTS, `nosniff`, `X-Frame-Options: DENY` and a referrer policy, compresses with zstd and gzip (read).
- Compose refuses to start without `Tripwire_DOMAIN` and `ACME_EMAIL` (read). Since ADR-027 Caddy no longer handles passwords; sign-in is in the web app, and Caddy sends `/api/*` straight to the API.
- The `$` characters in the bcrypt hash must be doubled (`$$`) in the env file.

### 2.5 case store

- SQLite file at `/app/data/cases/cases.db` (`Tripwire_CASE_DB_PATH`), created on first request, with an initialisation lock added during this work (read).
- **It is the only data you cannot rebuild.** Back it up with `deploy/scripts/backup-cases.sh` (SQLite online backup, safe while running).
- It must sit on local block storage. NFS, SMB and EFS break SQLite locking. More than one API instance needs PostgreSQL first (change in `api/database.py`).

### 2.6 Gemini (optional)

- Off unless `LLM_API_KEY` is set. With it on, each agent review makes up to `LLM_MAX_ROUNDS` (3) rounds of up to `LLM_MAX_TOOL_CALLS` (6) tool calls, each model call limited to `LLM_TIMEOUT_SECONDS` (30) and `LLM_MAX_OUTPUT_TOKENS` (1500) (read).
- Outbound HTTPS to Google is required. Retrieved synthetic evidence is sent to Google. No price is assumed; set `LLM_PRICE_*_PER_MTOK` to see cost.
- On failure or timeout the review falls back to the deterministic report, and a flagged transaction stays flagged for an operator (read, ADR-023). **Never run live against the real key before checking quota; the agent has not been exercised against Gemini in this project (no key was available).**

## 3. Environment variable reference

Read from `services/api/src/api/settings.py`, `deploy/compose.prod.yaml` and `deploy/.env.production.example`. Secret means it must not be committed or logged.

### 3.1 Compose and build

| Variable | Default | Used by | Notes |
| --- | --- | --- | --- |
| `Tripwire_DOMAIN` | none, required | caddy | Must resolve to the server before the certificate can be issued |
| `ACME_EMAIL` | none, required | caddy | Let's Encrypt notices |
| `GOOGLE_CLIENT_ID/SECRET`, `GITHUB_CLIENT_ID/SECRET` | none | web | **secret** (the two secrets). At least one provider |
| `BETTER_AUTH_SECRET` | none, required | web | **secret**, 32+ characters |
| `AUTH_ALLOWED_EMAILS` | none | web | Empty allows nobody |
| `Tripwire_INVESTIGATION_LIMIT_HOUR`, `_DAY` | 10, 20 | api | Per user, rolling |
| `Tripwire_AUTH_MODE`, `_JWKS_URL`, `_ISSUER`, `_AUDIENCE` | `jwt` | api | Set by compose; the API refuses to start without them |
| `HTTP_PORT`, `HTTPS_PORT` | 80, 443 | caddy | |
| `IMAGE_PREFIX`, `RELEASE` | `Tripwire`, `local` | compose | Image tags. Set `RELEASE` to a commit for rollbacks |
| `ARTIFACTS_DIR` | `/srv/Tripwire/artifacts` | api | Mounted read-only at `/app/artifacts` |
| `GRAPH_INPUT_DIR` | `/srv/Tripwire/graph-input` | api, loader | Loader input |
| `FALKORDB_MEMORY_LIMIT` | `10g` | falkordb | Container ceiling |
| `GRAPH_LOAD_MODE` | `create` | loader | `create` refuses a non-empty graph; `merge` is idempotent but slower |
| build arg `Tripwire_API_ORIGIN` | `http://api:8000` | web build | Baked into the image |

### 3.2 API

| Variable | Default | Notes |
| --- | --- | --- |
| `Tripwire_FALKORDB_HOST` | none | Set by compose to `falkordb`. Unset means investigations return 503 |
| `Tripwire_FALKORDB_PORT` | 6379 | |
| `Tripwire_GRAPH_NAME` | `Tripwire` | Must equal the graph the loader wrote |
| `Tripwire_GRAPH_QUERY_TIMEOUT_MS` | 5000 | 100 to 30,000 |
| `Tripwire_GRAPH_POOL_SIZE` | 16 | 1 to 128; raise with `--workers` |
| `Tripwire_SCORE_ARTIFACT` | `artifacts/runs/hi-small-v8/baselines/inference_scores.parquet` | **The template sets `artifacts/baselines/...`; the bundle script writes there. Both must agree** |
| `Tripwire_BASELINE_CONFIG_PATH` | `artifacts/runs/hi-small-v8/baselines/baseline_config.json` | Holds the review threshold (`thresholds.lgbm`). Without it `/api/alerts` returns 503 "decision threshold unavailable" (seen in this session) |
| `Tripwire_SCORE_MODEL` | `lgbm` | Which threshold key to read |
| `Tripwire_BASELINE_METRICS_PATH` | `docs/benchmarks/iteration-2-detection.json` | **Remove from the template** (blocker 3) |
| `Tripwire_GRAPH_METRICS_PATH` | unset | **Remove from the template.** Merges extra models if set |
| `Tripwire_PERFORMANCE_PATH` | `docs/benchmarks/iteration-2-performance.json` | Latency, capacity and cost snapshot. Copied into the API image |
| `Tripwire_BLOCK_THRESHOLD` | 0.999 | Placeholder; blank disables the hard-block rule |
| `Tripwire_CASE_DB_PATH` | `data/cases/cases.db` | Set to `/app/data/cases/cases.db` in compose |
| `Tripwire_AGENT_TOOL_TRANSPORT` | `mcp` | `mcp` routes agent tool calls through the MCP boundary; `direct` skips it |
| `Tripwire_REPOSITORY_ROOT` | derived | The image sets `/app` |
| `LLM_PROVIDER` | `none` | `gemini` to enable |
| `LLM_API_KEY` | none | **secret**. Also accepted: `GEMINI_API_KEY`, `GOOGLE_API_KEY` |
| `LLM_MODEL` | `gemini-flash-latest` | |
| `LLM_TIMEOUT_SECONDS` | 30 | 1 to 120 |
| `LLM_MAX_TOOL_CALLS`, `LLM_MAX_ROUNDS` | 6, 3 | |
| `LLM_MAX_OUTPUT_TOKENS` | 1500 | 200 to 8000 |
| `LLM_PRICE_INPUT_PER_MTOK`, `LLM_PRICE_OUTPUT_PER_MTOK` | unset | Cost reporting only |

### 3.3 Web

| Variable | Default | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_API_DOCS_URL` | unset | Footer "API Docs" link; hidden when unset in production |
| `NODE_ENV`, `NEXT_TELEMETRY_DISABLED`, `HOSTNAME`, `PORT` | set in the image | |

## 4. Data inventory

| Item | Size | Ships to server | Origin | Status today |
| --- | --- | --- | --- | --- |
| `graph-input/graph-transactions.parquet` | 154.9 MB, 5,078,345 rows, 14 columns (recorded, `docs/deployment.md`) | yes | bundle script, from `transactions.parquet` | **cannot build: processed parquet missing** |
| `artifacts/baselines/inference_scores.parquet` | 12.3 MB, 761,639 rows (read; rescued) | yes | model scoring | rescued copy exists |
| `artifacts/baselines/baseline_config.json` | under 1 KB | yes | training | recreated with the validation threshold only |
| `docs/benchmarks/iteration-2-detection.json`, `iteration-2-performance.json` | small | in the API image | committed | present |
| FalkorDB graph `Tripwire` | 2.5 GiB in memory, 0.7 GB on disk | built on the server | loader | the old volume `tripwire_falkordb-data` may still hold it (Docker is stopped) |
| `data/raw/hi-small/` | 454 MB + 33 MB | **never** | IBM AMLworld | restored in this worktree |
| `transactions.parquet` with `target_is_laundering` and `split` | 280 MB (recorded) | **never** | prepare step | missing |
| `test_scores.parquet`, `models/` | | **never** | training | missing |

The bundle script refuses any column or key that looks like a label, split or typology, so evaluation data cannot ride along by accident.

## 5. Sizing

Sum for one server, all components, steady state:

| Item | RAM (GiB) |
| --- | --- |
| FalkorDB graph | 2.5 (recorded) |
| FalkorDB during a load | 4.13 peak (recorded) |
| API, one worker | about 0.8 (535 MiB recorded plus about 290 MB estimated) |
| API, four workers | about 3.3 (estimated) |
| web | 0.3 (estimated) |
| Caddy | 0.1 (estimated) |
| OS, Docker, page cache for the RDB | 1 to 2 (estimated) |

- **Minimum:** 8 GiB (steady state about 4 GiB; a reload while serving needs the headroom). **Recommended:** 16 GiB, 2 to 4 vCPU, 40 GiB gp3 disk, x86_64 (the pinned FalkorDB digest is the amd64 build).
- Instance: `r7i.large` (2 vCPU, 16 GiB) or `m7i.xlarge`. `t3.large` (8 GiB) works for a demo but burstable CPU throttles under sustained load.
- With 2 vCPU, run the API with 2 workers at most, and set FalkorDB `THREAD_COUNT` to 2 to 4 (estimated; to measure).
- Disk: images about 1.5 GB, RDB 0.7 GB, bundle 166 MB, backups, logs (capped at 5 x 20 MB per container by the bootstrap script), plus swap 4 GiB.

## 6. Capacity and latency

Recorded (`docs/benchmarks/iteration-2-performance.json`, measured 2026-10-16 on the desktop host, loopback, closed loop, host not idle so these are upper bounds on latency and lower bounds on throughput):

| Endpoint | 1 worker, best | 4 workers, best |
| --- | --- | --- |
| `GET /api/alerts?limit=50` | 757 req/s at 2 clients, then falls to about 400 | about 436 req/s at 4 clients |
| `POST /api/investigations` | about 56 req/s (knee near 2 clients) | about 210 req/s at 8 clients |
| P95 latency at 32 clients | about 580 ms (alerts), about 800 ms (investigations) | about 330 ms, about 740 ms |

- No errors up to 32 clients on either setup (recorded).
- Single-worker alert throughput peaks at 2 clients and then drops: the uvicorn process is the bottleneck, not FalkorDB.
- Model scoring is not on the request path: the queue serves precomputed scores. Scoring 1,000 rows costs about 0.013 CPU-seconds (recorded).
- Compute cost at list prices is negligible (about $1.3e-7 per investigation, recorded). The server is the cost, not the requests.
- **Not measured at all:** the new filtered queue, the stream through Next.js and Caddy, the landing page, and any run on Linux or a 2 vCPU host.

## 7. Optimisations, ranked

| # | Change | Why | Effort | Evidence |
| --- | --- | --- | --- | --- |
| 1 | Route `/api/*` in Caddy straight to `api:8000` | Removes the 30 s Next.js proxy limit on the review stream and one network hop for every API call | small (Caddyfile) | proxy default confirmed in code; effect to measure |
| 2 | Remove the stale metrics paths from `.env.production.example` and the bundle script's `baseline_metrics.json` requirement | The Performance page would otherwise show the wrong model | small | read |
| 3 | Store the score tables as arrays, not dicts and tuples | About 290 MB falls to about 20 MB (761,639 float64 scores, an integer index and a string table), and startup is faster; matters most with several workers | medium (`scores.py`) | estimate; to measure |
| 4 | Run the API with 2 workers on a 2 vCPU host | Single worker is the bottleneck above 2 clients | small (`--workers 2`, pool size) | recorded |
| 5 | Set FalkorDB `THREAD_COUNT` to the core count and `maxmemory` below the container limit | 16 threads on 2 vCPU only adds contention; a hard ceiling gives a clear error instead of an OOM kill | small | recorded config, to measure |
| 6 | Cache `/api/health` for a few seconds | Slowest endpoint (p95 22.7 ms) and polled by the UI, the compose check and every footer view | small | recorded |
| 7 | Long cache headers on `/_next/static/*` and `/how-it-works/*`, and gzip already on at Caddy | Static assets are 2.4 MB plus 24 KB; repeat visits should cost nothing | small (Caddyfile) | read |
| 8 | Switch the case store to SQLite WAL mode | Readers stop blocking the writer; no code path needs more than one API process until PostgreSQL | small | estimate |
| 9 | Disable `/demo/sticky-teaser` in production | It pulls third-party images (picsum.photos) and is not part of the product | small | read |
| 10 | Build images in CI and pull from a registry | Server builds take minutes and need build tools on the host; rollbacks need tagged images | medium | `docs/deployment.md` 4.11 |
| 11 | Add a FalkorDB password and TLS | The graph is open to anything on the Docker network | medium (code in the API and loader) | read |
| 12 | Move the case store to PostgreSQL | Needed for more than one API instance or a rolling deploy | medium | read |

## 8. Risks to accept or fix

- **Login.** Google and GitHub through Better Auth with an access list. The reviewer ID on a case is still whatever the analyst types, not the logged-in user.
- **Single points of failure.** One server, one FalkorDB, one SQLite file. Back up cases daily and snapshot the disk.
- **Placeholder block threshold** (blocker 5). Decisions are simulated: nothing blocks a payment.
- **Gemini untested live.** Run one review with the real key on staging first.
- **Data loss earlier in this project.** Worktree cleanup emptied `data/` and `artifacts/` in the main checkout. Keep an off-machine copy of the raw dataset and of the release bundle once it exists.

## 9. Pre-flight and post-deploy checklist

Before deploying:

- [ ] Processed parquet rebuilt (blocker 1) and the release bundle built; `sha256sum -c SHA256SUMS` passes on the server.
- [ ] Decide blockers 2, 4 and 5; env template cleaned (blocker 3).
- [ ] DNS `A` record points at the server; ports 80 and 443 open; no port 22 (use Session Manager).
- [ ] `Tripwire_DOMAIN`, `ACME_EMAIL`, an OAuth client and its callback URL, `BETTER_AUTH_SECRET` and `AUTH_ALLOWED_EMAILS` set; `LLM_API_KEY` from the secret store, or empty.
- [ ] Kernel settings applied by `bootstrap-ubuntu.sh` (`vm.overcommit_memory=1`, transparent huge pages off) and swap present.

After deploying:

- [ ] `docker compose ... ps`: falkordb, api and web healthy, caddy up.
- [ ] Loader `reconciliation`: 5,078,345 transactions, 5,078,345 sent and received edges, 515,088 accounts.
- [ ] `/` returns 401 without credentials; `/api/health` shows FalkorDB `available`.
- [ ] `/api/alerts?limit=5`: every item `graph_status: "available"`.
- [ ] `/api/benchmarks` lists `iteration1_lgbm`, `c3`, `c2`, `c1`.
- [ ] A streamed review finishes through the public URL, including one longer than 30 s.
- [ ] A case can be opened and dismissed; the backup job produces a file.

## 10. What happens next

This draft uses recorded and read figures only. After you have read it, the next step is one measurement pass (start Docker, load the existing graph volume, probe the API, web and stream, record image sizes and restart time) and the small deploy fixes in section 7 rows 1, 2, 7 and 9. Rebuilding the data and retraining are separate, and I will not start them without your go-ahead.
