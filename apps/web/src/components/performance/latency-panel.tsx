"use client";

import { CHART, Chart, baseAxis, baseTooltip } from "@/components/performance/chart";
import { Panel } from "@/components/shared/states";
import type { LatencyStats, PerformanceSummary } from "@/lib/api-schemas";
import { formatInteger, formatMs } from "@/lib/formatters";

const API_LABEL: Record<string, string> = {
  health: "GET /api/health",
  alerts_limit_50: "GET /api/alerts (50)",
  benchmarks: "GET /api/benchmarks",
  cases: "GET /api/cases",
  investigation: "POST /api/investigations",
};

const QUERY_LABEL: Record<string, string> = {
  trace_funds: "Trace funds",
  inspect_counterparties: "Inspect counterparties",
  fan_out: "Fan-out",
  fan_in: "Fan-in",
  pass_through: "Pass-through",
};

type Row = { label: string; stats: LatencyStats };

function percentileOption(rows: Row[]) {
  return {
    grid: { left: 8, right: 16, top: 30, bottom: 8, containLabel: true },
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
      axisPointer: { type: "shadow" },
      valueFormatter: (v: number) => formatMs(v),
    },
    xAxis: { type: "value", ...baseAxis },
    yAxis: {
      type: "category",
      data: rows.map((r) => r.label),
      inverse: true,
      ...baseAxis,
      splitLine: { show: false },
    },
    series: (["p50_ms", "p95_ms"] as const).map((key, index) => ({
      type: "bar",
      name: key === "p50_ms" ? "P50" : "P95",
      barWidth: 8,
      barGap: "25%",
      itemStyle: { color: CHART.sequential[index], borderRadius: [0, 4, 4, 0] },
      data: rows.map((r) => r.stats[key]),
    })),
  };
}

function slowest(rows: Row[]): Row | null {
  return rows.reduce<Row | null>(
    (worst, row) => (!worst || row.stats.p95_ms > worst.stats.p95_ms ? row : worst),
    null,
  );
}

function LatencyTable({ rows, caption }: { rows: Row[]; caption: string }) {
  return (
    <details className="mt-2 text-xs">
      <summary className="cursor-pointer text-fg-secondary hover:text-fg">Show values</summary>
      <table className="mt-2 w-full">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-border text-left text-fg-muted">
            <th scope="col" className="py-1 font-medium">
              Operation
            </th>
            <th scope="col" className="py-1 text-right font-medium">
              Samples
            </th>
            <th scope="col" className="py-1 text-right font-medium">
              P50
            </th>
            <th scope="col" className="py-1 text-right font-medium">
              P95
            </th>
            <th scope="col" className="py-1 text-right font-medium">
              P99
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className="border-b border-border/50 last:border-0">
              <th scope="row" className="py-1 text-left font-normal text-fg">
                {row.label}
              </th>
              <td className="py-1 text-right text-fg-secondary">
                {formatInteger(row.stats.samples)}
              </td>
              <td className="py-1 text-right text-fg-secondary">{formatMs(row.stats.p50_ms)}</td>
              <td className="py-1 text-right text-fg-secondary">{formatMs(row.stats.p95_ms)}</td>
              <td className="py-1 text-right text-fg-secondary">
                {row.stats.p99_ms != null ? formatMs(row.stats.p99_ms) : "Not recorded"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}

function Stat({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-md border border-border bg-surface-sunken px-3 py-2.5">
      <p className="text-[11px] text-fg-muted">{label}</p>
      <p className="mt-0.5 text-base font-semibold text-fg">{value}</p>
      <p className="text-[11px] text-fg-muted">{detail}</p>
    </div>
  );
}

export function LatencyPanel({ performance }: { performance: PerformanceSummary }) {
  const apiRows: Row[] = Object.entries(performance.api).map(([key, stats]) => ({
    label: API_LABEL[key] ?? key,
    stats,
  }));
  const queryRows: Row[] = Object.entries(performance.graph_queries).map(([key, stats]) => ({
    label: QUERY_LABEL[key] ?? key,
    stats,
  }));
  const model = performance.model_inference;
  const apiSlowest = slowest(apiRows);
  const querySlowest = slowest(queryRows);

  return (
    <Panel
      title="Latency"
      description="Serial requests over loopback. Serial throughput is not concurrent capacity."
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <Chart
            title="API endpoints, milliseconds"
            option={percentileOption(apiRows)}
            height={210}
            summary={
              apiSlowest
                ? `Slowest at P95: ${apiSlowest.label}, ${formatMs(apiSlowest.stats.p95_ms)}.`
                : "No API timings recorded."
            }
          />
          <LatencyTable rows={apiRows} caption="API endpoint latency" />
        </div>
        <div>
          <Chart
            title="Graph tool queries, milliseconds"
            option={percentileOption(queryRows)}
            height={210}
            summary={
              querySlowest
                ? `Slowest at P95: ${querySlowest.label}, ${formatMs(querySlowest.stats.p95_ms)}.`
                : "No graph timings recorded."
            }
          />
          <LatencyTable rows={queryRows} caption="Graph query latency" />
        </div>
      </div>

      <h3 className="mt-6 text-xs font-semibold text-fg-secondary">Model scoring</h3>
      <div className="mt-2 grid gap-3 sm:grid-cols-3">
        <Stat
          label="One prepared row"
          value={formatMs(model.single_prepared_row.p50_ms)}
          detail={`P50; P95 ${formatMs(model.single_prepared_row.p95_ms)}`}
        />
        <Stat
          label="Full test cohort, one thread"
          value={`${formatInteger(Math.round(model.full_test_cohort.transactions_per_second))} tx/s`}
          detail={`${formatInteger(model.full_test_cohort.rows)} rows in ${model.full_test_cohort.median_seconds.toFixed(2)} s (median of ${model.full_test_cohort.repeats})`}
        />
        {model.full_test_cohort_all_threads ? (
          <Stat
            label={`Full test cohort, ${model.full_test_cohort_all_threads.threads} threads`}
            value={`${formatInteger(Math.round(model.full_test_cohort_all_threads.transactions_per_second))} tx/s`}
            detail={`${model.full_test_cohort_all_threads.median_seconds.toFixed(2)} s median`}
          />
        ) : (
          <Stat
            label="Multi-threaded cohort"
            value="Not measured"
            detail="No all-threads run recorded"
          />
        )}
      </div>
    </Panel>
  );
}
