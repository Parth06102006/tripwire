# Recorded runs (removed)

The Iteration 2 workbench had a Recorded mode that replayed captured `POST /api/investigations` responses from a local `apps/web/public/recorded/runs.json`. The Iteration 3 rebuild of `apps/web/` (ADR-022) removed it together with its capture script and schema. The workbench now shows only live API responses.

Previously captured `runs.json` files are no longer read by anything and can be deleted. They hold transaction-level records from the synthetic dataset and must not be committed.
