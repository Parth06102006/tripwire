# Project Agent Directives: Tripwire

Tripwire is a graph-native fraud investigation platform powered by FalkorDB, combining structural graph evidence, conventional classification, typed LLM assessment, deterministic policy enforcement, and analyst-confirmed case memory.

## Architecture Invariants

- **Ecosystem Separation**: 
  - Frontend (`apps/web` or `frontend/`) is managed with `pnpm` exclusively.
  - Backend and evaluation services (`backend/` or `services/*`, `evaluation/`) are managed with `uv` exclusively.
- **Authoritative Graph Engine**: FalkorDB is the sole source of truth for graph topology and structural feature extraction. Graph evidence returned to the UI must derive directly from executed Cypher queries, never client-side or LLM fabrication.
- **First-Class Transaction Nodes**: In the graph schema, transactions are discrete nodes (`:Transaction`) bounded by `(:Account)-[:SENT]->(:Transaction)-[:RECEIVED]->(:Account)`. This guarantees idempotency, stable audit references, and bounded path traversals.
- **Evaluation and Label Isolation**: Target labels and laundering typology ground truth must never be ingested as inference features or returned in inference Cypher queries. Evaluation sets must remain strictly held out.
- **Deterministic Policy Layer**: Model inference (ML or LLM) emits uncalibrated scores or proposals. The deterministic policy layer owns final decision mapping (`allow`, `review`, simulated `block`). Safe fallback to human review or deterministic rules is mandatory if model providers fail.
- **Provenance-Backed Case Memory**: Only explicit analyst review actions promote suspected entities into confirmed graph memory. Dismissals must preserve transaction history and audit trails.

## Environment & Tooling

- **Package Manager**: Use `pnpm` exclusively (`pnpm build`, `pnpm lint`, `pnpm test`). Never invoke `npm`, `yarn`, or `bun`.
- **Python Tooling**: Use `uv` exclusively (`uv venv`, `uv pip`, `uv run`, `uvx`). Never invoke system Python, global `pip`, or `pip3`.
- **Search Tooling**: Use `ripgrep` (`rg`) exclusively instead of `grep`.
- **Documentation Synchronization**: Keep `docs/milestones.md`, `docs/contracts.md`, and `docs/decisions.md` synchronized whenever API signatures, database schemas, or project phases evolve.

## Code Quality & Style

- **Zero Emoji Standard**: Strictly zero emojis in source code, comments, documentation, UI strings, commit messages, or filenames.
- **Strict Typing**: Zero untyped `any` in TypeScript. All backend endpoints and data transfer objects must use validated Pydantic models.
- **Error Handling**: Use typed result types or explicit HTTP exceptions with standardized error schemas. Avoid unhandled exceptions across service boundaries.
- **Git Conventions**: Conventional commits (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`) with clear technical rationale.
