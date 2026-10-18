import { cn } from "@/lib/cn";
import type { Escalation } from "@/lib/api-schemas";
import { formatScore } from "@/lib/formatters";

type Branch = { label: string; taken: boolean; tone: "block" | "allow" | "review" | "next" };

const TONE: Record<Branch["tone"], string> = {
  block: "border-critical/60 bg-critical/10 text-critical",
  allow: "border-safe/60 bg-safe/10 text-safe",
  review: "border-warning/60 bg-warning/10 text-warning",
  next: "border-accent/60 bg-accent/10 text-accent",
};

function Stage({
  title,
  detail,
  reached,
  branches,
}: {
  title: string;
  detail: string;
  reached: boolean;
  branches: Branch[];
}) {
  return (
    <li className={cn("relative pl-5", !reached && "opacity-40")}>
      <span
        aria-hidden
        className={cn(
          "absolute top-1.5 left-0 size-2.5 rounded-full border-2",
          reached ? "border-accent bg-accent/30" : "border-border-strong bg-surface",
        )}
      />
      <p className="text-xs font-medium text-fg">{title}</p>
      <p className="text-[11px] text-fg-muted">{detail}</p>
      <ul className="mt-1.5 flex flex-wrap gap-1.5">
        {branches.map((branch) => (
          <li
            key={branch.label}
            aria-current={branch.taken ? "step" : undefined}
            className={cn(
              "rounded-full border px-2 py-0.5 text-[11px]",
              branch.taken ? TONE[branch.tone] : "border-border text-fg-muted",
            )}
          >
            {branch.label}
          </li>
        ))}
      </ul>
    </li>
  );
}

/**
 * The escalation chain with the path this transaction took. Stages after
 * the deciding stage are drawn but dimmed.
 */
export function EscalationChain({
  escalation,
  score,
  agentLabel,
}: {
  escalation: Escalation;
  score: number;
  /** Provider and model of the LLM agent, or null when none ran. */
  agentLabel: string | null;
}) {
  const { route, block_threshold, review_threshold, risk_level, outcome } = escalation;
  const blocked = route === "blocked_by_rule";
  const flagged = route === "flagged_for_review";
  const agentRuns = flagged || (escalation.agent_status === "rated" && blocked);

  return (
    <ol className="space-y-3">
      <Stage
        title="Model and rules"
        detail={
          block_threshold !== null
            ? `Score ${formatScore(score)}; hard block at ${formatScore(block_threshold)} or above`
            : `Score ${formatScore(score)}; no hard-block rule configured`
        }
        reached
        branches={[
          { label: "Block by rule", taken: blocked, tone: "block" },
          { label: "Pass to routing", taken: !blocked, tone: "next" },
        ]}
      />
      <Stage
        title="Review routing"
        detail={`Flagged for review at ${formatScore(review_threshold)} or above`}
        reached={!blocked}
        branches={[
          { label: "Standard path: allow", taken: route === "standard_path", tone: "allow" },
          { label: "Additional review", taken: flagged, tone: "next" },
        ]}
      />
      <Stage
        title={agentLabel ? `Agent review, ${agentLabel}` : "Agent review"}
        detail={
          blocked
            ? "Additional scrutiny only; it cannot reverse an upstream block"
            : agentLabel
              ? "Proposes a risk level; policy maps it to the decision"
              : "No LLM agent ran, so no risk level was proposed"
        }
        reached={agentRuns}
        branches={[
          {
            label: "Risk 4 to 5: block",
            taken: flagged && risk_level !== null && risk_level !== undefined && risk_level >= 4,
            tone: "block",
          },
          {
            label: "Risk 1 to 3: allow",
            taken: flagged && risk_level !== null && risk_level !== undefined && risk_level <= 3,
            tone: "allow",
          },
          {
            label: "No rating: operator review",
            taken: flagged && outcome === "pending_review",
            tone: "review",
          },
        ]}
      />
    </ol>
  );
}
