"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ApiError, benchmarksQuery, type ModelBenchmark } from "../lib/api";
import { formatCount, formatPercent } from "../lib/format";
import { EmptyPanel, ErrorPanel, LoadingPanel } from "../components/status";

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.detail;
  return "Something went wrong while loading benchmarks.";
}

interface ChartRow {
  model: string;
  averagePrecision: number;
}

function ModelSection({ name, benchmark }: { name: string; benchmark: ModelBenchmark }) {
  const threshold = benchmark.test_at_val_threshold;
  const budget = benchmark.test_at_alert_budget;
  const splits = Object.entries(benchmark.splits);
  return (
    <section
      aria-label={`${name} benchmark`}
      className="flex flex-col gap-4 rounded-lg border border-[#292936] bg-[#12121A] p-4"
    >
      <h2 className="font-mono text-sm font-semibold">{name}</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <h3 className="text-xs font-medium text-[#9693A8]">
            Average precision (recorded)
          </h3>
          <dl className="mt-2 space-y-1 font-mono text-xs">
            {Object.entries(benchmark.average_precision).map(([split, value]) => (
              <div key={split} className="flex justify-between gap-4">
                <dt className="text-[#9693A8]">{split}</dt>
                <dd>{value.toFixed(4)}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div>
          <h3 className="text-xs font-medium text-[#9693A8]">
            Test at validation threshold {benchmark.val_threshold_max_f1.toFixed(4)}
          </h3>
          <dl className="mt-2 space-y-1 font-mono text-xs">
            <div className="flex justify-between gap-4">
              <dt className="text-[#9693A8]">precision</dt>
              <dd>{threshold.precision.toFixed(4)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-[#9693A8]">recall</dt>
              <dd>{threshold.recall.toFixed(4)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-[#9693A8]">f1</dt>
              <dd>{threshold.f1.toFixed(4)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-[#9693A8]">true / false positives</dt>
              <dd>
                {formatCount(threshold.true_positives)} /{" "}
                {formatCount(threshold.false_positives)}
              </dd>
            </div>
          </dl>
        </div>
      </div>
      <div>
        <h3 className="text-xs font-medium text-[#9693A8]">
          Fixed review capacity (budget {(budget.budget * 100).toFixed(1)}%)
        </h3>
        <p className="mt-2 font-mono text-xs">
          {formatCount(budget.alerts)} alerts · {formatCount(budget.true_positives)}{" "}
          true positives · precision {budget.precision.toFixed(4)} · recall{" "}
          {budget.recall.toFixed(4)}
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] border-collapse text-left text-xs">
          <caption className="py-2 text-left text-[#9693A8]">
            Per-split rows, prevalence, and threshold-selected alerts.
          </caption>
          <thead>
            <tr className="border-b border-[#292936] text-[#9693A8]">
              <th scope="col" className="py-2 pr-4 font-medium">
                Split
              </th>
              <th scope="col" className="py-2 pr-4 font-medium">
                Rows
              </th>
              <th scope="col" className="py-2 pr-4 font-medium">
                Prevalence
              </th>
              <th scope="col" className="py-2 pr-4 font-medium">
                Alerts
              </th>
              <th scope="col" className="py-2 font-medium">
                P / R
              </th>
            </tr>
          </thead>
          <tbody className="font-mono">
            {splits.map(([split, row]) => (
              <tr key={split} className="border-b border-[#292936] last:border-0">
                <td className="py-2 pr-4">{split}</td>
                <td className="py-2 pr-4">{formatCount(row.rows)}</td>
                <td className="py-2 pr-4">{formatPercent(row.prevalence)}</td>
                <td className="py-2 pr-4">{formatCount(row.alerts)}</td>
                <td className="py-2">
                  {row.precision.toFixed(4)} / {row.recall.toFixed(4)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function BenchmarksPage() {
  const query = useQuery(benchmarksQuery);
  const entries = query.data ? Object.entries(query.data.models) : [];
  const chartData: ChartRow[] = entries.map(([model, benchmark]) => ({
    model,
    averagePrecision: benchmark.average_precision.test ?? Number.NaN,
  }));

  return (
    <main className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Benchmarks</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#9693A8]">
          Recorded offline metrics on the frozen test cohort. Values come from
          the API; no unmeasured claims are shown.
        </p>
      </header>

      <div aria-live="polite" className="sr-only">
        {query.isPending
          ? "Loading benchmarks."
          : query.isError
            ? "Benchmarks failed to load."
            : `${entries.length} models reported.`}
      </div>

      {query.isPending ? (
        <LoadingPanel
          title="Loading benchmarks"
          message="Reading recorded run metrics from the API."
          label="Benchmarks loading"
        />
      ) : query.isError ? (
        <ErrorPanel
          title="Benchmarks unavailable"
          message={errorMessage(query.error)}
          label="Benchmarks error"
          onRetry={() => query.refetch()}
        />
      ) : entries.length === 0 ? (
        <EmptyPanel
          title="No benchmark runs"
          message="The API returned no recorded model results."
          label="Benchmarks empty"
        />
      ) : (
        <div className="flex flex-col gap-6">
          <section
            aria-label="Test average precision by model"
            className="rounded-lg border border-[#292936] bg-[#12121A] p-4"
          >
            <h2 className="text-sm font-semibold">
              Test average precision (recorded)
            </h2>
            <div className="mt-2 h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartData}
                  margin={{ top: 8, right: 8, bottom: 8, left: 8 }}
                >
                  <CartesianGrid stroke="#292936" strokeDasharray="3 3" />
                  <XAxis dataKey="model" tick={{ fill: "#9693A8", fontSize: 12 }} />
                  <YAxis
                    tick={{ fill: "#9693A8", fontSize: 12 }}
                    domain={[0, 1]}
                    tickFormatter={(value: number) => value.toFixed(2)}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#191923",
                      border: "1px solid #292936",
                      fontSize: 12,
                    }}
                    formatter={(value) => [
                      typeof value === "number" ? value.toFixed(4) : value,
                      "AP",
                    ]}
                  />
                  <Bar dataKey="averagePrecision" fill="#B68CFF" name="Test AP" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
          {entries.map(([name, benchmark]) => (
            <ModelSection key={name} name={name} benchmark={benchmark} />
          ))}
        </div>
      )}
    </main>
  );
}
