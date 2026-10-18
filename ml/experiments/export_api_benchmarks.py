"""Export the Iteration 2 detection results in the shape `GET /api/benchmarks` serves.

Reads the frozen test ledger and the Iteration 1 baseline metrics from the
ignored artifact directory and writes `docs/benchmarks/iteration-2-detection.json`,
so the API and the performance screen show the numbers recorded in
`docs/benchmarks/iteration-2-detection.md` on machines that do not hold the
artifacts. Only metrics are exported: no scores, labels or per-row outcomes.

Run from the repository root; the optional argument is the directory that
holds `runs/` when the artifacts live outside this checkout:

    python -I ml/experiments/export_api_benchmarks.py [ARTIFACTS_DIR]
"""

import json
import sys
from pathlib import Path
from typing import Any

REPOSITORY_ROOT = Path(__file__).resolve().parents[2]
ARTIFACTS = Path(sys.argv[1]) if len(sys.argv) > 1 else REPOSITORY_ROOT / "artifacts"
RUN = ARTIFACTS / "runs/hi-small-v8"
LEDGER = RUN / "iteration-2-detection/test_ledger.jsonl"
ITERATION1 = RUN / "baselines/baseline_metrics.json"
OUTPUT = REPOSITORY_ROOT / "docs/benchmarks/iteration-2-detection.json"

BULK = "test_bulk_sept_9_10"

# API key -> ledger candidate, in the order the Summary table lists them.
MODELS = {
    "iteration1_lgbm": "iteration1_lgbm_baseline",
    "c3": "s1_base_reg_neg010",
    "c2": "s4_all_no_kyc_neg100",
    "c1": "s1_all_reg_neg100",
}


def split_record(section: dict[str, Any]) -> dict[str, Any]:
    at_threshold = section["at_val_threshold"]
    return {
        "rows": section["rows"],
        "prevalence": section["prevalence"],
        "alerts": at_threshold["alerts"],
        "precision": at_threshold["precision"],
        "recall": at_threshold["recall"],
    }


def model_record(entry: dict[str, Any], iteration1: dict[str, Any] | None) -> dict[str, Any]:
    test = entry["test"]["all"]
    bulk = entry["test"]["bulk_sept_9_10"]
    at_threshold = test["at_val_threshold"]
    budget = test["at_alert_budget"]

    average_precision: dict[str, float] = {}
    splits: dict[str, Any] = {}
    if iteration1 is not None:
        # The Iteration 1 re-analysis did not retrain, so its train and
        # validation figures are the ones recorded with the baseline run.
        average_precision["train"] = iteration1["average_precision"]["train"]
        average_precision["validation"] = iteration1["average_precision"]["validation"]
        splits["train"] = iteration1["splits"]["train"]
        splits["validation"] = iteration1["splits"]["validation"]
    else:
        average_precision["train"] = entry["train_average_precision"]
        average_precision["validation"] = entry["validation"]["all"]["average_precision"]
        splits["validation"] = split_record(entry["validation"]["all"])
    average_precision["test"] = test["average_precision"]
    average_precision[BULK] = bulk["average_precision"]
    splits["test"] = split_record(test)
    splits[BULK] = split_record(bulk)

    return {
        "average_precision": average_precision,
        "val_threshold_max_f1": at_threshold["threshold"],
        "test_at_val_threshold": {
            "precision": at_threshold["precision"],
            "recall": at_threshold["recall"],
            "f1": at_threshold["f1"],
            "true_positives": at_threshold["true_positives"],
            "false_positives": at_threshold["alerts"] - at_threshold["true_positives"],
        },
        "test_at_alert_budget": {
            "budget": budget["budget"],
            "alerts": budget["alerts"],
            "true_positives": budget["true_positives"],
            "precision": budget["precision"],
            "recall": budget["recall"],
        },
        "splits": splits,
    }


def main() -> int:
    entries = {
        record["candidate"]: record
        for record in (json.loads(line) for line in LEDGER.read_text(encoding="utf-8").splitlines())
    }
    iteration1 = json.loads(ITERATION1.read_text(encoding="utf-8"))["lgbm"]
    models = {
        key: model_record(entries[candidate], iteration1 if key == "iteration1_lgbm" else None)
        for key, candidate in MODELS.items()
    }
    OUTPUT.write_text(json.dumps({"models": models}, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {OUTPUT.relative_to(REPOSITORY_ROOT)} with {len(models)} models")
    return 0


if __name__ == "__main__":
    sys.exit(main())
