# Architectural Decision Records (ADRs): Tripwire

This document records the architectural and design decisions established for Tripwire.

---

## ADR-001: Monorepo Architecture with Strict Ecosystem Separation
- **Date**: 2026-10-15
- **Status**: Accepted
- **Context**: The project combines a modern Next.js desktop interface with a Python-based machine learning, graph feature engineering, and FastAPI backend. Cross-ecosystem package managers often cause dependency drift, leaky toolchains, and brittle builds.
- **Decision**: Adopt a monorepo structure with strict boundary isolation:
  - TypeScript frontend (`apps/web`) managed exclusively via `pnpm`.
  - Python backend and evaluation pipelines (`backend/`, `evaluation/`) managed exclusively via `uv` (`uv venv`, `uv pip`, `uv run`).
  - No global package installations; zero cross-contamination.
- **Consequences**:
  - Predictable, isolated builds and test execution.
  - Clear ownership between frontend and backend engineers.

---

## ADR-002: FalkorDB as Primary Authoritative Graph Store
- **Date**: 2026-10-15
- **Status**: Accepted
- **Context**: Detecting money laundering patterns (fan-out, scatter-gather, circular transfers) requires multi-hop path traversals and fast subgraph queries. Relational databases struggle with unbounded joins, while generic graph databases often present high operational overhead.
- **Decision**: Use FalkorDB as the primary graph engine for:
  - Account and transaction topology persistence.
  - Subgraph neighbourhood queries (1-3 hops).
  - Structural feature computation (fan-in/out, cycles).
  - Analyst-confirmed case memory.
- **Consequences**:
  - Low-latency Cypher traversals directly inside the decision loop.
  - UI visualizations map 1:1 to returned FalkorDB subgraphs.
  - Requires bounding Cypher queries with strict limits on depth and result size to prevent memory exhaustion on high-degree nodes.

---

## ADR-003: First-Class Transaction Nodes in Graph Schema
- **Date**: 2026-10-15
- **Status**: Accepted
- **Context**: Graphs can represent transfers as either directed edges `(:Account)-[:TRANSFERRED]->(:Account)` or as intermediate first-class nodes `(:Account)-[:SENT]->(:Transaction)-[:RECEIVED]->(:Account)`.
- **Decision**: Implement transfers as discrete `:Transaction` nodes.
- **Consequences**:
  - Each transaction has a stable identifier, timestamp, currency, and risk attributes.
  - Multiple transfers between the same two accounts do not require multigraph parallel edge workarounds.
  - Auditing, case linking (`:Case -[:SUPPORTED_BY]-> :Transaction`), and path evidence extraction are deterministic and idempotent.

---

## ADR-004: Strict Target-Label Isolation and Chronological Splitting
- **Date**: 2026-10-15
- **Status**: Accepted
- **Context**: Fraud evaluation easily suffers from data leakage (e.g. future transactions informing past features, or ground truth labels being stored on graph nodes accessed by the detector).
- **Decision**:
  - Enforce a strict chronological split on the IBM AMLworld HI-Small dataset.
  - Ground-truth laundering labels and typology tags are strictly quarantined in evaluation datasets and never ingested into FalkorDB or exposed to feature extraction.
  - Graph features computed at time $T$ may only query transactions where $\text{timestamp} \le T$.
- **Consequences**:
  - Reliable, defensible benchmarks that reflect realistic production triage.
  - Zero label leakage into tabular or graph classifiers.

---

## ADR-005: Deterministic Policy Engine Decoupled from Model Inference
- **Date**: 2026-10-15
- **Status**: Accepted
- **Context**: LLM assessments and statistical classifiers can hallucinate or produce uncalibrated scores. Financial triage systems require deterministic, auditable decisions.
- **Decision**: Decouple model inference from decision enforcement via a deterministic Policy Engine:
  - Models emit raw scores and structured feature summaries.
  - Policy rules apply fixed thresholds and criteria to produce `allow`, `review`, or simulated `block`.
  - In the event of model provider timeout or invalid output, the system falls back safely to manual review without crashing the pipeline.
- **Consequences**:
  - Fully auditable decision logs.
  - System remains operational even if third-party LLM providers experience outages.

---

## ADR-006: Human-in-the-Loop Confirmed Case Memory
- **Date**: 2026-10-15
- **Status**: Accepted
- **Context**: Fraud rings often evolve over time. Prior confirmed cases provide high-value signals for future investigations. However, auto-promoting unverified model detections into long-term memory poisons the graph with false positives.
- **Decision**: Only explicit human analyst confirmation promotes a suspected alert into a confirmed `:Case` and `:Ring` in FalkorDB.
- **Consequences**:
  - High confidence in historical memory entities.
  - Every confirmed ring retains full provenance (analyst ID, confirmation timestamp, source evidence paths).
  - Dismissals retain audit history without mutating graph memory.
