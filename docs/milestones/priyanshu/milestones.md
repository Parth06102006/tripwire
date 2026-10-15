# User: Fraud Intelligence and Evaluation Charter

## Role

Own the statistical evaluation, leakage controls, model baselines, and review of all fraud-detection and performance claims. The user also acts as project orchestration and integration lead.

## Primary paths

- `ml/`
- Evaluation and result documentation under `docs/`

## Responsibilities

- Inspect and document the exact supplied dataset version, schema, file hashes, label counts, timestamp range, duplicates, and currency semantics.
- Define a chronological split and point-in-time feature rules; keep the held-out test cohort frozen.
- Train logistic regression, LightGBM, and LightGBM with graph features on comparable cohorts.
- Co-design graph feature definitions with Ashwani and verify their availability at scoring time.
- Select thresholds on training/validation only and report precision, recall, F1, average precision/PR-AUC, and recall at a stated alert budget.
- Define dollar-weighted recall carefully; distinguish measured cost from estimates.
- Review model, graph, latency, cost, and synthetic-data claims before they enter the UI or public documentation.
- Coordinate interfaces, delegate bounded work, review worker output, and resolve integration conflicts.

## Interfaces and boundaries

- Own evaluation protocol and model conclusions; do not own FalkorDB query implementation.
- Work with Ashwani on structural features and Parth on service inference contracts.
- Provide Kanishka only reproducible result artifacts and approved metric wording.
- Do not use test labels to generate features, tune models, select thresholds, or seed case memory.

## Completion evidence

All model comparisons share a documented frozen test cohort, result artifacts record configuration and hashes, and every public claim is traceable to a reproducible run.
