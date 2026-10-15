"""Read-only CSV profiler CLI.

Profiles a user-supplied CSV path without modifying, copying, or downloading
data. Prints row/column counts, column names, dtypes, and null counts to
stdout as JSON.
"""

import argparse
import json
import sys
from pathlib import Path


def profile_csv(path: Path, sample_rows: int = 5) -> dict[str, object]:
    """Return a read-only profile of the CSV at path."""
    import polars as pl

    if sample_rows < 0:
        raise ValueError("sample_rows must be zero or greater")
    if not path.is_file():
        raise FileNotFoundError(f"CSV not found: {path}")

    frame = pl.scan_csv(path)
    schema = frame.collect_schema()
    summary = frame.select(
        pl.len().alias("num_rows"),
        pl.all().null_count(),
    ).collect(engine="streaming")
    null_counts = summary.row(0, named=True)
    sample = frame.head(sample_rows).collect(engine="streaming")
    return {
        "path": str(path),
        "num_rows": int(null_counts.pop("num_rows")),
        "num_columns": len(schema),
        "columns": [
            {"name": name, "dtype": str(dtype)}
            for name, dtype in schema.items()
        ],
        "null_counts": {str(k): int(v) for k, v in null_counts.items()},
        "sample": sample.to_dicts(),
    }


def build_parser() -> argparse.ArgumentParser:
    """Build the CLI argument parser."""
    parser = argparse.ArgumentParser(
        description="Profile a local CSV file (read-only, no writes or downloads)."
    )
    parser.add_argument("csv_path", type=Path, help="Path to a local CSV file")
    parser.add_argument(
        "--sample-rows",
        type=int,
        default=5,
        help="Number of sample rows to include (default: 5)",
    )
    return parser


def main(argv: list[str] | None = None) -> int:
    """CLI entry point. Returns a process exit code."""
    args = build_parser().parse_args(argv)
    try:
        profile = profile_csv(args.csv_path, sample_rows=args.sample_rows)
    except FileNotFoundError as exc:
        print(json.dumps({"error": str(exc)}), file=sys.stderr)
        return 2
    except Exception as exc:  # keep CLI total; never dump raw data on failure
        print(json.dumps({"error": f"profiling failed: {type(exc).__name__}"}), file=sys.stderr)
        return 1
    print(json.dumps(profile, indent=2, default=str))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
