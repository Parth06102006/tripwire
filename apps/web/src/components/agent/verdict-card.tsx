"use client";

import { Ban, CircleCheck, Hourglass, ShieldCheck } from "lucide-react";
import { motion } from "motion/react";
import { memo } from "react";

import { EscalationChain } from "@/components/agent/escalation-chain";
import { OutcomeBadge } from "@/components/shared/status-badge";
import { Mono } from "@/components/shared/states";
import type { Escalation, InvestigationResponse } from "@/lib/api-schemas";
import { cn } from "@/lib/cn";
import { formatInteger, formatMs, formatUsd } from "@/lib/formatters";
import { OUTCOME_EXPLANATION } from "@/lib/investigation/outcomes";

const OUTCOME: Record<
  Escalation["outcome"],
  { label: string; icon: typeof Ban; className: string }
> = {
  block: { label: "Block", icon: Ban, className: "text-critical" },
  allow: { label: "Allow", icon: CircleCheck, className: "text-safe" },
  pending_review: { label: "Operator review", icon: Hourglass, className: "text-warning" },
};

const DECIDED_BY: Record<Escalation["decided_by"], string> = {
  rule: "Decided by the hard-block rule",
  agent: "Decided by the agent's verified risk level",
  model: "Decided by the model route",
};

const LEVEL_CLASS = ["", "bg-safe", "bg-safe", "bg-warning", "bg-critical", "bg-critical"];

export function RiskMeter({ level }: { level: number | null | undefined }) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-[11px] text-fg-muted">Risk level</span>
        <span className="text-sm font-semibold text-fg">
          {level ? `${level} of 5` : "Not rated"}
        </span>
      </div>
      <div
        className="mt-1.5 flex gap-1"
        role="img"
        aria-label={level ? `Risk level ${level} of 5` : "Not rated"}
      >
        {[1, 2, 3, 4, 5].map((step) => (
          <motion.span
            key={step}
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ delay: 0.08 * step, duration: 0.2 }}
            className={cn(
              "h-2 flex-1 origin-left rounded-sm",
              level && step <= level ? LEVEL_CLASS[level] : "bg-surface-elevated",
            )}
          />
        ))}
      </div>
    </div>
  );
}

export const VerdictCard = memo(function VerdictCard({
  response,
  onEvidence,
}: {
  response: InvestigationResponse;
  onEvidence: (transactionId: string) => void;
}) {
  const { escalation, report } = response;
  const llm = report?.llm ?? null;
  const agentLabel = llm && llm.status !== "unavailable" ? `${llm.provider} ${llm.model}` : null;
  const outcome = escalation ? OUTCOME[escalation.outcome] : null;
  const OutcomeIcon = outcome?.icon ?? Hourglass;

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="overflow-hidden rounded-lg border border-border-strong bg-surface"
      aria-label="Review verdict"
      data-testid="verdict"
    >
      <div className="grid gap-4 border-b border-border p-4">
        <div>
          <p className="text-[11px] text-fg-muted">Decision (simulated)</p>
          <p
            className={cn(
              "mt-0.5 flex items-center gap-2 text-xl font-semibold",
              outcome?.className,
            )}
          >
            <OutcomeIcon className="size-5" aria-hidden />
            {outcome?.label ?? "Not decided"}
          </p>
          <p className="mt-1 text-[11px] text-fg-secondary">
            {escalation ? DECIDED_BY[escalation.decided_by] : "No escalation was returned."}
          </p>
        </div>
        <RiskMeter level={escalation?.risk_level} />
      </div>

      {escalation ? (
        <div className="border-b border-border p-4">
          <p className="mb-3 text-xs text-fg-secondary">{escalation.reason}</p>
          <div className="relative">
            <EscalationChain
              escalation={escalation}
              score={response.risk_score}
              agentLabel={agentLabel}
            />
          </div>
        </div>
      ) : null}

      {report && report.reasoning.length > 0 ? (
        <div className="border-b border-border p-4">
          <h4 className="flex items-center gap-1.5 text-xs font-semibold">
            <ShieldCheck className="size-3.5 text-safe" aria-hidden /> Reasoning, verified against
            the returned records
          </h4>
          <ol className="mt-2 space-y-2.5">
            {report.reasoning.map((point, index) => (
              <li key={index} className="grid grid-cols-[1.25rem_1fr] gap-1 text-xs">
                <span className="text-fg-muted">{index + 1}.</span>
                <div>
                  <p className="text-fg">{point.statement}</p>
                  <p className="mt-1 flex flex-wrap gap-1">
                    {point.evidence_ids.map((id) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => onEvidence(id)}
                        className="rounded-sm border border-safe/30 bg-safe/[0.06] px-1.5 py-px font-mono text-[10px] text-safe hover:bg-safe/15"
                      >
                        {id}
                      </button>
                    ))}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      <div className="space-y-3 p-4">
        {report ? (
          <div>
            <h4 className="text-xs font-semibold">Hypothesis</h4>
            <p className="mt-0.5 text-[11px] text-fg-muted">
              {report.source === "llm"
                ? "Drafted by the agent and accepted by the verifier. A proposal, not a finding."
                : "Written by the deterministic summary. A proposal, not a finding."}
            </p>
            <p className="mt-1.5 text-xs text-fg">{report.hypothesis}</p>
            {report.counterevidence_ids.length > 0 ? (
              <p className="mt-1.5 text-[11px] text-fg-secondary">
                Counter-evidence:{" "}
                {report.counterevidence_ids.map((id) => (
                  <Mono key={id} className="mr-1">
                    {id}
                  </Mono>
                ))}
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-2 text-[11px] text-fg-secondary">
          <OutcomeBadge outcome={response.outcome} />
          <span>{OUTCOME_EXPLANATION[response.outcome]}</span>
        </div>
        <p className="text-[11px] text-fg-muted">
          {formatInteger(response.evidence.transactions.length)} transactions,{" "}
          {formatInteger(response.evidence.accounts.length)} accounts,{" "}
          {formatInteger(response.evidence.paths.length)} paths from{" "}
          {formatInteger(response.tool_trace.length)} graph calls; graph phase{" "}
          {formatMs(response.evidence.query_duration_ms)}.
          {llm && llm.status === "completed"
            ? ` Agent: ${llm.rounds} rounds, ${llm.tool_calls} tool calls, ${
                llm.input_tokens != null && llm.output_tokens != null
                  ? `${formatInteger(llm.input_tokens)} input and ${formatInteger(llm.output_tokens)} output tokens`
                  : "tokens not reported"
              }, ${formatMs(llm.duration_ms)}${
                llm.estimated_cost_usd != null
                  ? `, about ${formatUsd(llm.estimated_cost_usd)} (estimate)`
                  : ""
              }.`
            : ""}
        </p>
      </div>
    </motion.section>
  );
});
