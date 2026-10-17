"use client";

import {
  CHART,
  Chart,
  baseAxis,
  baseTooltip,
  modelColor,
  modelLabel,
  modelShortLabel,
} from "@/components/performance/chart";
import { Panel } from "@/components/shared/states";
import type { ModelBenchmark } from "@/lib/api-schemas";
import { formatInteger, formatPercent } from "@/lib/formatters";

type Models = Record<string, ModelBenchmark>;

const pct = (value: number) => `${(value * 100).toFixed(1)}%`;

/** Test rows dated Sept 9 and 10: where almost all test positives are hard to find. */
const BULK = "test_bulk_sept_9_10";

function bestBy(models: Models, pick: (m: ModelBenchmark) => number): [string, number] | null {
  let best: [string, number] | null = null;
  for (const [name, model] of Object.entries(models)) {
    const value = pick(model);
    if (!best || value > best[1]) best = [name, value];
  }
  return best;
}

export function DetectionBenchmarks({ models }: { models: Models }) {
  const names = Object.keys(models);
  const budget = Object.values(models)[0]?.test_at_alert_budget.budget;
  const bestAp = bestBy(models, (m) => m.average_precision.test ?? 0);
  const bestBulk = bestBy(models, (m) => m.average_precision[BULK] ?? 0);
  const hasBulk = Object.values(models).every((m) => m.average_precision[BULK] !== undefined);
  const bestRecall = bestBy(models, (m) => m.test_at_alert_budget.recall);

  const apOption = {
    grid: { left: 8, right: 56, top: 8, bottom: 8, containLabel: true },
    tooltip: {
      ...baseTooltip,
      trigger: "item",
      valueFormatter: (value: number) => value.toFixed(4),
    },
    xAxis: {
      type: "value",
      max: 1,
      ...baseAxis,
      axisLabel: { ...baseAxis.axisLabel, formatter: (v: number) => v.toFixed(1) },
    },
    yAxis: {
      type: "category",
      data: names.map(modelShortLabel),
      inverse: true,
      ...baseAxis,
      splitLine: { show: false },
    },
    series: [
      {
        type: "bar",
        name: "Full test cohort",
        barWidth: 10,
        barGap: "20%",
        data: names.map((name) => ({
          value: models[name]?.average_precision.test ?? null,
          itemStyle: { color: modelColor(name), opacity: 0.4, borderRadius: [0, 4, 4, 0] },
        })),
        label: {
          show: true,
          position: "right",
          color: CHART.textSecondary,
          fontSize: 11,
          formatter: ({ value }: { value: number }) => value.toFixed(4),
        },
      },
      ...(hasBulk
        ? [
            {
              type: "bar",
              name: "Sept 9-10 bulk",
              barWidth: 10,
              data: names.map((name) => ({
                value: models[name]?.average_precision[BULK] ?? null,
                itemStyle: { color: modelColor(name), borderRadius: [0, 4, 4, 0] },
              })),
              label: {
                show: true,
                position: "right",
                color: CHART.text,
                fontSize: 11,
                formatter: ({ value }: { value: number }) => value.toFixed(4),
              },
            },
          ]
        : []),
    ],
  };

  const metrics = [
    { label: "Recall at budget", pick: (m: ModelBenchmark) => m.test_at_alert_budget.recall },
    { label: "Precision at budget", pick: (m: ModelBenchmark) => m.test_at_alert_budget.precision },
    { label: "Recall at threshold", pick: (m: ModelBenchmark) => m.test_at_val_threshold.recall },
    {
      label: "Precision at threshold",
      pick: (m: ModelBenchmark) => m.test_at_val_threshold.precision,
    },
  ];

  const compareOption = {
    grid: { left: 8, right: 8, top: 36, bottom: 8, containLabel: true },
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
      valueFormatter: (value: number) => pct(value),
    },
    xAxis: {
      type: "category",
      data: metrics.map((m) => m.label),
      ...baseAxis,
      splitLine: { show: false },
    },
    yAxis: {
      type: "value",
      max: 1,
      ...baseAxis,
      axisLabel: { ...baseAxis.axisLabel, formatter: (v: number) => `${v * 100}%` },
    },
    series: names.map((name) => ({
      type: "bar",
      name: modelShortLabel(name),
      barGap: "15%",
      itemStyle: { color: modelColor(name), borderRadius: [4, 4, 0, 0] },
      data: metrics.map((metric) => {
        const model = models[name];
        return model ? metric.pick(model) : null;
      }),
    })),
  };

  return (
    <Panel
      title="Detection on the frozen test cohort"
      description="Every model is scored on the same held-out cohort. Thresholds were chosen on validation data before test labels were read."
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <Chart
          title={
            hasBulk
              ? "Average precision, test: full cohort and Sept 9-10 bulk"
              : "Average precision, test"
          }
          option={apOption}
          height={hasBulk ? 250 : 150}
          summary={
            bestAp
              ? `${modelLabel(bestAp[0])} has the highest test average precision at ${bestAp[1].toFixed(4)}${
                  hasBulk && bestBulk
                    ? `, and ${bestBulk[1].toFixed(4)} on the Sept 9-10 bulk${bestBulk[0] === bestAp[0] ? "" : ` (best there: ${modelLabel(bestBulk[0])})`}`
                    : ""
                }. ${hasBulk ? "Lighter bars are the full cohort, solid bars the bulk." : ""}`
              : "No models reported."
          }
        />
        <Chart
          title={`Recall and precision at the ${budget !== undefined ? formatPercent(budget, 1) : "fixed"} alert budget and at the validation threshold`}
          option={compareOption}
          height={hasBulk ? 280 : 240}
          summary={
            bestRecall
              ? `At the alert budget, ${modelLabel(bestRecall[0])} recalls the most laundering transactions: ${pct(bestRecall[1])}.`
              : "No models reported."
          }
        />
      </div>

      {hasBulk ? (
        <p className="mt-4 rounded-md border border-border bg-surface-sunken px-3 py-2 text-xs text-fg-secondary">
          Read the bulk figures first. The last 1,108 test rows (Sept 11 to 18, 59% positive) are
          near-separable for every model, so full-cohort average precision and budget recall are
          inflated by them. Sept 9 to 10 holds 760,531 of the 761,639 test rows and is the
          representative comparison.
        </p>
      ) : null}

      <div className="mt-6 scrollbar-thin overflow-x-auto">
        <table className="w-full min-w-[860px] text-xs">
          <caption className="mb-2 text-left text-xs text-fg-secondary">
            Exact values from the benchmark artifact
          </caption>
          <thead>
            <tr className="border-b border-border text-left text-fg-muted">
              <th scope="col" className="py-1.5 pr-3 font-medium">
                Model
              </th>
              <th scope="col" className="py-1.5 pr-3 text-right font-medium">
                AP train
              </th>
              <th scope="col" className="py-1.5 pr-3 text-right font-medium">
                AP validation
              </th>
              <th scope="col" className="py-1.5 pr-3 text-right font-medium">
                AP test
              </th>
              {hasBulk ? (
                <th scope="col" className="py-1.5 pr-3 text-right font-medium">
                  AP Sept 9-10
                </th>
              ) : null}
              <th scope="col" className="py-1.5 pr-3 text-right font-medium">
                Threshold
              </th>
              <th scope="col" className="py-1.5 pr-3 text-right font-medium">
                F1
              </th>
              <th scope="col" className="py-1.5 pr-3 text-right font-medium">
                TP / FP at threshold
              </th>
              <th scope="col" className="py-1.5 pr-3 text-right font-medium">
                Alerts at budget
              </th>
              <th scope="col" className="py-1.5 text-right font-medium">
                TP at budget
              </th>
            </tr>
          </thead>
          <tbody>
            {names.map((name) => {
              const m = models[name];
              if (!m) return null;
              const ap = (split: string) => {
                const value = m.average_precision[split];
                return value === undefined ? "Not reported" : value.toFixed(4);
              };
              return (
                <tr key={name} className="border-b border-border/60 last:border-0">
                  <th scope="row" className="py-1.5 pr-3 text-left font-normal text-fg">
                    <span
                      className="mr-2 inline-block size-2 rounded-full"
                      style={{ background: modelColor(name) }}
                      aria-hidden
                    />
                    {modelLabel(name)}
                  </th>
                  <td className="py-1.5 pr-3 text-right text-fg-secondary">{ap("train")}</td>
                  <td className="py-1.5 pr-3 text-right text-fg-secondary">{ap("validation")}</td>
                  <td className="py-1.5 pr-3 text-right text-fg">{ap("test")}</td>
                  {hasBulk ? <td className="py-1.5 pr-3 text-right text-fg">{ap(BULK)}</td> : null}
                  <td className="py-1.5 pr-3 text-right text-fg-secondary">
                    {m.val_threshold_max_f1.toFixed(4)}
                  </td>
                  <td className="py-1.5 pr-3 text-right text-fg-secondary">
                    {m.test_at_val_threshold.f1.toFixed(4)}
                  </td>
                  <td className="py-1.5 pr-3 text-right text-fg-secondary">
                    {formatInteger(m.test_at_val_threshold.true_positives)} /{" "}
                    {formatInteger(m.test_at_val_threshold.false_positives)}
                  </td>
                  <td className="py-1.5 pr-3 text-right text-fg-secondary">
                    {formatInteger(m.test_at_alert_budget.alerts)}
                  </td>
                  <td className="py-1.5 text-right text-fg-secondary">
                    {formatInteger(m.test_at_alert_budget.true_positives)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-[11px] text-fg-muted">
        No precision-recall curve is drawn: the API serves aggregate metrics only, and curve points
        are not derived from them. A gap between train and test average precision is shown as
        recorded.
      </p>
    </Panel>
  );
}
