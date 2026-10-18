"""Build the label-free data bundle a Tripwire server needs.

Run on the workstation that holds the offline data and run artifacts:

    uv run --project graph python deploy/scripts/make_release_bundle.py \
        --run-root ../tripwire/artifacts/runs/hi-small-v8 \
        --transactions ../tripwire/data/processed/hi-small-v8/transactions.parquet \
        --out dist/release

Output (upload the whole directory to the server, for example through S3):

    artifacts/baselines/inference_scores.parquet   scores the API serves
    artifacts/baselines/baseline_config.json       locked review threshold
    artifacts/baselines/baseline_metrics.json      aggregate benchmark metrics
    artifacts/graph-ablation/baseline_metrics.json aggregate metrics (optional)
    graph-input/graph-transactions.parquet         graph loader input
    MANIFEST.json, SHA256SUMS

Nothing labelled leaves the workstation: the graph input keeps only the
loader's own column allowlist (``graph.load_graph.LOAD_COLUMNS``), and every
file is checked for label, split and typology columns or keys before it is
written. Evaluation files such as ``test_scores.parquet`` are never copied.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import shutil
from datetime import UTC, datetime
from pathlib import Path

import pyarrow.parquet as pq
from graph.load_graph import LOAD_COLUMNS

FORBIDDEN = re.compile(r"laundering|label|typology|^split$|is_illicit", re.IGNORECASE)

# (source relative to --run-root, destination relative to artifacts/, required)
API_ARTIFACTS: tuple[tuple[str, str, bool], ...] = (
    ("baselines/inference_scores.parquet", "baselines/inference_scores.parquet", True),
    (
        "baselines/inference_scores-manifest.json",
        "baselines/inference_scores-manifest.json",
        False,
    ),
    ("baselines/baseline_config.json", "baselines/baseline_config.json", True),
    ("baselines/baseline_metrics.json", "baselines/baseline_metrics.json", True),
    (
        "graph-ablation/baseline_metrics.json",
        "graph-ablation/baseline_metrics.json",
        False,
    ),
)


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def assert_label_free_parquet(path: Path) -> None:
    bad = [name for name in pq.read_schema(path).names if FORBIDDEN.search(name)]
    if bad:
        raise SystemExit(f"refusing {path}: offline-only columns {bad}")


def assert_label_free_json(path: Path) -> None:
    def walk(node: object) -> None:
        if isinstance(node, dict):
            for key, value in node.items():
                if FORBIDDEN.search(str(key)) and str(key) not in ALLOWED_JSON_KEYS:
                    raise SystemExit(f"refusing {path}: offline-only key {key!r}")
                walk(value)
        elif isinstance(node, list):
            for value in node:
                walk(value)

    walk(json.loads(path.read_text(encoding="utf-8")))


# Metadata keys that mention labels or splits without holding any: aggregate
# counts per split, the label column's name, and "labels_read": false.
# Per-transaction labels could only travel in Parquet columns, checked above.
ALLOWED_JSON_KEYS = frozenset(
    {"splits", "label_column", "labels_read", "joined_splits_sorted_by"}
)


def write_graph_input(transactions: Path, out: Path, limit: int | None) -> int:
    source_columns = pq.read_schema(transactions).names
    missing = [name for name in LOAD_COLUMNS if name not in source_columns]
    if missing:
        raise SystemExit(f"{transactions} lacks loader columns {missing}")
    table = pq.read_table(transactions, columns=list(LOAD_COLUMNS))
    if limit is not None:
        table = table.slice(0, limit)
    out.parent.mkdir(parents=True, exist_ok=True)
    pq.write_table(table, out, compression="zstd")
    assert_label_free_parquet(out)
    return table.num_rows


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument("--run-root", type=Path, required=True)
    parser.add_argument("--transactions", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument(
        "--limit-rows",
        type=int,
        default=None,
        help="Only for smoke tests: keep the first N graph rows.",
    )
    args = parser.parse_args(argv)

    if args.out.exists():
        shutil.rmtree(args.out)
    files: list[Path] = []

    for source, destination, required in API_ARTIFACTS:
        src = args.run_root / source
        if not src.is_file():
            if required:
                raise SystemExit(f"missing required artifact {src}")
            continue
        dst = args.out / "artifacts" / destination
        dst.parent.mkdir(parents=True, exist_ok=True)
        if src.suffix == ".parquet":
            assert_label_free_parquet(src)
        else:
            assert_label_free_json(src)
        shutil.copy2(src, dst)
        files.append(dst)

    graph_input = args.out / "graph-input" / "graph-transactions.parquet"
    rows = write_graph_input(args.transactions, graph_input, args.limit_rows)
    files.append(graph_input)

    manifest = {
        "created_utc": datetime.now(UTC).isoformat(),
        "graph_rows": rows,
        "graph_columns": list(LOAD_COLUMNS),
        "limited": args.limit_rows is not None,
        "source_transactions_sha256": sha256(args.transactions),
        "files": {
            str(path.relative_to(args.out).as_posix()): sha256(path) for path in files
        },
    }
    (args.out / "MANIFEST.json").write_text(
        json.dumps(manifest, indent=2), encoding="utf-8"
    )
    (args.out / "SHA256SUMS").write_text(
        "".join(f"{digest}  {name}\n" for name, digest in manifest["files"].items()),
        encoding="utf-8",
    )
    total = sum(path.stat().st_size for path in files)
    print(
        f"bundle at {args.out}: {len(files)} files, {total / 1e6:.1f} MB, {rows:,} graph rows"
    )


if __name__ == "__main__":
    main()
