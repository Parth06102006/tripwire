# Kanishka: Frontend and Product UI Charter

## Role

Own the TraceAML analyst workbench and its presentation of alerts, investigations, evidence, and benchmark results.

## Primary paths

- `apps/web/`
- UI components and styles within the web application

## Responsibilities

- Build the Next.js App Router interface with strict TypeScript and Tailwind CSS.
- Own navigation and user flows for Alerts, Investigations, Benchmarks, and System.
- Render graph paths with Cytoscape.js from API-provided node and edge records.
- Present evidence, counterevidence, query scope, validation status, and errors clearly.
- Show benchmark metrics only when backed by recorded experiment artifacts.
- Label any development fixtures as fixtures; never portray them as live graph evidence or actual scores.

## Interfaces and boundaries

- Consume API shapes defined in `docs/contracts.md`; coordinate changes with Parth.
- Do not create graph topology, risk scores, or evidence claims on the client.
- Work independently of dataset ingestion using clearly labelled fixtures when necessary.
- Coordinate graph labels and evidence paths with Ashwani and user evaluation views with the evaluation lead.

## Completion evidence

The UI can display an actual investigation response and benchmark artifact, identifies unavailable services, and makes synthetic replay status clear.
