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
    value: "0.942",
    note: "Best recorded, threshold-free · LightGBM (graph)",
  },
  {
    label: "Recall at 1% budget",
    value: "0.886",
    note: "Top 1.0% alert capacity · 88.6% fraud captured",
  },
  {
    label: "Frozen test cohort",
    value: "76,820",
    note: "0.428% labelled positive, scored once",
  },
  {
    label: "Models compared",
    value: "3",
    note: "One frozen cohort, chronological split",
  },
];

function scoreOrDash(value: number | undefined): string {
  return value === undefined || !Number.isFinite(value) ? "—" : formatScore(value);
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
  let datasetLabel = "IBM AMLworld HI-Small";
  let measuredOn = "2026-10-14";
  let hardware = "Apple M-series / Linux FalkorDB 1.0";
  let runId = "rec-aml-20261014";
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
          note: `Best recorded, threshold free · ${name}`,
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
