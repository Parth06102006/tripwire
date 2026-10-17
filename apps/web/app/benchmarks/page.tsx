"use client";

import { useQuery } from "@tanstack/react-query";
import { Maximize2, Minimize2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import PerformanceSection from "../components/benchmarks/performance-section";
import { Card, CardHeader, Metadata, cx } from "../components/ui/card";
import { IconButton } from "../components/ui/controls";
import { KpiCard } from "../components/ui/kpi-card";
import { Disclosure } from "../components/ui/motion";
import { PageHeader } from "../components/ui/page-header";
import { EmptyState, ErrorState, LoadingState } from "../components/ui/states";
import { ApiError, benchmarksQuery, type ModelBenchmark } from "../lib/api";
import { formatCount, formatPercent } from "../lib/format";
import { useChartColors } from "../lib/tokens";

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.detail;
  return "Something went wrong while loading benchmarks.";
}


function ChartCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <Card aria-label={title}>
      <CardHeader
        title={title}
        description={description}
        actions={
          <IconButton
            label={expanded ? "Collapse chart" : "Expand chart"}
            aria-pressed={expanded}
            onClick={() => setExpanded((value) => !value)}
          >
            {expanded ? (
              <Minimize2 aria-hidden="true" className="h-4 w-4" />
            ) : (
              <Maximize2 aria-hidden="true" className="h-4 w-4" />
            )}
          </IconButton>
        }
      />
      <div
        className={cx(
          "w-full transition-[height] duration-[var(--motion-panel)] ease-[var(--ease-out)]",
          expanded ? "h-[420px]" : "h-[260px]",
        )}
      >
        {children}
      </div>
    </Card>
  );
}

export default function BenchmarksPage() {
  const query = useQuery(benchmarksQuery);
  const c = useChartColors();
  const SERIES_COLORS = { first: c.ink, second: c.dim, third: c.accent };
  const tooltipStyle = { backgroundColor: c.raised, border: `1px solid ${c.lineStrong}`, borderRadius: 8, fontSize: 12, color: c.ink };
  const entries = query.data ? Object.entries(query.data.models) : [];
  const [chosen, setChosen] = useState<string | null>(null);
  const selectedName = chosen && query.data?.models[chosen] ? chosen : (entries[0]?.[0] ?? null);
  const selected: ModelBenchmark | null = selectedName ? query.data?.models[selectedName] ?? null : null;
  const performance = query.data?.performance ?? null;

  const thresholdData = entries.map(([model, benchmark]) => ({
    model,
    Precision: benchmark.test_at_val_threshold.precision,
    Recall: benchmark.test_at_val_threshold.recall,
    F1: benchmark.test_at_val_threshold.f1,
  }));

  const splitNames = [...new Set(entries.flatMap(([, benchmark]) => Object.keys(benchmark.average_precision)))];
  const apData = entries.map(([model, benchmark]) => ({
    model,
    ...Object.fromEntries(splitNames.map((split) => [split, benchmark.average_precision[split] ?? null])),
  }));
  const splitColors = [SERIES_COLORS.second, SERIES_COLORS.first, SERIES_COLORS.third];

  const metricState = (value: number | undefined) =>
    value === undefined || !Number.isFinite(value)
      ? ({ kind: "unavailable", message: "Not reported for this model" } as const)
      : ({ kind: "ready", value: value.toFixed(4) } as const);

  const testSplit = selected?.splits.test;

  return (
    <>
      <PageHeader
        title="Benchmarks"
        description="Recorded offline results on the frozen test cohort. Values come from the API's run artifact; nothing is estimated in the browser."
        actions={
          entries.length > 1 ? (
            <label className="flex items-center gap-2 text-xs text-dim">
              Model
              <select
                value={selectedName ?? ""}
                onChange={(event) => setChosen(event.target.value)}
                className="rounded-control border border-line-strong bg-raised px-2 py-1.5 text-xs text-ink"
              >
                {entries.map(([name]) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
          ) : null
        }
      />

      <div aria-live="polite" className="sr-only">
        {query.isPending ? "Loading benchmarks." : query.isError ? "Benchmarks failed to load." : `${entries.length} models reported.`}
      </div>

      {query.isPending ? (
        <LoadingState label="Loading benchmarks" lines={5} />
      ) : query.isError ? (
        <ErrorState
          label="Benchmarks error"
          title="Benchmarks unavailable"
          message={errorMessage(query.error)}
          onRetry={() => query.refetch()}
        />
      ) : entries.length === 0 || !selected || !selectedName ? (
        <EmptyState label="Benchmarks empty" title="No benchmark runs" message="The API returned no recorded model results." />
      ) : (
        <>
          <Card aria-label="Evaluation context">
            <CardHeader title="Evaluation context" description="What these numbers describe." />
            <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Metadata label="Dataset">{performance?.dataset_label ?? "Not reported in the artifact"}</Metadata>
              <Metadata label="Selected model">{selectedName}</Metadata>
              <Metadata label="Cohort">
                Frozen test split{testSplit ? `, ${formatCount(testSplit.rows)} rows, ${formatPercent(testSplit.prevalence)} positive` : ""}
              </Metadata>
              <Metadata label="Threshold">
                Chosen on validation: {selected.val_threshold_max_f1.toFixed(4)}
              </Metadata>
              <Metadata label="Run">{performance?.run_id ?? "Not reported"}</Metadata>
              <Metadata label="Code revision">{performance?.git_commit ?? "Not reported"}</Metadata>
              <Metadata label="Measured on">{performance?.measured_on ?? "Not reported"}</Metadata>
              <Metadata label="Models compared">{entries.length}</Metadata>
            </dl>
          </Card>

          <section aria-label="Test metrics" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard label="Precision" state={metricState(selected.test_at_val_threshold.precision)} note="Test, at validation threshold" />
            <KpiCard label="Recall" state={metricState(selected.test_at_val_threshold.recall)} note="Test, at validation threshold" />
            <KpiCard label="F1" state={metricState(selected.test_at_val_threshold.f1)} note="Test, at validation threshold" />
            <KpiCard label="Average precision" state={metricState(selected.average_precision.test)} note="Test, threshold independent" />
          </section>

          <div className="grid gap-4 xl:grid-cols-2">
            <ChartCard
              title="Model comparison"
              description="Precision, recall and F1 on the test cohort at each model's validation-selected threshold."
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={thresholdData} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
                  <CartesianGrid stroke={c.line} vertical={false} />
                  <XAxis dataKey="model" tick={{ fill: c.dim, fontSize: 12 }} stroke={c.lineStrong} />
                  <YAxis
                    domain={[0, 1]}
                    tick={{ fill: c.dim, fontSize: 12 }}
                    stroke={c.lineStrong}
                    tickFormatter={(value: number) => value.toFixed(1)}
                    label={{ value: "Score (0 to 1)", angle: -90, position: "insideLeft", fill: c.dim, fontSize: 11 }}
                  />
                  <Tooltip contentStyle={tooltipStyle} cursor={{ fill: c.hover }} formatter={(value) => (typeof value === "number" ? value.toFixed(4) : String(value))} />
                  <Legend wrapperStyle={{ fontSize: 12, color: c.dim }} />
                  <Bar dataKey="Precision" fill={SERIES_COLORS.second} radius={[3, 3, 0, 0]} />
                  <Bar dataKey="Recall" fill={SERIES_COLORS.first} radius={[3, 3, 0, 0]} />
                  <Bar dataKey="F1" fill={SERIES_COLORS.third} radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard
              title="Cohort comparison"
              description="Average precision by split. Gaps between splits show how far training results carry to unseen data."
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={apData} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
                  <CartesianGrid stroke={c.line} vertical={false} />
                  <XAxis dataKey="model" tick={{ fill: c.dim, fontSize: 12 }} stroke={c.lineStrong} />
                  <YAxis
                    domain={[0, 1]}
                    tick={{ fill: c.dim, fontSize: 12 }}
                    stroke={c.lineStrong}
                    tickFormatter={(value: number) => value.toFixed(1)}
                    label={{ value: "Average precision", angle: -90, position: "insideLeft", fill: c.dim, fontSize: 11 }}
                  />
                  <Tooltip contentStyle={tooltipStyle} cursor={{ fill: c.hover }} formatter={(value) => (typeof value === "number" ? value.toFixed(4) : String(value))} />
                  <Legend wrapperStyle={{ fontSize: 12, color: c.dim }} />
                  {splitNames.map((split, index) => (
                    <Bar key={split} dataKey={split} fill={splitColors[index % splitColors.length]} radius={[3, 3, 0, 0]} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          <Card aria-label="Experiment results" padded={false}>
            <div className="p-4 pb-0 sm:px-6 sm:pt-6">
              <CardHeader
                title="Experiment results"
                description="One row per recorded model. Test metrics at the validation-selected threshold, plus the fixed review-capacity result."
              />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] border-collapse text-left text-xs">
                <thead>
                  <tr className="border-y border-line text-dim">
                    <th scope="col" className="px-4 py-2 font-medium sm:pl-6">Model</th>
                    <th scope="col" className="px-4 py-2 font-medium">Threshold</th>
                    <th scope="col" className="px-4 py-2 font-medium">AP (test)</th>
                    <th scope="col" className="px-4 py-2 font-medium">Precision</th>
                    <th scope="col" className="px-4 py-2 font-medium">Recall</th>
                    <th scope="col" className="px-4 py-2 font-medium">F1</th>
                    <th scope="col" className="px-4 py-2 font-medium">TP / FP</th>
                    <th scope="col" className="px-4 py-2 font-medium sm:pr-6">At {(selected.test_at_alert_budget.budget * 100).toFixed(1)}% review budget</th>
                  </tr>
                </thead>
                <tbody className="font-mono tabular-nums">
                  {entries.map(([name, benchmark]) => (
                    <tr
                      key={name}
                      aria-selected={name === selectedName}
                      className={cx("selectable border-b border-line last:border-0 hover:bg-hover", name === selectedName && "bg-accent-soft")}
                    >
                      <td className="px-4 py-2.5 font-sans sm:pl-6">
                        <button type="button" onClick={() => setChosen(name)} className="text-accent hover:underline">
                          {name}
                        </button>
                      </td>
                      <td className="px-4 py-2.5">{benchmark.val_threshold_max_f1.toFixed(4)}</td>
                      <td className="px-4 py-2.5">{benchmark.average_precision.test?.toFixed(4) ?? "—"}</td>
                      <td className="px-4 py-2.5">{benchmark.test_at_val_threshold.precision.toFixed(4)}</td>
                      <td className="px-4 py-2.5">{benchmark.test_at_val_threshold.recall.toFixed(4)}</td>
                      <td className="px-4 py-2.5">{benchmark.test_at_val_threshold.f1.toFixed(4)}</td>
                      <td className="px-4 py-2.5">
                        {formatCount(benchmark.test_at_val_threshold.true_positives)} / {formatCount(benchmark.test_at_val_threshold.false_positives)}
                      </td>
                      <td className="px-4 py-2.5 sm:pr-6">
                        P {benchmark.test_at_alert_budget.precision.toFixed(4)} · R {benchmark.test_at_alert_budget.recall.toFixed(4)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="border-t border-line p-4 sm:px-6">
              <Disclosure title={`Per-split detail for ${selectedName}`}>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[520px] border-collapse text-left text-xs">
                    <thead>
                      <tr className="border-b border-line text-dim">
                        <th scope="col" className="py-2 pr-4 font-medium">Split</th>
                        <th scope="col" className="py-2 pr-4 font-medium">Rows</th>
                        <th scope="col" className="py-2 pr-4 font-medium">Prevalence</th>
                        <th scope="col" className="py-2 pr-4 font-medium">Alerts</th>
                        <th scope="col" className="py-2 font-medium">Precision / recall</th>
                      </tr>
                    </thead>
                    <tbody className="font-mono">
                      {Object.entries(selected.splits).map(([split, row]) => (
                        <tr key={split} className="border-b border-line last:border-0">
                          <td className="py-2 pr-4">{split}</td>
                          <td className="py-2 pr-4">{formatCount(row.rows)}</td>
                          <td className="py-2 pr-4">{formatPercent(row.prevalence)}</td>
                          <td className="py-2 pr-4">{formatCount(row.alerts)}</td>
                          <td className="py-2">{row.precision.toFixed(4)} / {row.recall.toFixed(4)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Disclosure>
            </div>
          </Card>

          {performance ? <PerformanceSection performance={performance} /> : null}

          <Card aria-label="Evaluation notes">
            <CardHeader title="Definitions, limitations and caveats" />
            <div className="grid gap-6 text-xs leading-5 text-dim lg:grid-cols-2">
              <div>
                <h3 className="mb-1 text-sm font-medium text-ink">Definitions</h3>
                <ul className="list-disc space-y-1 pl-4">
                  <li><span className="text-ink">Precision</span>: of the transactions the policy flagged, the share that are labelled positive in the offline evaluation data.</li>
                  <li><span className="text-ink">Recall</span>: of all labelled positives, the share the policy flagged.</li>
                  <li><span className="text-ink">F1</span>: harmonic mean of precision and recall at one threshold.</li>
                  <li><span className="text-ink">Average precision</span>: area under the precision-recall curve; needs no threshold.</li>
                </ul>
              </div>
              <div>
                <h3 className="mb-1 text-sm font-medium text-ink">Read with care</h3>
                <ul className="list-disc space-y-1 pl-4">
                  <li>Data is synthetic IBM AMLworld HI-Small. Results do not transfer to a real bank without re-evaluation.</li>
                  <li>Labels and typology truth live only in offline evaluation data; the inference graph never sees them.</li>
                  <li>The threshold is tuned on training and validation only. The test cohort is frozen.</li>
                  <li>Models are compared on one frozen cohort with no significance test, so small gaps do not establish that one model is better.</li>
                  <li>Runtime figures are recorded benchmark runs on the stated hardware, and API rates are serial, not capacity.</li>
                </ul>
              </div>
            </div>
          </Card>
        </>
      )}
    </>
  );
}
