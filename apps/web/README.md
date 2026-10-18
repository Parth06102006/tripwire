# Tripwire workbench

The analyst UI for Tripwire: an alert queue, a graph investigation screen and a performance screen, all reading the FastAPI service. Architecture and screen behaviour are described in [`docs/architecture.md`](../../docs/architecture.md#analyst-workbench); the decision record is ADR-022 in [`docs/decisions.md`](../../docs/decisions.md).

## Run it

Requirements: Node.js 20.9 or newer and pnpm. The API and FalkorDB must be running for data to appear (see the root README).

```bash
pnpm install            # from the repository root
pnpm --dir apps/web dev # http://localhost:3000
```

| Variable                       | Where  | Default                 | Purpose                                              |
| ------------------------------ | ------ | ----------------------- | ---------------------------------------------------- |
| `TRACEAML_API_ORIGIN`          | server | `http://127.0.0.1:8000` | Where Next.js forwards same-origin `/api/*` requests |
| `NEXT_PUBLIC_GRAPH_NODE_LIMIT` | build  | `600`                   | Nodes the canvas renders before asking first         |

The API decides which graph and score artifact are used (`TRACEAML_GRAPH_NAME`, `TRACEAML_SCORE_ARTIFACT`). A scored alert that is not in the loaded graph opens with a "not in the loaded graph" message.

## Scripts

| Command                                  | What it runs                                                    |
| ---------------------------------------- | --------------------------------------------------------------- |
| `pnpm dev` / `pnpm build` / `pnpm start` | Next.js development server, production build, production server |
| `pnpm lint`                              | ESLint (Next.js core web vitals and TypeScript rules)           |
| `pnpm typecheck`                         | `tsc --noEmit` in strict mode                                   |
| `pnpm format` / `pnpm format:check`      | Prettier with the Tailwind class sorter                         |
| `pnpm test`                              | Vitest unit and component tests (jsdom, no network)             |
| `pnpm test:e2e`                          | Playwright smoke tests against a live stack                     |

End-to-end tests drive real responses and write cases, so run them against an API whose `TRACEAML_CASE_DB_PATH` points at a scratch file. They start `pnpm start` on port 3100 (`E2E_PORT`) unless `E2E_BASE_URL` is set, and use the first queued alert unless `E2E_TRANSACTION_ID` names one in the loaded graph. Install the browser once with `pnpm exec playwright install chromium`.

## Layout

```text
src/app/                    Routes: / (landing), /overview, /investigation, /investigation/[id], /performance
src/components/landing/     The public landing page; shares the theme tokens with the workbench
src/components/layout/      Shell, navigation, service indicator, page header
src/components/overview/    Alert queue, counts, service status, lookup
src/components/agent/       The agent review screen
  agent-review.tsx          Two panes: conversation and growing graph
  transcript.tsx            Request, routing, agent rounds, tool calls, verdict
  tool-call-card.tsx        One graph tool call: purpose, status, Cypher, graph additions
  cypher-block.tsx          Cypher highlighting, parameters, rows, timing
  verdict-card.tsx          Decision, risk level, reasoning, hypothesis
  escalation-chain.tsx      The chain with the path this transaction took
  composer.tsx              Bounds, agent toggle, start and stop
src/components/investigation/
  graph/                    React Flow canvas, custom nodes and edge
  selection-detail.tsx      Floating inspector
  evidence-panel.tsx        Returned paths and transactions
  case-panel.tsx            Case state and gated or analyst actions
src/components/performance/ ECharts wrapper and benchmark panels
src/hooks/use-agent-review.ts  Stream, paced display, start and stop
src/lib/agent/              SSE client and the review session reducer
src/lib/api-schemas.ts      Zod mirror of the Pydantic contracts
src/lib/api-client.ts       Typed fetch client and error wording
src/lib/graph/              Graph model, deterministic layout, React Flow mapping
```

## Sign-in

Better Auth (`src/lib/auth/`) signs users in with Google and GitHub. `src/proxy.ts` redirects visitors without a session cookie, the workbench layout validates the session, and the browser asks `/api/auth/token` for a 15 minute token that `authorizedFetch` adds to every API call. The landing page and `/login` are public.

| Variable                                                                               | Notes                                                                                                                                                           |
| -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AUTH_MODE`                                                                            | `oauth` (default), `dev` (adds an email and password form) or `off`. `dev` and `off` are refused in production                                                  |
| `BETTER_AUTH_URL`                                                                      | The public base URL. Becomes the token issuer and audience, so the API's `TRACEAML_AUTH_ISSUER` and `TRACEAML_AUTH_AUDIENCE` must equal it. https in production |
| `BETTER_AUTH_SECRET`                                                                   | 32 characters or more                                                                                                                                           |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` | A provider is enabled when both of its values are set                                                                                                           |
| `AUTH_ALLOWED_EMAILS`                                                                  | Comma separated addresses and `@domain` entries. `*` lets anyone with a verified email in (a public demo). Empty allows nobody                                  |
| `AUTH_DB_PATH`                                                                         | The sign-in SQLite file. Default `data/auth/auth.db`                                                                                                            |

Local development needs no credentials: put `AUTH_MODE=off` in `apps/web/.env.local` and set `TRACEAML_AUTH_MODE=off` for the API. To try the whole flow locally, run the web app with `AUTH_MODE=dev`, a secret, `AUTH_ALLOWED_EMAILS`, `BETTER_AUTH_URL` set to its own address, and the API with `TRACEAML_AUTH_MODE=jwt`, `TRACEAML_AUTH_JWKS_URL=<web>/api/auth/jwks` and the same issuer and audience.

The end-to-end tests run with `AUTH_MODE=off` and an API started with `TRACEAML_AUTH_MODE=off`.

## Sticky teaser scroll

`src/components/ui/sticky-teaser-scroll.tsx` is a reusable split-screen section: teasers scroll on one side while one panel stays pinned on the other and swaps to the active teaser. A panel is either a static `image` or a `visual`, any node. The landing page uses it for "How it works" (`src/components/landing/how-it-works.tsx`) with the four interactive stages from `src/components/landing/how-it-works-stages.tsx`; `/demo/sticky-teaser` shows it with picsum photos (`?side=left`, `?scrubbed=1`).

It is data-driven: pass `items` (`id`, `title`, `description`, and an `image` or a `visual`, plus optionally `eyebrow`, `href`, `linkLabel`) and nothing else changes when items are added or removed. Pass a stable array, such as a module constant, so the observer is not rebuilt on every render. Below 992px the panel is rendered again above the teaser text, and `display: none` keeps the hidden copy out of the tab order.

| To change                      | Do this                                                                                                                        |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| Swap timing or easing          | Edit `SWAP_DURATION` and `EASE` at the top of the component.                                                                   |
| Where a teaser becomes active  | Set `activeOffset` (0 is the top of the viewport, 0.5 the middle, 1 the bottom). The default is 0.5.                           |
| Panel shape                    | Set `aspectClassName`, for example `aspect-square` or `aspect-[3/4]`. The default is `aspect-[4/5]`.                           |
| Frame above the text on phones | Set `mobileAspectClassName`. It takes any Tailwind class, such as `aspect-[4/5] min-h-[30rem]`. The default is `aspect-[4/3]`. |
| Pin below a fixed header       | Set `stickyTop` in pixels. The landing page passes the 72px header height.                                                     |
| Scroll-scrubbed crossfade      | Set `scrubbed`. Opacity and scale then follow each teaser's own scroll progress instead of swapping on the active index.       |
| Panel side                     | Set `imageSide` to `"left"` or `"right"`.                                                                                      |

Pinning needs the page to be the scroll container, so no ancestor may set `overflow: hidden`, `auto` or `scroll`. Use `overflow-x: clip` to stop sideways scroll. Below 992px the pinning is off and each teaser shows its own panel above its text.

Steps that demonstrate a behaviour are stages, not pictures. Each stage has one idea and one control, states its own limitation ("illustrative", "simulated", "no path here"), and a hint line that answers what the visitor just did. Keep the panel legible at the pinned width: mono micro-labels, 13px body text and a dot matrix background, with the status in the header chip.

## Dependencies

| Package                                                             | Why it is here                                                                                 |
| ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `next` 16.4, `react` 19.3                                           | App Router; Server Components for static layout, client components for interactive parts       |
| `@xyflow/react` 12                                                  | Investigation graph: custom nodes and edges, pan, zoom, selection                              |
| `@dagrejs/dagre`                                                    | Deterministic left-to-right layout for the graph                                               |
| `echarts`, `echarts-for-react`                                      | Benchmark charts; only bar, line, grid, tooltip, legend and aria modules are registered        |
| `@tanstack/react-query`                                             | Server state, caching, retries for network failures and 503s only                              |
| `@tanstack/react-table` 8                                           | Sortable, filterable alert queue. Version 8 is pinned: version 9 (August 2026) rewrote the API |
| `zod`                                                               | Runtime validation of every API response and of form input                                     |
| `react-hook-form`, `@hookform/resolvers`                            | Case open, confirm and dismiss forms                                                           |
| `radix-ui`, `class-variance-authority`, `clsx`, `tailwind-merge`    | Accessible dialog, tabs and tooltip primitives in the shadcn pattern                           |
| `motion`                                                            | Timeline and banner transitions; respects reduced motion                                       |
| `sonner`                                                            | Toasts, always alongside the persisted state shown in the page                                 |
| `lucide-react`                                                      | Icons                                                                                          |
| `@fontsource-variable/inter`, `@fontsource-variable/jetbrains-mono` | Self-hosted fonts so builds never fetch from a CDN; the mono face is used only for identifiers |
| `tailwindcss` 4                                                     | Styling and design tokens                                                                      |
| `vitest`, Testing Library, `jsdom`, `@playwright/test`              | Unit, component and end-to-end tests                                                           |

TypeScript is pinned to 5.9: the 7.x package is the native compiler port, and the Next.js build type-checks through the JavaScript compiler API. TanStack Virtual is not used; the queue is paged by the API and investigation lists are bounded.

## Graph rendering, measured

Production build, Chromium through Playwright on the development machine (i5-13400F), against the `agentbench-demo` graph, streaming the deterministic agent. Long tasks are main-thread tasks over 50 ms; each figure covers a whole review from clicking Start to the verdict.

| Workload                                                                                   | Result                                                                      |
| ------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------- |
| `hi8-tx-04564447`, default bounds: 5 tool calls, 49 nodes, 76 edges                        | No long task                                                                |
| Same alert reviewed again at 3 hops, 30 days, limit 100: merged to 254 nodes and 284 edges | Two long tasks, 145 and 57 ms, from laying out and mounting the large batch |
| Selecting a node afterwards                                                                | No long task                                                                |
| 30 wheel zoom steps                                                                        | No long task                                                                |

Each tool result is laid out once, when it arrives, in the session reducer; earlier positions are kept, so a review costs one dagre layout per result rather than one per render. Selection emphasis is a generated stylesheet keyed on the `data-id` React Flow puts on each node and edge, so nodes and unlabelled edges keep their identity. A review takes about 5.5 seconds to display because events are paced for readability; the stream itself completes in tens of milliseconds for the deterministic agent. Moving the layout to a web worker would remove the remaining cost if larger graphs need it.

## Backend requirements still open

- **Live Gemini run.** The streamed agent path (purposes, rounds, risk level, reasoning) is tested with a scripted model only. Set `LLM_API_KEY` on the API host to run it.
- **Case lookup by transaction.** `GET /api/cases` has no `transaction_id` filter. The UI pages through at most 1,000 cases and says when the scan was partial.
- **Single alert lookup.** There is no `GET /api/alerts/{transaction_id}`, so an investigation shows the score only once its response arrives.
- **Precision-recall curve points.** `/api/benchmarks` serves aggregate metrics only, so no curve is drawn.
