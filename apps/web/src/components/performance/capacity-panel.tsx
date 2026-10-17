"use client";

import { TriangleAlert } from "lucide-react";

import { CHART, Chart, baseAxis, baseTooltip } from "@/components/performance/chart";
import { EmptyState, Panel } from "@/components/shared/states";
import type { CapacitySweep, PerformanceSummary } from "@/lib/api-schemas";
import { formatInteger, formatMs } from "@/lib/formatters";

type Sweep = { key: string; sweep: CapacitySweep };

function lineOption(sweeps: Sweep[], pick: "throughput_rps" | "p95_ms", unit: string) {
  return {
    grid: { left: 8, right: 16, top: 30, bottom: 24, containLabel: true },
    legend: {
      top: 0,
      left: 0,
      icon: "roundRect",
      itemWidth: 10,
      itemHeight: 10,
      textStyle: { color: CHART.textSecondary, fontSize: 11 },
    },
    tooltip: {
      ...baseTooltip,
      trigger: "axis",
      valueFormatter: (v: number) => (pick === "p95_ms" ? formatMs(v) : `${v.toFixed(0)} ${unit}`),
    },
    xAxis: {
      type: "log",
      logBase: 2,
      name: "Concurrent clients",
      nameLocation: "middle",
      nameGap: 22,
      ...baseAxis,
      splitLine: { show: false },
    },
    yAxis: { type: "value", ...baseAxis },
    series: sweeps.map(({ sweep }, index) => ({
      type: "line",
      name: `${sweep.workers} ${sweep.workers === 1 ? "worker" : "workers"}`,
      showSymbol: true,
      symbolSize: 8,
      lineStyle: { width: 2 },
      itemStyle: {
        color: CHART.series[index] ?? CHART.textMuted,
        borderColor: CHART.surface,
        borderWidth: 2,
      },
      data: sweep.levels.map((level) => [level.concurrency, level[pick]]),
    })),
  };
}

export function CapacityPanel({ performance }: { performance: PerformanceSummary }) {
  const sweeps = performance.concurrency?.sweeps;
  if (!sweeps || Object.keys(sweeps).length === 0) {
    return (
      <Panel title="Capacity under concurrency">
        <EmptyState icon={TriangleAlert} title="No concurrency sweep was recorded">
          Only serial latency is available, which does not measure concurrent capacity.
        </EmptyState>
      </Panel>
    );
  }

  const byEndpoint = new Map<string, Sweep[]>();
  for (const [key, sweep] of Object.entries(sweeps)) {
    const list = byEndpoint.get(sweep.endpoint) ?? [];
    list.push({ key, sweep });
    byEndpoint.set(
      sweep.endpoint,
      list.sort((a, b) => a.sweep.workers - b.sweep.workers),
    );
  }

  return (
    <Panel
      title="Capacity under concurrency"
      description="Closed-loop sweeps against a real API process. Throughput and tail latency are separate charts, never a shared axis."
    >
      <div className="space-y-6">
        {[...byEndpoint.entries()].map(([endpoint, list]) => {
          const peak = list.reduce((best, s) =>
            s.sweep.peak_throughput_rps > best.sweep.peak_throughput_rps ? s : best,
          );
          return (
            <section key={endpoint} aria-label={endpoint}>
              <h3 className="font-mono text-xs text-fg">{endpoint}</h3>
              <div className="mt-2 grid gap-6 lg:grid-cols-2">
                <Chart
                  title="Throughput, requests per second"
                  option={lineOption(list, "throughput_rps", "req/s")}
                  height={220}
                  summary={`Peak ${formatInteger(Math.round(peak.sweep.peak_throughput_rps))} req/s with ${peak.sweep.workers} ${peak.sweep.workers === 1 ? "worker" : "workers"}${peak.sweep.knee_concurrency ? `; throughput stops scaling near ${peak.sweep.knee_concurrency} clients` : ""}.`}
                />
                <Chart
                  title="P95 latency, milliseconds"
                  option={lineOption(list, "p95_ms", "ms")}
                  height={220}
                  summary={list
                    .map(({ sweep }) =>
                      sweep.first_error_concurrency
                        ? `${sweep.workers}w: first errors at ${sweep.first_error_concurrency} clients`
                        : `${sweep.workers}w: no errors up to ${Math.max(...sweep.levels.map((l) => l.concurrency))} clients`,
                    )
                    .join("; ")}
                />
              </div>
            </section>
          );
        })}
      </div>
      <p className="mt-4 text-[11px] text-fg-muted">
        {performance.concurrency?.falkordb_thread_count != null
          ? `FalkorDB ran with ${performance.concurrency.falkordb_thread_count} threads. `
          : ""}
        Each sweep holds a fixed number of clients for its duration; see the run notes above for
        host conditions.
      </p>
    </Panel>
  );
}
