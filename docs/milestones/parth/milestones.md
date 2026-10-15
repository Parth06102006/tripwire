# Parth: Backend and Investigation Integration Charter

## Role

Own the FastAPI service, shared API implementation, deterministic decision policy, and integration of scoring, graph tools, reports, and audit history.

## Primary paths

- `services/api/`
- Local service integration in `compose.yaml` and root scripts, coordinated with the project lead

## Responsibilities

- Implement validated Pydantic request/response models and endpoints described in `docs/contracts.md`.
- Coordinate deterministic replay and connect scoring, graph retrieval, and analyst-facing responses.
- Keep policy decisions deterministic and label any `block` outcome as simulated.
- Expose approved bounded investigation tools and pass their returned evidence to the optional report model.
- Validate report transaction IDs, paths, amounts, and timestamps before presenting claims as evidence.
- Persist decisions and explicit analyst review provenance; preserve dismissal history.
- Provide safe behavior when FalkorDB or the optional LLM is unavailable.

## Interfaces and boundaries

- Coordinate graph properties and query payloads with Ashwani.
- Coordinate scoring and metric semantics with the evaluation lead.
- Publish stable contracts for Kanishka; do not require the UI to infer missing data.
- The LLM may summarize retrieved evidence but cannot assign final risk probability or policy action.

## Completion evidence

API responses validate against shared contracts, service failures return typed errors or deterministic fallback, and persisted case changes include reviewer and evidence provenance.
