"use client";

import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Panel } from "@/components/shared/states";
import type { PerformanceSummary } from "@/lib/api-schemas";
import { formatInteger, formatMs, formatUsd } from "@/lib/formatters";

function Line({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1 border-b border-border/60 py-2 text-xs last:border-0 sm:grid-cols-[13rem_1fr] sm:gap-4">
      <dt className="text-fg-muted">{label}</dt>
      <dd className="text-fg">{children}</dd>
    </div>
  );
}

const Estimate = () => <Badge tone="review">Estimate</Badge>;
const Measured = () => <Badge tone="verified">Measured</Badge>;
const NotMeasured = () => <Badge>Not measured</Badge>;

export function CostPanel({ performance }: { performance: PerformanceSummary }) {
  const { cost } = performance;
  const investigation = performance.api.investigation;
  const graphSum = investigation && "graph_query_sum" in investigation ? investigation : null;

  return (
    <Panel
      title="Investigation duration and cost"
      description="Measured values and estimates are labelled separately. No price is assumed where none was recorded."
    >
      <dl>
        <Line label="Investigation request">
          {investigation ? (
            <span className="flex flex-wrap items-center gap-2">
              <span>
                P50 {formatMs(investigation.p50_ms)}, P95 {formatMs(investigation.p95_ms)} over{" "}
                {formatInteger(investigation.samples)} serial requests
              </span>
              <Measured />
            </span>
          ) : (
            <NotMeasured />
          )}
        </Line>
        {graphSum ? (
          <Line label="Graph queries inside it">
            <span className="flex flex-wrap items-center gap-2">
              <span>
                P50 {formatMs(graphSum.graph_query_sum.p50_ms)}, P95{" "}
                {formatMs(graphSum.graph_query_sum.p95_ms)} summed; evidence size{" "}
                {formatInteger(graphSum.evidence_transactions)} transactions,{" "}
                {formatInteger(graphSum.evidence_accounts)} accounts,{" "}
                {formatInteger(graphSum.evidence_paths)} paths;{" "}
                {graphSum.all_reports_validated
                  ? "every report validated"
                  : "not every report validated"}
              </span>
              <Measured />
            </span>
          </Line>
        ) : null}
        <Line label="LLM calls and token cost">
          <span className="flex flex-wrap items-center gap-2">
            {cost.external_llm_calls === 0
              ? "No LLM calls in this benchmark, so no token cost was measured."
              : `${formatInteger(cost.external_llm_calls)} external LLM calls.`}{" "}
            {cost.external_llm_cost}
            {cost.external_llm_calls === 0 ? <NotMeasured /> : null}
          </span>
        </Line>
        <Line label="Scoring cost">
          <span className="flex flex-wrap items-center gap-2">
            {cost.scoring_usd_per_1000_transactions != null
              ? `${formatUsd(cost.scoring_usd_per_1000_transactions)} per 1,000 transactions`
              : cost.cost_per_1000_decisions}
            {cost.scoring_cpu_seconds_per_1000_transactions != null
              ? `, ${cost.scoring_cpu_seconds_per_1000_transactions.toFixed(4)} CPU-seconds per 1,000`
              : ""}
            <Estimate />
          </span>
        </Line>
        <Line label="Investigation compute cost">
          <span className="flex flex-wrap items-center gap-2">
            {cost.investigation_usd != null
              ? `${formatUsd(cost.investigation_usd)} metered`
              : "Not reported"}
            {cost.investigation_provisioned_usd != null
              ? `, ${formatUsd(cost.investigation_provisioned_usd)} provisioned`
              : ""}
            {cost.investigation_cpu_seconds != null
              ? `, ${cost.investigation_cpu_seconds.toFixed(4)} CPU-seconds each`
              : ""}
            <Estimate />
          </span>
        </Line>
        <Line label="Price basis">{cost.price_basis ?? cost.local_compute_cost}</Line>
        <Line label="Dollar-weighted recall">
          <span className="flex flex-wrap items-center gap-2">
            {cost.dollar_weighted_recall}
            {cost.dollar_weighted_recall.toLowerCase().startsWith("not measured") ? (
              <NotMeasured />
            ) : null}
          </span>
        </Line>
      </dl>
    </Panel>
  );
}
