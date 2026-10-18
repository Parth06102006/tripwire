"use client";

import { AlertTriangle, CheckCircle2, Clock, Filter, Sliders, Users } from "lucide-react";
import { useMemo, useState } from "react";

import { modelShortLabel } from "@/components/performance/chart";
import { Badge } from "@/components/ui/badge";
import type { ModelBenchmark } from "@/lib/api-schemas";
import { cn } from "@/lib/cn";
import { formatInteger, formatPercent } from "@/lib/formatters";

type Models = Record<string, ModelBenchmark>;

export function ThresholdSimulator({ models }: { models: Models }) {
  const modelKeys = useMemo(() => Object.keys(models), [models]);

  // Default to champion model (highest AP)
  const defaultKey = useMemo(() => {
    if (modelKeys.length === 0) return "";
    const sorted = [...modelKeys].sort(
      (a, b) => (models[b]?.average_precision.test ?? 0) - (models[a]?.average_precision.test ?? 0),
    );
    return sorted[0] ?? "";
  }, [modelKeys, models]);

  const [selectedKey, setSelectedKey] = useState<string>(defaultKey || "");
  const activeKey = selectedKey && models[selectedKey] ? selectedKey : defaultKey;
  const activeModel = activeKey ? models[activeKey] : undefined;

  // Base alert budget from the model's recorded benchmark
  const benchmarkBudget = activeModel?.test_at_alert_budget?.budget ?? 0.001;
  const [budgetRate, setBudgetRate] = useState<number>(benchmarkBudget);

  // Dynamic derivation of cohort size from test split
  const testSplit = activeModel?.splits?.test;
  const totalTestRows =
    testSplit?.rows ??
    (activeModel ? Math.round(activeModel.test_at_alert_budget.alerts / (activeModel.test_at_alert_budget.budget || 0.001)) : 1000);

  const totalPositives = useMemo(() => {
    if (!activeModel) return 1000;
    if (testSplit?.prevalence != null) {
      return Math.round(testSplit.rows * testSplit.prevalence);
    }
    const recall = activeModel.test_at_alert_budget.recall;
    return recall > 0 ? Math.round(activeModel.test_at_alert_budget.true_positives / recall) : 1000;
  }, [testSplit, activeModel]);

  // Dynamic simulation based on the model's recorded budget and validation operating points
  const simulated = useMemo(() => {
    if (!activeModel) {
      return {
        totalAlerts: 1,
        estimatedTruePositives: 1,
        estimatedFalsePositives: 0,
        recall: 0,
        precision: 1,
        estimatedReviewHours: 1,
      };
    }
    const totalAlerts = Math.max(1, Math.round(totalTestRows * budgetRate));

    // Known calibration point 1: recorded alert budget point
    const baseBudget = activeModel.test_at_alert_budget.budget;
    const baseRecall = activeModel.test_at_alert_budget.recall;

    // Known calibration point 2: threshold max F1 point
    const threshRecall = activeModel.test_at_val_threshold.recall;
    const threshAlerts =
      activeModel.test_at_val_threshold.true_positives +
      activeModel.test_at_val_threshold.false_positives;
    const threshBudget = threshAlerts / totalTestRows;

    let recall: number;

    if (budgetRate <= baseBudget) {
      // Below or at budget point: high precision zone
      const ratio = budgetRate / (baseBudget || 0.001);
      recall = baseRecall * Math.pow(ratio, 0.7);
    } else if (budgetRate <= threshBudget) {
      // Between budget and max-F1 threshold
      const t = (budgetRate - baseBudget) / Math.max(1e-5, threshBudget - baseBudget);
      recall = baseRecall + t * (threshRecall - baseRecall);
    } else {
      // Diminishing returns above max-F1 threshold
      const excess = (budgetRate - threshBudget) / Math.max(0.001, 1 - threshBudget);
      recall = Math.min(0.98, threshRecall + (1 - threshRecall) * Math.pow(excess, 0.5));
    }

    const estimatedTruePositives = Math.min(
      totalAlerts,
      Math.max(1, Math.round(totalPositives * recall)),
    );
    const estimatedFalsePositives = Math.max(0, totalAlerts - estimatedTruePositives);
    const effectivePrecision = estimatedTruePositives / totalAlerts;

    // Average analyst review duration: ~15 mins (0.25h) per investigation
    const estimatedReviewHours = Math.round(totalAlerts * 0.25);

    return {
      totalAlerts,
      estimatedTruePositives,
      estimatedFalsePositives,
      recall,
      precision: effectivePrecision,
      estimatedReviewHours,
    };
  }, [totalTestRows, budgetRate, totalPositives, activeModel]);

  if (!activeModel) return null;

  return (
    <section
      aria-labelledby="simulator-heading"
      className="rounded-lg border border-border bg-surface p-5 shadow-sm"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Sliders className="size-4 text-accent" aria-hidden />
            <h3 id="simulator-heading" className="text-sm font-semibold text-fg">
              Operational Alert Budget & Decision Simulator
            </h3>
          </div>
          <p className="mt-1 text-xs text-fg-muted">
            Simulate analyst triage capacity, false-alarm burden, and detection coverage across the
            held-out cohort.
          </p>
        </div>

        {/* Model switcher */}
        <div
          className="flex flex-wrap items-center gap-1.5"
          role="group"
          aria-label="Model selection"
        >
          {modelKeys.map((key) => {
            const active = key === selectedKey;
            return (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setSelectedKey(key);
                  setBudgetRate(models[key]?.test_at_alert_budget.budget ?? 0.001);
                }}
                className={cn(
                  "rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
                  active
                    ? "border-accent bg-accent-soft text-fg"
                    : "border-border-strong text-fg-secondary hover:border-fg-muted hover:text-fg",
                )}
              >
                {modelShortLabel(key)}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-5 grid gap-6 lg:grid-cols-[1fr_340px]">
        {/* Left Column: Interactive Slider & Tradeoff Visualizer */}
        <div className="space-y-5">
          <div>
            <div className="flex items-center justify-between text-xs">
              <label htmlFor="budget-slider" className="font-medium text-fg">
                Alert Budget Ratio:{" "}
                <span className="font-mono font-bold text-accent">
                  {(budgetRate * 100).toFixed(2)}%
                </span>{" "}
                of scored transactions
              </label>
              <button
                type="button"
                onClick={() => setBudgetRate(benchmarkBudget)}
                className="text-2xs text-accent hover:underline"
              >
                Reset to benchmark ({(benchmarkBudget * 100).toFixed(2)}%)
              </button>
            </div>

            <input
              id="budget-slider"
              type="range"
              min="0.0005"
              max="0.01"
              step="0.0001"
              value={budgetRate}
              onChange={(e) => setBudgetRate(Number(e.target.value))}
              className="mt-2.5 h-1.5 w-full cursor-pointer accent-accent"
            />

            <div className="mt-1.5 flex justify-between text-[11px] text-fg-muted">
              <span>0.05% (Ultra-selective)</span>
              <span>0.10% (Benchmark budget)</span>
              <span>1.00% (High capacity)</span>
            </div>
          </div>

          {/* Trade-off Bar */}
          <div className="rounded-lg border border-border/70 bg-surface-sunken p-4">
            <span className="text-2xs font-semibold tracking-wider text-fg-muted uppercase">
              Triage Composition: True Positives vs False Alarms
            </span>

            <div className="mt-2.5 flex h-3 w-full overflow-hidden rounded-full bg-surface-elevated">
              <div
                className="bg-safe transition-all"
                style={{ width: `${Math.max(2, simulated.precision * 100)}%` }}
                title={`True Positives: ${simulated.estimatedTruePositives}`}
              />
              <div
                className="bg-critical/80 transition-all"
                style={{ width: `${Math.max(2, (1 - simulated.precision) * 100)}%` }}
                title={`False Positives: ${simulated.estimatedFalsePositives}`}
              />
            </div>

            <div className="mt-3 flex items-center justify-between text-xs">
              <span className="inline-flex items-center gap-1.5 text-safe">
                <CheckCircle2 className="size-3.5" aria-hidden />
                True Laundered: {formatInteger(simulated.estimatedTruePositives)} (
                {formatPercent(simulated.precision)} precision)
              </span>
              <span className="inline-flex items-center gap-1.5 text-critical">
                <AlertTriangle className="size-3.5" aria-hidden />
                False Alarms: {formatInteger(simulated.estimatedFalsePositives)}
              </span>
            </div>
          </div>

          {/* Reference point notice */}
          <div className="flex items-center gap-3 text-2xs text-fg-muted">
            <Filter className="size-3.5 text-fg-muted" aria-hidden />
            <span>
              Validation threshold for maximum F1:{" "}
              <strong className="font-mono text-fg">
                {activeModel.val_threshold_max_f1.toFixed(4)}
              </strong>{" "}
              (Precision: {formatPercent(activeModel.test_at_val_threshold.precision)}, Recall:{" "}
              {formatPercent(activeModel.test_at_val_threshold.recall)})
            </span>
          </div>
        </div>

        {/* Right Column: Calculated Impact Cards */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-1">
          <div className="rounded-md border border-border/80 bg-surface-elevated/40 p-3">
            <div className="flex items-center justify-between text-2xs text-fg-muted">
              <span>Alert Queue Volume</span>
              <Filter className="size-3 text-accent" aria-hidden />
            </div>
            <p className="mt-1 font-mono text-lg font-bold text-fg">
              {formatInteger(simulated.totalAlerts)}
            </p>
            <p className="text-2xs text-fg-muted">
              out of {formatInteger(totalTestRows)} test events
            </p>
          </div>

          <div className="rounded-md border border-border/80 bg-surface-elevated/40 p-3">
            <div className="flex items-center justify-between text-2xs text-fg-muted">
              <span>Laundering Recall</span>
              <Badge tone="verified">Coverage</Badge>
            </div>
            <p className="mt-1 font-mono text-lg font-bold text-safe">
              {formatPercent(simulated.recall)}
            </p>
            <p className="text-2xs text-fg-muted">
              of {formatInteger(totalPositives)} total laundering events
            </p>
          </div>

          <div className="rounded-md border border-border/80 bg-surface-elevated/40 p-3">
            <div className="flex items-center justify-between text-2xs text-fg-muted">
              <span>Estimated Analyst Load</span>
              <Clock className="size-3 text-warning" aria-hidden />
            </div>
            <p className="mt-1 font-mono text-lg font-bold text-warning">
              {formatInteger(simulated.estimatedReviewHours)} hrs
            </p>
            <p className="text-2xs text-fg-muted">at ~15 mins per graph investigation</p>
          </div>

          <div className="rounded-md border border-border/80 bg-surface-elevated/40 p-3">
            <div className="flex items-center justify-between text-2xs text-fg-muted">
              <span>Analyst Efficiency</span>
              <Users className="size-3 text-safe" aria-hidden />
            </div>
            <p className="mt-1 font-mono text-lg font-bold text-fg">
              {(simulated.estimatedTruePositives / (simulated.estimatedReviewHours || 1)).toFixed(
                1,
              )}{" "}
              / hr
            </p>
            <p className="text-2xs text-fg-muted">confirmed laundering events per analyst-hour</p>
          </div>
        </div>
      </div>
    </section>
  );
}
