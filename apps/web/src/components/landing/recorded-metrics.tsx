"use client";

import Link from "next/link";
import { useBenchmarks } from "@/hooks/use-benchmarks";
import type { ModelBenchmark } from "@/lib/api-schemas";
import { formatDateTime, formatInteger, formatScore } from "@/lib/formatters";
import { PERFORMANCE_HREF } from "./links";

interface Tile {
  label: string;
  value: string;
  note: string;
}

const FALLBACK_TILES: readonly Tile[] = [
  {
    label: "Average precision",
    value: "0.7525",
    note: "Best recorded, threshold free · C1, all seven families",
  },
  {
    label: "Recall at fixed budget",
    value: "0.4773",
    note: "Top 0.1% of alerts, review capacity",
  },
  {
    label: "Frozen test cohort",
    value: "761,639",
    note: "0.205% labelled positive, scored once",
  },
  {
    label: "Models compared",
    value: "4",
    note: "One frozen cohort, one protocol",
  },
];

function scoreOrDash(value: number | undefined): string {
  return value === undefined || !Number.isFinite(value) ? "—" : formatScore(value);
}

/** Human names for the artifact's model keys, matching the Performance screen. */
const MODEL_NOTES: Record<string, string> = {
  c1: "C1, all seven families",
  c2: "C2, all seven families except the account registry",
  c3: "C3, Iteration 1 features with regularization",
  iteration1_lgbm: "Iteration 1 LightGBM baseline",
};

function modelNote(name: string): string {
  return MODEL_NOTES[name] ?? name;
}

function bestByAveragePrecision(
  models: Record<string, ModelBenchmark>,
): { name: string; benchmark: ModelBenchmark } | null {
  let best: { name: string; benchmark: ModelBenchmark } | null = null;
  for (const [name, benchmark] of Object.entries(models)) {
    const score = benchmark.average_precision.test;
    const current = best?.benchmark.average_precision.test;
    if (score === undefined || !Number.isFinite(score)) continue;
    if (best === null || current === undefined || score > current) best = { name, benchmark };
  }
  return best;
}

/**
 * Reads the recorded benchmark artifact from the API, falling back to verified
 * benchmark run data when the backend is offline.
 */
export default function RecordedMetrics() {
  const query = useBenchmarks();

  if (query.isPending) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-hidden="true">
        {["a", "b", "c", "d"].map((key) => (
          <div key={key} className="skeleton h-[96px] w-full rounded-card" />
        ))}
      </div>
    );
  }

  let tiles: Tile[] = [...FALLBACK_TILES];
  let datasetLabel = "Synthetic IBM AMLworld HI-Small v8";
  let measuredOn = "2026-10-16";
  let hardware = "Intel Core i5-13400F, 16 threads, 15.8 GiB RAM";
  let runId = "20261016T083449Z";
  let isLiveArtifact = false;

  if (query.data && query.data.models) {
    const best = bestByAveragePrecision(query.data.models);
    if (best) {
      const { benchmark, name } = best;
      const testSplit = benchmark.splits.test;
      const performance = query.data.performance ?? null;
      isLiveArtifact = true;

      tiles = [
        {
          label: "Average precision",
          value: scoreOrDash(benchmark.average_precision.test),
          note: `Best recorded, threshold free · ${modelNote(name)}`,
        },
        {
          label: "Recall at fixed budget",
          value: scoreOrDash(benchmark.test_at_alert_budget.recall),
          note: `Top ${(benchmark.test_at_alert_budget.budget * 100).toFixed(1)}% of alerts, review capacity`,
        },
        {
          label: "Frozen test cohort",
          value: testSplit ? formatInteger(testSplit.rows) : "—",
          note: testSplit
            ? `${(testSplit.prevalence * 100).toFixed(3)}% labelled positive, scored once`
            : "Test split not reported in the artifact",
        },
        {
          label: "Models compared",
          value: formatInteger(Object.keys(query.data.models).length),
          note: "One frozen cohort, one protocol",
        },
      ];

      if (performance) {
        datasetLabel = performance.dataset_label;
        measuredOn = formatDateTime(performance.measured_on);
        hardware = performance.hardware;
        runId = performance.run_id ?? runId;
      }
    }
  }

  return (
    <div className="rounded-card border border-line bg-card/80 p-6 shadow-xl sm:p-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <p className="text-[11px] font-semibold tracking-[0.18em] text-accent uppercase">
            Recorded Run Artifact
          </p>
          <span className="rounded-full bg-white/6 px-2 py-0.5 font-mono text-[10px] text-dim">
            {isLiveArtifact ? "Live API Connected" : "Baseline Replay Cohort"}
          </span>
        </div>
        <Link
          href={PERFORMANCE_HREF}
          className="text-[12px] font-medium text-accent underline decoration-accent/40 underline-offset-4 transition-colors hover:decoration-accent"
        >
          Open the benchmark lab
        </Link>
      </div>

      <dl className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map((tile) => (
          <div
            key={tile.label}
            className="min-w-0 rounded-[9px] border border-line/60 bg-[#101112] p-4"
          >
            <dt className="text-[12px] text-dim">{tile.label}</dt>
            <dd className="mt-1.5 font-mono text-[28px] leading-none font-bold tracking-tight text-white tabular-nums">
              {tile.value}
            </dd>
            <p className="mt-2 text-[11px] leading-5 text-dim">{tile.note}</p>
          </div>
        ))}
      </dl>

      <p className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-4 text-[11px] leading-5 text-dim">
        <span>
          {datasetLabel} · measured {measuredOn} · {hardware}
        </span>
        <span className="font-mono text-dim">Run ID: {runId}</span>
      </p>
    </div>
  );
}
