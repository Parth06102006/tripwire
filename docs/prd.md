# Tripwire: Product Requirements Document (PRD)

- **Version:** 1.0
- **Status:** Hackathon implementation baseline
- **Product:** Tripwire
- **Category:** Graph-native fraud investigation and AML intelligence
- **Primary audience:** Fraud analysts at fintechs, payment platforms, and exchanges
- **Hackathon window:** 15-18 October 2026
- **Primary differentiator:** FalkorDB-powered graph evidence that exposes suspicious transaction structures and makes each investigation inspectable.

---

## 1. Executive summary

Tripwire is a graph-native fraud investigation platform that helps an analyst detect suspicious transaction networks, understand why a transaction was flagged, and reuse confirmed case knowledge in future investigations.

Traditional transaction review often evaluates an account or transfer with limited local context. Tripwire uses FalkorDB to retrieve bounded, multi-hop transaction neighbourhoods and calculate structural evidence such as fan-in, fan-out, cycles, and scatter-gather patterns. A detection pipeline combines transaction features, graph-derived features, a conventional classifier, and optionally a typed LLM assessment. A deterministic policy layer converts validated scores and policy rules into `allow`, `review`, or simulated `block` actions.

Tripwire is not a production financial enforcement system. It is a reproducible hackathon prototype built around a public synthetic AML dataset. It must demonstrate graph-dependent insight, measure whether graph features improve held-out detection performance, and show how analyst-confirmed cases can inform later investigations without contaminating evaluation data.

### Product thesis

> A transaction that looks ordinary in isolation may become suspicious when its surrounding money-flow network is examined. Tripwire finds the relevant structure, presents the actual evidence path, and measures whether that context improves detection.

### Product principles

1. **Graph-first, not graph-decorated:** FalkorDB must perform essential detection and investigation work.
2. **Evidence over generated prose:** explain decisions using actual graph paths, records, and computed features.
3. **Measure before claiming:** no invented metrics, unverified fraud-reduction claims, or unsupported probability claims.
4. **Human-verifiable actions:** actions are simulated and auditable; confirmed case memory requires explicit review.
5. **Bounded and reproducible:** deterministic replay, bounded queries, fixed evaluation splits, and documented model versions.
6. **Hackathon scope discipline:** deliver one complete workflow before adding advanced ML or infrastructure.

---

## 2. Problem statement

Fraud analysts need to investigate suspicious transfers quickly while reducing false positives and understanding relationships that span multiple accounts and transactions. Rules and per-account history can miss combinations of individually ordinary events that form a suspicious flow structure.

Tripwire addresses four related problems:

- **Fragmented context:** a transfer is difficult to evaluate without seeing related senders, receivers, paths, and transaction timing.
- **Weak explanations:** a single risk score does not show the analyst what evidence drove the result.
- **Late or incomplete labels:** labelled fraud data is limited, and confirmed cases may become useful context for later investigations.
- **Unproven graph value:** graph visualizations are not sufficient; the system must measure whether graph-derived evidence improves detection relative to simpler baselines.

### Target user

A fraud or AML analyst who reviews transaction alerts, investigates linked accounts, decides whether to escalate a case, and needs evidence that can be inspected and audited.

### Jobs to be done

- When a transfer is selected for review, show the relevant surrounding money-flow structure.
- When a risk decision is made, show the exact paths and graph-derived signals supporting it.
- When a case is confirmed, preserve its provenance and make it retrievable in later investigations.
- When comparing detection approaches, show reproducible performance, latency, and cost metrics.

---

## 3. Goals and non-goals

### Goals

- Make FalkorDB essential to the primary investigation workflow.
- Ingest and replay the IBM AMLworld HI-Small dataset.
- Detect or characterize graph patterns including fan-in, fan-out, cycles, scatter-gather, gather-scatter, bipartite structures, and stack-like flows where supported by the dataset.
- Provide a working review queue and graph investigation workspace.
- Compare rules-only, sequence/tabular-only, graph-feature, and graph-plus-model approaches.
- Prevent target-label leakage and evaluate on held-out data.
- Provide auditable simulated actions and analyst-confirmed case memory.
- Deliver a polished web application and a concise, reproducible demo.
- Support entry into both the graph-agent track and the graph-memory track, where permitted by the event rules.

### Non-goals for the hackathon

- Real-money transaction blocking, account freezing, or financial institution integrations.
- Production-grade regulatory reporting or automatic filing of SARs.
- Real-world identity resolution using actual card, IP, or device data.
- Claiming production fraud reduction from results on synthetic data.
- Distributed streaming infrastructure such as Kafka, RabbitMQ, or Redis.
- Kubernetes, a complex multi-agent framework, or a separate vector database.
- Training a new graph neural network or Graph-JEPA model before the core system is complete.
- Building a general-purpose fraud platform for every asset class or jurisdiction.

---

## 4. Success criteria

Success is defined by product completeness, graph necessity, evaluation integrity, and demo clarity, not by a preselected score.

### Product acceptance criteria

- A fresh setup can start the application and graph database using documented steps.
- Dataset ingestion is repeatable and does not create duplicate transaction nodes.
- A transaction can be selected from the queue and investigated end to end.
- The backend returns real graph evidence from FalkorDB.
- The UI highlights the exact backend-returned path.
- The decision record includes the evidence, policy outcome, model/provider metadata, and latency.
- Model-provider failure does not break the graph investigation.
- Confirmed cases can be retrieved during later investigations.
- Benchmark results can be reproduced from documented code and data splits.
- The README documents the graph schema, key Cypher queries, setup, evaluation, limitations, and AI-assistance disclosure.

### Evaluation success criteria

- All baselines are evaluated on the same candidate population wherever the comparison requires it.
- The evaluation set is isolated from feature engineering, threshold selection, calibration, and case-memory writes.
- Metrics include precision, recall, F1, PR-AUC where appropriate, false-positive rate, value-weighted recall, latency, and cost.
- Results are broken down by laundering typology when labels support the breakdown.
- A graph ablation tests the incremental value of graph-derived features.
- Every displayed benchmark number is produced by a real run and identified as synthetic-dataset performance.

No specific F1 improvement, latency target, or fraud reduction is guaranteed in advance. The team will choose and report the best defensible operating point after validation.

---

## 5. Dataset and data integrity

### Primary dataset

**IBM AMLworld HI-Small**, a synthetic bank-transfer dataset with transaction and laundering-pattern labels.

The data is suitable for reproducible experimentation and clear visual demonstrations. It is synthetic; performance must not be represented as verified real-world fraud performance.

### Optional secondary dataset

Elliptic++ may be used for a small, separately evaluated credibility experiment if time allows. Elliptic2 is stretch-only due to its scale and setup burden. Neither is allowed to delay the primary workflow.

### Dataset schema assumptions

The primary graph should represent accounts and transfers. Do not assume AMLworld contains device fingerprints, IP addresses, cards, or destination-wallet identity links. Any such entities must be part of a clearly labelled, separately evaluated synthetic extension.

### Label separation

- Ground-truth laundering labels and typology labels are evaluation-only.
- Labels must not be exposed as features or returned by inference-time graph queries.
- Do not place target labels on graph nodes used by the detector.
- Maintain a clear separation between inference data and evaluation labels.
- The UI may reveal ground truth in a benchmark/evaluation view, not in the decision inputs used during replay.

### Data ingestion requirements

- Parse and validate source records.
- Normalize identifiers and timestamps consistently.
- Preserve original amount and currency.
- Avoid aggregating across currencies without explicit conversion data.
- Use stable identifiers and idempotent writes.
- Record import counts, rejected records, and errors.
- Support deterministic replay reset.
- Include a small seed/sample dataset for fast local smoke tests where redistribution rules permit.

---

## 6. Product experience and information architecture

The application is desktop-first and designed for an analyst workstation. The main navigation has six destinations.

### 6.1 Overview (`/`)

**Purpose:** Summarize current replay and investigation activity.

**Content:**
- Total transactions processed.
- Candidate transactions sent to investigation.
- Counts of allow, review, and simulated block outcomes.
- Pending and confirmed cases.
- Transaction volume and decision trend.
- Recent investigations.
- API, FalkorDB, model-provider, dataset, and replay health.

**Requirements:**
- All figures must derive from current application state or saved evaluation results.
- Before benchmark results exist, show counts and status rather than fabricated fraud-reduction statistics.
- Clicking a recent investigation opens its investigation page.

### 6.2 Review queue (`/queue`)

**Purpose:** Triage transactions selected by the pre-filter or replay pipeline.

**Table columns:**
- Timestamp.
- Transaction ID.
- Source and destination.
- Amount and currency.
- Transaction type/format if available.
- Risk score or risk band.
- Ring/pattern indicator when supported by computed evidence.
- Decision and review status.

**Interactions:**
- Search by transaction ID or account ID.
- Filter by risk band, status, amount, and decision.
- Sort by timestamp and risk.
- Open an investigation.
- Start, pause, and reset deterministic replay.
- Receive new events through Server-Sent Events (SSE).

**Requirements:**
- Pagination or bounded result sets.
- Stable ordering.
- Replay reset returns the app to a documented, known state.
- The queue remains responsive while an investigation or model request is running.

### 6.3 Investigation workspace (`/investigations/[id]`)

**Purpose:** The flagship workflow and primary demo surface.

**Layout:**
1. **Transaction header:** ID, timestamp, amount, source, destination, and status.
2. **Graph canvas:** target transaction, relevant account neighbourhood, and evidence path.
3. **Evidence inspector:** selected node/edge attributes, underlying transaction records, timestamps, amounts, and case links.
4. **Assessment panel:** risk level, ring classification, selected suspicious entity if applicable, provider, latency, and policy result.
5. **Action controls:** allow, send to review, or simulated block, subject to policy permissions.
6. **Audit history:** query results, model result, policy version, and analyst action.

**Graph interactions:**
- Select a node to inspect its details.
- Select an edge to inspect the transfer record.
- Highlight a returned evidence path.
- Adjust bounded hop depth within server-enforced limits.
- Toggle relevant evidence categories.
- Fit graph to viewport and reset selection.
- Show a legend for account nodes, transaction nodes, edges, selected entities, and evidence states.

**Requirements:**
- The highlighted explanation path must come from the backend, not be independently fabricated by the frontend.
- The UI must distinguish observed graph facts from model assessments.
- Missing model output must not hide graph evidence.
- No hardcoded risk score or evidence path in the live investigation workflow.

### 6.4 Cases and memory (`/cases`)

**Purpose:** Review cases and reuse confirmed case knowledge.

**Statuses:**
- Suspected
- Under review
- Confirmed
- Dismissed
- Closed/resolved, if needed

**Case detail:**
- Case ID and timestamps.
- Reviewer and decision.
- Related accounts and transactions.
- Evidence paths and supporting records.
- Audit trail.
- Links to subsequent investigations that retrieved the case.

**Requirements:**
- Only explicit analyst confirmation promotes a suspected case into confirmed memory.
- Dismissal does not delete underlying transactions or rewrite audit history.
- Store provenance, timestamps, and reviewer action.
- A future investigation may retrieve confirmed case evidence through graph links.
- Prevent test-set labels or future outcomes from populating case memory during evaluation.

### 6.5 Benchmark (`/benchmark`)

**Purpose:** Show reproducible proof of graph value.

**Experiments:**
- Rules-only baseline.
- Sequence/tabular-only baseline.
- Tabular plus graph-derived features.
- Graph features plus Jev or fallback model assessment.
- Optional vector-RAG comparison if implemented without compromising core scope.

**Metrics:**
- Precision, recall, F1.
- PR-AUC where appropriate.
- False-positive rate.
- Value-weighted recall.
- Per-pattern performance.
- p50 and p95 latency.
- Cost per 1,000 candidate decisions.
- Calibration metric if probabilities are claimed.
- Confusion matrix or equivalent error breakdown.

**Requirements:**
- Show dataset version, split definition, run ID, model/provider, configuration, and timestamp.
- Clearly label synthetic-data results.
- Show graph ablation on the same held-out candidate set.
- Do not display placeholder numbers as actual results.
- In-progress and failed runs must have honest statuses.

### 6.6 System status (`/system`)

**Purpose:** Provide fast diagnostics during development and live demo.

**Content:**
- API health.
- FalkorDB connection health.
- Model provider availability and last error.
- Dataset import status.
- Replay state and event count.
- Recent application errors.

**Requirements:**
- No secrets or API keys displayed.
- Health indicators reflect actual checks.
- Provider failure should be distinguishable from graph or API failure.

### 6.7 Marketing page (`/` before app entry, or dedicated `/product` route)

If a distinct public landing page is required, use `/product` and keep the authenticated/demo application at `/app`. Otherwise, the marketing page can be the default route with a prominent "Open demo" action.

**Sections:**
1. **Hero:** "Find the hidden networks behind every transaction."
2. **Short explanation:** Overview of graph-native fraud investigation.
3. **Product visual:** Product screenshot or graph investigation visual.
4. **Three pillars:** Discover, Explain, Remember.
5. **How it works:** Transaction -> FalkorDB graph -> assessment -> analyst action.
6. **Benchmark section:** Display measured results only after runs complete.
7. **Technical stack:** Detail the graph-first architecture.
8. **CTA:** Open the demo and view methodology.

**Requirements:**
- Never claim unmeasured fraud reductions or latency.
- If the page uses illustrative statistics, label them as illustrative; preferably omit them.
- Explain that the prototype is evaluated on synthetic data.
- Do not present simulated actions as real financial enforcement.

---

## 7. Visual and interaction design

### Reference direction

Use **Case 0021 by Aleks D. for Voit Team on Dribbble** as the visual reference for dark fintech composition, layered panels, compact typography, and a focused analytical workspace. The lilac shade in that reference is the primary accent for Tripwire.

Reference: https://dribbble.com/shots/24867771-Case-0021

### Design principles

- Dark, editorial fintech workstation; not generic neon cybersecurity.
- Layered charcoal surfaces and thin borders.
- Lilac as the primary accent for brand, active navigation, selection, focus, and primary CTA.
- Orange, red, and amber are reserved for transaction evidence and risk semantics.
- Dense tables, concise labels, consistent alignment, restrained shadows.
- Graph canvas receives the largest share of the investigation workspace.
- Avoid oversized cards, gratuitous gradients, and decorative charts without analytical meaning.

### Initial design tokens

These are starting tokens to refine against the reference, not a claim of exact color extraction.

| Token | Value | Use |
| :--- | :--- | :--- |
| Background | `#0B0B10` | App background |
| Panel | `#12121A` | Main panels |
| Elevated panel | `#191923` | Popovers, selected cards |
| Border | `#292936` | Subtle separation |
| Primary text | `#F2F0F8` | Headings and body |
| Secondary text | `#9693A8` | Metadata |
| Primary lilac | `#B68CFF` | Brand, active states, primary CTA |
| Lilac hover | `#C7A9FF` | Hover/focus |
| Lilac deep | `#8054C7` | Selected graph entities, secondary accent |
| Risk amber | `#F4B860` | Review state |
| Risk red | `#F87171` | High-risk evidence |
| Success green | `#56D6A0` | Allow/healthy state |
| Informational blue | `#77A9F8` | Neutral information |

### Typography and spacing

- **Interface:** Inter or a comparable clean sans-serif.
- **Transaction IDs, amounts, timestamps, and query output:** JetBrains Mono.
- **Base spacing:** 4px spacing base; common spacing increments 8, 12, 16, and 24px.
- **Corner radius:** 6-10px.
- **Tables:** Compact table rows and sticky headers.
- **Target resolution:** Desktop target: 1440 x 900.
- **Responsiveness:** Responsive support focuses on queue and case details; the graph workstation is desktop-first.

### Graph visual semantics

- **Account:** circle node.
- **Transaction:** distinct node or edge marker, consistent with graph payload.
- **Lilac:** selection and active investigation context.
- **Orange:** highlighted suspicious evidence path.
- **Red:** high-risk or confirmed-risk evidence, not every node in a neighbourhood.
- **Amber:** requires review.
- **Dashed edge:** inferred or synthetic relationship only, with explicit legend.
- **Edge thickness:** may represent amount only when the scale is explained.

Do not conflate model activity with risk. Color must have a stable semantic meaning across all screens.

---

## 8. Technical architecture

### Stack

**Frontend:**
- Next.js App Router
- React and TypeScript
- Tailwind CSS
- shadcn/ui
- Lucide icons
- Cytoscape.js for interactive graph rendering
- TanStack Query for server state
- Native `EventSource` for SSE

**Backend:**
- Python
- FastAPI
- Pydantic schemas
- Official FalkorDB Python client and supported Cypher syntax
- A small provider adapter for Jev and fallback provider
- Deterministic policy module

**Data and evaluation:**
- FalkorDB as the authoritative graph store
- SQLite for benchmark run metadata and measurement records if relational storage is useful
- Pandas for dataset preparation
- scikit-learn and LightGBM or XGBoost for baselines, depending on installation and time
- Evaluation scripts kept separate from inference services

**Infrastructure:**
- Docker Compose for local development
- GitHub Actions for linting and tests
- Frontend and API deployed separately if supported by chosen hosting
- FalkorDB hosted or containerized according to the team's reliable deployment path

### Explicitly excluded from the initial build

- Kafka, RabbitMQ, and Redis.
- Kubernetes.
- Separate vector database.
- Large multi-agent orchestration framework.
- Graph-JEPA or GraphSAGE training before the core benchmark works.
- Real-money integrations.

### High-level request flow

1. Replay service emits a transaction in timestamp order.
2. A rules pre-filter determines whether to investigate it.
3. The graph service loads the transaction and bounded neighbourhood from FalkorDB.
4. Structural feature logic calculates graph evidence.
5. The detector returns a score/classification; Jev may provide an additional typed assessment.
6. Pydantic validates outputs.
7. A deterministic policy creates `allow`, `review`, or simulated `block`.
8. The service persists decision, evidence, timing, and provider metadata.
9. SSE publishes the result to the frontend.
10. Analyst confirmation can write a confirmed case into graph memory.

### Failure handling

- **FalkorDB unavailable:** report service failure; do not pretend a graph investigation occurred.
- **Model provider unavailable:** return graph evidence and deterministic fallback result or route to review.
- **Invalid model output:** reject it, log the error, and apply the configured safe fallback.
- **SSE disconnect:** client reconnects and refetches current state.
- **Duplicate replay event:** idempotent transaction and decision identifiers prevent duplicate records.
- **Overlarge neighbourhood:** enforce server-side hop and result limits.

---

## 9. Graph data model

Use a FalkorDB graph named `tripwire`.

### Core nodes

- **Account**
  - `account_id`
  - `institution` or source-system identifier where available
  - `created_at` if supported by the data

- **Transaction**
  - `transaction_id`
  - `amount`
  - `currency`
  - `timestamp`
  - `format` or transaction type when available
  - relevant source metadata

- **Case**
  - `case_id`
  - `status`
  - `created_at`
  - `reviewed_at`
  - `reviewer_id` or demo reviewer identifier
  - `decision`
  - `provenance`

- **Ring**
  - `ring_id`
  - `pattern`
  - `confirmation_status`
  - timestamps and provenance

### Core relationships

- `(source:Account)-[:SENT]->(tx:Transaction)`
- `(tx:Transaction)-[:RECEIVED]->(destination:Account)`
- `(case:Case)-[:INVOLVES]->(account:Account)`
- `(case:Case)-[:SUPPORTED_BY]->(tx:Transaction)`
- `(ring:Ring)-[:HAS_MEMBER]->(account:Account)`
- `(case:Case)-[:IDENTIFIES]->(ring:Ring)` where appropriate

Use first-class transaction nodes so each transfer has a stable identity, amount, timestamp, decision, and evidence references. Ensure exactly one transaction node exists per transaction ID.

### Graph query requirements

Implement and test:
1. Bounded neighbourhood around a target transaction's source and destination.
2. Fan-in and fan-out features over configurable time windows.
3. Directed cycle detection within bounded depth.
4. Paths to accounts involved in confirmed cases.
5. Retrieval of relevant prior case evidence.
6. Query returning node/edge IDs and attributes for graph visualization.
7. Queries that calculate counts and structural features without returning an unbounded graph.

All Cypher must be compatible with the chosen FalkorDB version and included in the README or `graph/queries/`.

---

## 10. Fraud detection and model strategy

The Fraud Intelligence & Evaluation Lead owns this workstream.

### Stage 1: Baselines

Implement:
1. Rules-only baseline.
2. Transaction/tabular feature baseline using LightGBM or XGBoost.
3. Graph-derived features added to the tabular baseline.
4. Graph features plus optional Jev assessment.

A sequence-only LLM comparison and vector-RAG comparison are optional and should not delay the baselines.

### Transaction-level features

Potential features, only when derivable at decision time:
- Log-transformed amount.
- Prior sender transaction count.
- Prior receiver transaction count.
- Number of distinct counterparties in a time window.
- Time since previous transaction.
- Amount deviation from historical behavior.
- Incoming/outgoing volume and ratio over a bounded window.
- Burst frequency and temporal concentration.

### Graph-derived features

Potential features:
- Distinct incoming sender count.
- Distinct outgoing recipient count.
- Incoming/outgoing amount concentration.
- Cycle existence and cycle length.
- Cycle duration.
- Bounded path length and number of relevant paths.
- Branching and merging measures.
- Scatter-gather indicators.
- Repeated interaction between account groups.
- Link to previously confirmed case evidence, using only information available at the decision time.

Do not assume any one feature proves fraud. Evaluate interactions and false-positive behavior.

### LLM role

Jev, if accessible, receives a compact structured representation of graph evidence and returns typed fields such as:
- risk level (1-5),
- ring assessment,
- selected suspicious entity from a bounded candidate set.

The model must not invent graph facts or replace deterministic graph queries. Validate all output. Record model/provider, latency, input/output token counts when available, and errors. If Jev is unavailable, the core product remains functional through the provider adapter and deterministic baseline.

### Policy

Support `allow`, `review`, and simulated `block`.

Initial numeric thresholds may be configurable experiments, but a score must not be called a calibrated probability until calibration is measured on validation data. Keep policy separate from model inference. Model failures and invalid outputs should use a safe fallback, normally human review or a documented deterministic policy.

### Explainability

An investigation explanation consists of:
- actual graph path(s),
- relevant node and edge attributes,
- computed structural features,
- model assessment,
- policy version and action,
- timestamped audit record.

Generated prose may be supplementary, but it is not the source of truth.

---

## 11. Evaluation and optimization plan

### Split strategy

Use a documented, leakage-aware split. Prefer chronological splits where timestamps are suitable. Add a separate unseen-pattern or grouped holdout only when the dataset's structure supports it. Do not report the two as if they were the same experiment.

Fit feature transformations, model parameters, calibration, and thresholds without using final test labels.

### Core experiments

| Experiment | Question |
| :--- | :--- |
| Rules-only | What does a simple operational baseline achieve? |
| Tabular-only | What do transaction history and local features contribute? |
| Tabular + graph | Does graph structure improve detection? |
| Tabular + graph + Jev | Does the LLM add enough value to justify latency and cost? |
| Case memory on/off | Does confirmed historical context improve later investigations? |

### Metrics

- Precision.
- Recall.
- F1.
- PR-AUC where appropriate.
- False-positive rate.
- Value-weighted recall.
- Per-typology performance.
- p50 and p95 end-to-end latency.
- Cost per 1,000 candidate decisions.
- Calibration error or Brier score if probability estimates are used.

### Leakage and validity controls

- Ground-truth labels are not inference features.
- Future transactions are not available when calculating historical features for an earlier event.
- Test outcomes do not populate case memory.
- Thresholds are chosen on validation data, not the test set.
- Comparisons use the same test transactions and candidate selection where relevant.
- Graph context and no-graph comparisons hold other inputs constant as much as possible.
- Synthetic-data results are labelled as such.
- Failed runs and missing metrics are not silently omitted.

### Performance optimization order

1. Ensure correct results.
2. Bound neighbourhood queries and use relevant indexes/constraints supported by the deployed version.
3. Return only the evidence needed for features and visualization.
4. Cache only safe, versioned computations if required.
5. Measure database time, feature calculation time, model time, and total latency separately.
6. Tune feature windows and model hyperparameters on validation data.
7. Keep Jev only if its measured incremental value justifies the cost and latency.

---

## 12. API contract

Use REST for commands and queries, SSE for replay events.

| Method | Endpoint | Purpose |
| :--- | :--- | :--- |
| GET | `/api/health` | API health |
| GET | `/api/overview` | Dashboard summary |
| GET | `/api/transactions` | Filtered, paginated queue |
| GET | `/api/transactions/{id}` | Transaction details |
| POST | `/api/replay/start` | Start replay |
| POST | `/api/replay/pause` | Pause replay |
| POST | `/api/replay/reset` | Reset deterministic replay |
| GET | `/api/events` | SSE replay and investigation events |
| POST | `/api/investigations` | Start an investigation |
| GET | `/api/investigations/{id}` | Decision and evidence payload |
| GET | `/api/cases` | List and filter cases |
| GET | `/api/cases/{id}` | Case details |
| POST | `/api/cases/{id}/review` | Confirm or dismiss case |
| GET | `/api/benchmarks` | List benchmark runs |
| POST | `/api/benchmarks/run` | Start benchmark |
| GET | `/api/benchmarks/{id}` | Metrics and run metadata |

### Investigation response contract

The conceptual response should contain:
- `investigation_id`
- `transaction_id`
- `risk_level`
- `ring_detected`
- `suspicious_entity_id` (nullable)
- `risk_score` and `score_semantics`
- `action`
- `evidence_paths`
- `graph_features`
- `model_provider`
- `latency_ms`
- `policy_version`
- `created_at`

`EvidencePath` should contain ordered entity IDs, edge/transaction IDs, and the attributes needed to explain the path. `score_semantics` must distinguish an uncalibrated score from a calibrated probability.

---

## 13. MCP tools

MCP is a thin adapter over the same graph-backed services, not a separate implementation.

Initial tools:
- `ring_neighbourhood`: return a bounded relevant neighbourhood.
- `shortest_path`: return a path between valid entities.
- `flag_case`: create or update a case with provenance and audit data.

Add `community_of` only if the selected FalkorDB version supports the required algorithm and the feature is complete without risking core scope.

The demo should show a tool being selected, a real graph result being returned, and a subsequent decision or action using that result. Tool exposure alone is not proof of useful agent behavior.

---

## 14. Team ownership

The team has four members, with one person primarily responsible for UI.

### Person 1: Frontend and UI

- Next.js shell and routing.
- Design tokens and shared components.
- Overview, queue, investigation, cases, benchmark, and system screens.
- Cytoscape graph interaction.
- SSE client and error states.
- Marketing page and frontend deployment.
- Build initially against mock API fixtures.

### Person 2: Graph and data engineer

- Dataset import and validation.
- FalkorDB schema and indexes.
- Cypher queries and structural feature extraction.
- Bounded path retrieval.
- Graph query tests and graph model documentation.

### Person 3: Backend and agent

- FastAPI routes and Pydantic schemas.
- Replay orchestration and SSE.
- Model adapter and provider fallback.
- Deterministic policy.
- Investigation persistence, case review, and audit records.
- MCP adapter if core workflow is complete.

### Person 4: Fraud Intelligence & Evaluation Lead (the user)

- Rules-only and tabular baselines.
- Leakage-safe split and evaluation protocol.
- Graph-derived feature design in collaboration with the graph engineer.
- Model training, feature ablation, and threshold selection.
- Per-typology metrics, latency, and cost measurement.
- Counterfactual comparison and technical explanation for the demo.
- Review of all fraud and performance claims.

### Integration authority

Assign one teammate as technical lead for shared API/schema decisions, main-branch integration, scope cuts, and final demo go/no-go. The role should be assigned based on implementation strength rather than UI ownership.

### Working agreements

- No direct pushes to `main`.
- Small feature branches and frequent integration.
- Agree on API schemas and mock fixtures on Day 1.
- Do not block the frontend on backend completion.
- Keep one authoritative graph schema.
- Every displayed metric must be reproducible.
- Cut stretch features when core acceptance criteria are at risk.

---

## 15. Build plan: 15-18 October 2026

The schedule is an execution plan, not permission to delay integration until the final day.

### Day 1: Foundation

- Create monorepo and Docker Compose setup.
- Lock API response schemas and sample fixtures.
- Import a small AMLworld slice into FalkorDB.
- Verify graph IDs, transaction uniqueness, and initial Cypher queries.
- Build frontend shell and design tokens.
- Establish rules-only and data-split pipeline.

**Exit gate:** UI renders a mocked queue and graph; backend returns a real graph neighbourhood; evaluation can load and split the data.

### Day 2: Vertical slice

- Connect queue to real API.
- Implement investigation endpoint and evidence payload.
- Render returned graph path.
- Add deterministic policy and audit record.
- Implement replay start/pause/reset and SSE.
- Train a first tabular baseline.
- Test model-provider fallback.

**Exit gate:** a transaction enters the queue, produces a real FalkorDB investigation, and appears in the UI with a decision and inspectable evidence.

### Day 3: Differentiation

- Add graph-derived features and run graph ablation.
- Add per-pattern benchmark metrics.
- Integrate Jev if access and latency testing succeed.
- Implement analyst confirmation and case retrieval.
- Finish the counterfactual graph comparison.
- Deploy an integrated version and rehearse the demo.

**Exit gate:** the system demonstrates one graph-dependent insight and one case-memory-dependent investigation; benchmark runs produce real metrics.

### Day 4: Hardening and submission

- Verify no target-label leakage.
- Freeze thresholds and final evaluation configuration.
- Test fresh startup, replay reset, and provider failure.
- Complete README, graph model, and Cypher documentation.
- Finish AI-assistance disclosure.
- Record the demo and complete blog/submission material.
- Avoid new subsystems.

**Exit gate:** the demo runs from a clean start, results are reproducible, and no manual database edits are required.

---

## 16. Marketing and demo content

### Positioning

**Headline:** Find the hidden networks behind every transaction.

**Supporting message:** Tripwire uses graph intelligence to investigate suspicious transaction flows, expose verifiable evidence paths, and preserve analyst-confirmed case knowledge.

### Three product pillars

- **Discover:** expose structural relationships hidden by transaction-by-transaction review.
- **Explain:** inspect the exact path and graph-derived signals supporting a decision.
- **Remember:** retrieve confirmed historical cases when relevant entities appear again.

### 90-second demo outline

1. **0-15s:** A transaction arrives in the queue; basic transaction context looks ordinary.
2. **15-35s:** Investigate it; FalkorDB reveals a relevant multi-hop flow structure.
3. **35-50s:** Show actual graph features, the typed assessment, and the policy decision.
4. **50-65s:** Confirm the case; replay a later transaction and retrieve prior evidence.
5. **65-80s:** Show real benchmark results, including the graph ablation and a relevant typology.
6. **80-90s:** Show the deployed application, graph schema, and core Cypher query.

The demo should use deterministic replay and a preselected example from the evaluation data. Do not hardcode the result; the live application must execute the graph query and display its actual output.

---

## 17. Security, privacy, and responsible-use requirements

- Use synthetic/public data only for the hackathon prototype.
- Do not connect to real financial accounts or execute real-money actions.
- Simulated block actions must be clearly labelled.
- Never expose credentials in source control or UI.
- Validate all user-supplied IDs and filter parameters.
- Apply server-side bounds to graph traversal depth and result size.
- Treat LLM output as untrusted until schema and policy validation succeeds.
- Keep an audit record for model output and analyst decisions.
- Separate confirmed cases from unreviewed predictions.
- Do not claim that graph association alone proves wrongdoing.
- Display limitations prominently in documentation and the marketing page.

---

## 18. Risks and mitigations

| Risk | Impact | Mitigation |
| :--- | :--- | :--- |
| Jev access is unavailable | Model integration delay | Provider adapter and deterministic fallback; graph engine remains usable |
| Graph queries are slow | Poor demo latency | Bounded traversal, relevant indexes, limited payloads, query profiling |
| Labels leak into features | Invalid benchmark | Separate inference and evaluation data; tests that inspect feature inputs |
| Graph does not improve F1 | Core claim weakened | Report honestly; examine per-pattern value, false-positive tradeoffs, and path-level explanation utility |
| UI waits for APIs | Integration delay | Mock fixtures and stable contracts on Day 1 |
| Scope expands | Core demo unfinished | Defer advanced ML, vector-RAG, extra datasets, and extra MCP tools |
| Synthetic results are overclaimed | Credibility loss | Label all metrics and avoid production fraud-reduction claims |
| Case memory contaminates test | Invalid memory experiment | Only use cases available before the evaluated transaction; isolate test writes |
| High-degree accounts return huge subgraphs | Latency and rendering problems | Enforce hop/result limits and return only relevant evidence |
| Provider output is malformed | Invalid decisions | Pydantic validation and safe fallback |

---

## 19. Definition-of-done checklist

### Core product

- [ ] Dataset imports idempotently.
- [ ] Queue shows actual replay events.
- [ ] Investigation calls FalkorDB.
- [ ] Selected evidence path matches the backend response.
- [ ] Decision and audit record persist.
- [ ] Replay can be reset reproducibly.

### Detection and evaluation

- [ ] Rules-only baseline runs.
- [ ] Tabular baseline runs.
- [ ] Graph-feature model runs.
- [ ] Graph ablation runs on identical held-out transactions.
- [ ] Target labels are unavailable to inference.
- [ ] Metrics include false positives and per-pattern results.
- [ ] Thresholds are selected without test-set tuning.
- [ ] Cost and latency measurements are recorded.
- [ ] Results are labelled as synthetic-data results.

### Case memory

- [ ] Analyst can confirm or dismiss a case.
- [ ] Confirmed case records include provenance.
- [ ] Later investigations can retrieve relevant confirmed evidence.
- [ ] Test labels cannot write to case memory.

### UI and submission

- [ ] All required screens render and have loading/error/empty states.
- [ ] Lilac is the primary accent and matches the chosen design direction.
- [ ] Marketing claims use measured or clearly qualified information.
- [ ] README includes graph model and Cypher.
- [ ] AI-assistance disclosure is present.
- [ ] Clean startup and demo replay work.
- [ ] Demo video is recorded and tested.

---

## 20. Final scope lock

The project is complete when it delivers the following vertical slice:

**Transaction replay -> candidate selection -> FalkorDB graph investigation -> graph-derived features -> validated detection decision -> evidence-path visualization -> analyst review -> confirmed case memory -> reproducible benchmark.**

Everything else is optional.

The main success claim must be determined by the results: Tripwire should demonstrate whether graph-derived context improves detection over simpler baselines, where the improvement occurs, and what latency/cost it adds. If the results do not support a performance improvement, the team must not fabricate one; the product can still demonstrate verifiable graph investigation and case-memory capabilities.

**Final product rule:** FalkorDB must be essential to the investigation, the evidence must be inspectable, and every performance claim must be reproducible.
