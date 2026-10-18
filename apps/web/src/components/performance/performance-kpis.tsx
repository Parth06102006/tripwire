"use client";

import { Activity, Cpu, Database, Gauge, TrendingUp } from "lucide-react";
import type { ReactNode } from "react";

import { modelShortLabel } from "@/components/performance/chart";
import type { ModelBenchmark, PerformanceSummary } from "@/lib/api-schemas";
import { formatMs, formatPercent, formatUsd } from "@/lib/formatters";

type Models = Record<string, ModelBenchmark>;

function Scorecard({
  icon: Icon,
  label,
  value,
  subvalue,
  badge,
  detail,
}: {
  icon: typeof Gauge;
  label: string;
  value: ReactNode;
  subvalue?: ReactNode;
  badge?: ReactNode;
  detail: ReactNode;
}) {
  return (
    <div className="flex flex-col justify-between rounded-lg border border-border bg-surface p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-fg-secondary">{label}</span>
        <div className="flex items-center gap-1.5">
          {badge}
          <Icon className="size-3.5 text-fg-muted" aria-hidden />
        </div>
      </div>

      <div className="mt-2.5">
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-xl font-bold tracking-tight text-fg sm:text-2xl">
            {value}
          </span>
          {subvalue ? <span className="text-xs text-fg-muted">{subvalue}</span> : null}
        </div>
        <p className="mt-1 text-2xs leading-relaxed text-fg-muted">{detail}</p>
      </div>
    </div>
  );
}

export function PerformanceKpis({
  models,
  performance,
}: {
  models: Models;
  performance?: PerformanceSummary | null;
}) {
  const entries = Object.entries(models);
  if (entries.length === 0) return null;

  // Dynamically find the champion model (highest test AP) and baseline model (lowest test AP)
  const sorted = [...entries].sort(
    (a, b) => (b[1].average_precision.test ?? 0) - (a[1].average_precision.test ?? 0),
  );
  const champion = sorted[0];
  const baseline = sorted[sorted.length - 1];
  if (!champion || !baseline) return null;
  const [championName, championModel] = champion;
  const [baselineName, baselineModel] = baseline;

  const championAp = championModel.average_precision.test;
  const baselineAp = baselineModel.average_precision.test;
  const apUplift =
    championAp != null && baselineAp != null && baselineAp > 0
      ? ((championAp - baselineAp) / baselineAp) * 100
      : null;

  const bulkCohortAp = championModel.average_precision.test_bulk_sept_9_10;
  const recallAtBudget = championModel.test_at_alert_budget.recall;
  const precisionAtBudget = championModel.test_at_alert_budget.precision;
  const budgetShare = championModel.test_at_alert_budget.budget * 100;

  // Graph traversal tail latency dynamically from recorded queries
  const traceP95 = performance?.graph_queries.trace_funds.p95_ms;
  const inspectP95 = performance?.graph_queries.inspect_counterparties.p95_ms;
  const maxP95 =
    traceP95 != null && inspectP95 != null
      ? Math.max(traceP95, inspectP95)
      : (traceP95 ?? inspectP95);

  // Scoring cost dynamically from cost status
  const scoringCostPer1k = performance?.cost.scoring_usd_per_1000_transactions;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Scorecard
        icon={TrendingUp}
        label="Champion detection AP"
        value={championAp != null ? championAp.toFixed(4) : "N/A"}
        subvalue={modelShortLabel(championName)}
        badge={
          apUplift != null && apUplift > 0 ? (
            <span className="inline-flex items-center rounded-full bg-safe/10 px-2 py-0.5 font-mono text-2xs font-medium text-safe">
              +{apUplift.toFixed(0)}% vs {modelShortLabel(baselineName)}
            </span>
          ) : null
        }
        detail="Average precision on held-out test cohort across all laundering typologies"
      />

      <Scorecard
        icon={Activity}
        label="Hard cohort detection (Bulk)"
        value={bulkCohortAp != null ? bulkCohortAp.toFixed(4) : "N/A"}
        subvalue="Sept 9-10 bulk"
        badge={
          <span className="rounded bg-accent/15 px-1.5 py-0.5 font-mono text-2xs text-accent">
            Hard split
          </span>
        }
        detail="Detection accuracy on hard bulk transactions where laundered volume concentrates"
      />

      <Scorecard
        icon={Gauge}
        label="Precision at alert budget"
        value={precisionAtBudget != null ? formatPercent(precisionAtBudget) : "N/A"}
        subvalue={`at ${budgetShare.toFixed(1)}% budget`}
        badge={
          recallAtBudget != null ? (
            <span className="text-2xs font-medium text-warning">
              Recall: {formatPercent(recallAtBudget)}
            </span>
          ) : undefined
        }
        detail={`Reviewing top ${championModel.test_at_alert_budget.alerts} transactions catches ${championModel.test_at_alert_budget.true_positives} true laundering events`}
      />

      <Scorecard
        icon={maxP95 != null ? Database : Cpu}
        label={maxP95 != null ? "FalkorDB graph latency" : "Scoring unit cost"}
        value={
          maxP95 != null
            ? formatMs(maxP95)
            : scoringCostPer1k != null
              ? formatUsd(scoringCostPer1k)
              : "N/A"
        }
        subvalue={maxP95 != null ? "P95 tail" : "per 1k tx"}
        badge={
          <span className="font-mono text-2xs text-fg-muted">
            {maxP95 != null ? "Multi-hop query" : "Inference compute"}
          </span>
        }
        detail={
          maxP95 != null
            ? `Bounded k-hop traversal across ${performance?.graph_scope ?? "graph"}`
            : "Estimated compute cost based on measured CPU-seconds"
        }
      />
    </div>
  );
}
