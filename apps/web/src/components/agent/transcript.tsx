"use client";

import { Bot, CircleSlash, Loader2, Route, Sparkles, UserRound } from "lucide-react";
import { motion } from "motion/react";
import { memo, useEffect, useRef, type ReactNode } from "react";

import { ToolCallCard } from "@/components/agent/tool-call-card";
import { VerdictCard } from "@/components/agent/verdict-card";
import { ErrorState } from "@/components/shared/states";
import type { ToolItem, TranscriptItem } from "@/lib/agent/session";
import type { ModelRoute, StreamStarted } from "@/lib/api-schemas";
import { cn } from "@/lib/cn";
import { formatClock, formatScore, formatWindow } from "@/lib/formatters";

const ROUTE_TEXT: Record<ModelRoute, { title: string; className: string }> = {
  blocked_by_rule: { title: "Blocked by rule", className: "text-critical" },
  flagged_for_review: { title: "Flagged for agent review", className: "text-warning" },
  standard_path: { title: "Standard path", className: "text-safe" },
};

function Line({
  icon,
  tone = "neutral",
  children,
}: {
  icon: ReactNode;
  tone?: "agent" | "neutral";
  children: ReactNode;
}) {
  return (
    <motion.div
      layout="position"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="flex gap-2.5"
    >
      <span
        className={cn(
          "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full",
          tone === "agent" ? "bg-accent/15 text-accent" : "bg-surface-elevated text-fg-muted",
        )}
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1 text-xs text-fg-secondary">{children}</div>
    </motion.div>
  );
}

function routingDetail(started: StreamStarted): string {
  const score = formatScore(started.risk_score);
  if (started.route === "blocked_by_rule" && started.block_threshold !== null) {
    return `Score ${score} is at or above the hard-block threshold ${formatScore(started.block_threshold)}. The block stands; the agent review adds scrutiny only.`;
  }
  if (started.route === "flagged_for_review") {
    return `Score ${score} is at or above the review threshold ${formatScore(started.review_threshold)}, so this review decides the outcome.`;
  }
  return `Score ${score} is below the review threshold ${formatScore(started.review_threshold)}. The transaction is allowed on the standard path; this review is informational.`;
}

function agentDetail(started: StreamStarted, requestedLlm: boolean): string {
  if (started.agent === "llm") {
    return `${started.llm_provider} ${started.llm_model} chooses the graph queries after a fixed first lookup.`;
  }
  if (requestedLlm) {
    return "No LLM provider is configured, so the policy agent runs its fixed query plan and no risk level is produced.";
  }
  return "The policy agent runs its fixed query plan. It does not rate risk; turn on the Gemini agent for a rating.";
}

export const Transcript = memo(function Transcript({
  items,
  activeKey,
  onShowTool,
  onEvidence,
  footer,
}: {
  items: TranscriptItem[];
  activeKey: string | null;
  onShowTool: (item: ToolItem) => void;
  onEvidence: (transactionId: string) => void;
  footer?: ReactNode;
}) {
  const end = useRef<HTMLDivElement>(null);
  const requested = new Map(
    items.flatMap((item) =>
      item.kind === "request" ? [[item.run, item.request.use_llm] as const] : [],
    ),
  );

  // Follow new items unless the analyst has scrolled up to read.
  useEffect(() => {
    const node = end.current;
    const scroller = node?.parentElement;
    if (!node || !scroller) return;
    const nearBottom = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 240;
    if (nearBottom) node.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [items]);

  return (
    <div className="space-y-3" aria-live="polite">
      {items.map((item) => {
        switch (item.kind) {
          case "request":
            return (
              <motion.div
                key={item.key}
                layout="position"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex justify-end gap-2.5"
              >
                <div className="max-w-[85%] rounded-lg rounded-tr-sm bg-surface-elevated px-3 py-2 text-xs text-fg">
                  <p>
                    Review this transaction: {item.request.max_hops}{" "}
                    {item.request.max_hops === 1 ? "hop" : "hops"},{" "}
                    {formatWindow(item.request.time_window_seconds)} window, limit{" "}
                    {item.request.result_limit}
                    {item.request.use_llm ? ", Gemini agent" : ", policy agent"}
                    {item.request.act ? ", then propose a case through the gate" : ""}.
                  </p>
                  <p className="mt-0.5 text-right text-[10px] text-fg-muted">
                    {formatClock(item.at)}
                  </p>
                </div>
                <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-surface-elevated text-fg-secondary">
                  <UserRound className="size-3.5" aria-hidden />
                </span>
              </motion.div>
            );
          case "routing": {
            const route = ROUTE_TEXT[item.started.route];
            return (
              <Line key={item.key} icon={<Route className="size-3.5" aria-hidden />}>
                <p className={cn("font-medium", route.className)}>{route.title}</p>
                <p className="mt-0.5">{routingDetail(item.started)}</p>
                <p className="mt-1.5">
                  {agentDetail(item.started, requested.get(item.run) ?? false)}
                </p>
              </Line>
            );
          }
          case "round":
            return (
              <Line key={item.key} tone="agent" icon={<Bot className="size-3.5" aria-hidden />}>
                {item.done ? (
                  <p>
                    Round {item.round}:{" "}
                    {item.toolCalls === 0
                      ? "the agent has enough evidence and stops querying."
                      : `the agent chose ${item.toolCalls} graph ${item.toolCalls === 1 ? "query" : "queries"}.`}
                  </p>
                ) : (
                  <p className="flex items-center gap-1.5 text-accent">
                    <Loader2
                      className="size-3 animate-spin motion-reduce:animate-none"
                      aria-hidden
                    />
                    The agent is choosing the next step
                  </p>
                )}
              </Line>
            );
          case "drafting":
            return (
              <Line
                key={item.key}
                tone="agent"
                icon={<Sparkles className="size-3.5" aria-hidden />}
              >
                {item.done ? (
                  <p>
                    Report drafted. Checking every cited ID, amount and path against the returned
                    records.
                  </p>
                ) : (
                  <p className="flex items-center gap-1.5 text-accent">
                    <Loader2
                      className="size-3 animate-spin motion-reduce:animate-none"
                      aria-hidden
                    />
                    The agent is drafting its report and risk level
                  </p>
                )}
              </Line>
            );
          case "tool":
            return (
              <ToolCallCard
                key={item.key}
                item={item}
                onShow={onShowTool}
                active={activeKey === item.key}
              />
            );
          case "verdict":
            return <VerdictCard key={item.key} response={item.response} onEvidence={onEvidence} />;
          case "error":
            return (
              <ErrorState
                key={item.key}
                title={
                  item.detail === "transaction not found in graph"
                    ? "Not in the loaded graph"
                    : "The review stopped"
                }
                message={`${item.message} Events shown above were received before it stopped.`}
              />
            );
          case "stopped":
            return (
              <Line key={item.key} icon={<CircleSlash className="size-3.5" aria-hidden />}>
                <p>You stopped this review. Results already shown are kept.</p>
              </Line>
            );
        }
      })}
      {footer}
      <div ref={end} />
    </div>
  );
});
