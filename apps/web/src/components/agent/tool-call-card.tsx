"use client";

import {
  ChevronRight,
  CircleDashed,
  CircleX,
  Crosshair,
  DatabaseZap,
  GitFork,
  Loader2,
  Network,
  Waypoints,
  type LucideIcon,
} from "lucide-react";
import { motion } from "motion/react";
import { memo, useState } from "react";

import { firstLine, StatementList } from "@/components/agent/cypher-block";
import { Badge } from "@/components/ui/badge";
import type { ToolItem } from "@/lib/agent/session";
import { cn } from "@/lib/cn";
import { formatInteger, formatMs, formatWindow } from "@/lib/formatters";

const TOOL: Record<ToolItem["call"]["tool"], { label: string; icon: LucideIcon }> = {
  trace_funds: { label: "Trace funds", icon: Waypoints },
  inspect_counterparties: { label: "Inspect counterparties", icon: Network },
  detect_flow_patterns: { label: "Detect flow pattern", icon: GitFork },
};

const PATTERN_LABEL: Record<string, string> = {
  fan_out: "fan-out",
  fan_in: "fan-in",
  pass_through: "pass-through",
};

function argumentSummary(args: ToolItem["call"]["arguments"]): string {
  const parts: string[] = [];
  if (typeof args.flow_pattern === "string")
    parts.push(PATTERN_LABEL[args.flow_pattern] ?? args.flow_pattern);
  if (typeof args.max_hops === "number")
    parts.push(`${args.max_hops} ${args.max_hops === 1 ? "hop" : "hops"}`);
  if (typeof args.time_window_seconds === "number")
    parts.push(formatWindow(args.time_window_seconds));
  if (typeof args.result_limit === "number") parts.push(`limit ${args.result_limit}`);
  return parts.join(", ");
}

function Status({ item }: { item: ToolItem }) {
  const { result } = item;
  if (!result) {
    return (
      <span className="flex items-center gap-1 text-[11px] text-accent">
        <Loader2 className="size-3 animate-spin motion-reduce:animate-none" aria-hidden />
        Querying
      </span>
    );
  }
  const { entry } = result;
  // The anchor is absent from the loaded graph: the query ran and found no
  // such transaction. That is a data-scope result, not a broken tool.
  if (entry.outcome === "unknown_anchor") {
    return (
      <Badge tone="review">
        <CircleDashed aria-hidden /> Not in graph
      </Badge>
    );
  }
  if (entry.status === "error") {
    return (
      <Badge tone="critical">
        <CircleX aria-hidden /> Failed
      </Badge>
    );
  }
  if (entry.outcome === "no_matching_path") {
    return (
      <Badge>
        <CircleDashed aria-hidden /> No match
      </Badge>
    );
  }
  return (
    <span className="text-[11px] text-fg-secondary">
      {formatInteger(entry.result_count)} records
      {entry.path_count > 0 ? `, ${formatInteger(entry.path_count)} paths` : ""}
      {entry.truncated ? ", capped" : ""}
    </span>
  );
}

export const ToolCallCard = memo(function ToolCallCard({
  item,
  onShow,
  active,
}: {
  item: ToolItem;
  onShow: (item: ToolItem) => void;
  active: boolean;
}) {
  const [open, setOpen] = useState(false);
  const { call, result, added } = item;
  const tool = TOOL[call.tool];
  const Icon = tool.icon;
  const statements = result?.statements ?? [];
  const preview = firstLine(statements);
  const byAgent = call.origin === "model";

  return (
    <motion.article
      layout="position"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className={cn(
        "rounded-lg border bg-surface transition-colors",
        active ? "border-accent/60" : "border-border",
        !result && "border-accent/40",
      )}
      data-tool-call={call.tool}
      data-status={result ? result.entry.status : "running"}
    >
      <header className="flex items-start gap-2.5 px-3 pt-2.5">
        <span
          className={cn(
            "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md",
            byAgent ? "bg-accent/15 text-accent" : "bg-surface-elevated text-fg-secondary",
          )}
        >
          <Icon className="size-3.5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <h4 className="text-[13px] font-semibold text-fg">
              {tool.label}
              {typeof call.arguments.flow_pattern === "string" ? (
                <span className="font-normal text-fg-secondary">
                  {" "}
                  {PATTERN_LABEL[call.arguments.flow_pattern] ?? call.arguments.flow_pattern}
                </span>
              ) : null}
            </h4>
            <div className="flex items-center gap-2">
              <Status item={item} />
              {result ? (
                <span className="text-[11px] text-fg-muted">
                  {formatMs(result.entry.duration_ms)}
                </span>
              ) : null}
            </div>
          </div>
          <p className="mt-0.5 text-xs text-fg-secondary">{call.purpose}</p>
          <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-fg-muted">
            <span className={byAgent ? "text-accent" : undefined}>
              {byAgent ? "Chosen by the agent" : "Run by policy"}
            </span>
            <span aria-hidden>/</span>
            <span>{call.transport === "mcp" ? "MCP server" : "direct call"}</span>
            <span aria-hidden>/</span>
            <span>{argumentSummary(call.arguments)}</span>
          </p>
        </div>
      </header>

      {added && (added.transactions > 0 || added.accounts > 0) ? (
        <div className="mx-3 mt-2 flex items-center justify-between gap-2 rounded-md bg-safe/[0.07] px-2.5 py-1.5 text-[11px]">
          <span className="text-safe">
            Added {formatInteger(added.transactions)} transactions and{" "}
            {formatInteger(added.accounts)} accounts to the graph
          </span>
          <button
            type="button"
            onClick={() => onShow(item)}
            className="flex shrink-0 items-center gap-1 rounded-sm text-fg-secondary hover:text-fg"
            aria-pressed={active}
          >
            <Crosshair className="size-3" aria-hidden /> {active ? "Shown" : "Show"}
          </button>
        </div>
      ) : result && result.entry.status === "ok" && result.evidence ? (
        <p className="mx-3 mt-2 text-[11px] text-fg-muted">
          Nothing new: every record was already on the graph.
        </p>
      ) : null}

      <div className="px-3 pt-2 pb-2.5">
        {statements.length > 0 ? (
          <>
            <button
              type="button"
              onClick={() => setOpen((value) => !value)}
              aria-expanded={open}
              className="flex w-full items-center gap-1.5 rounded-sm text-left text-[11px] text-fg-secondary hover:text-fg"
            >
              <ChevronRight
                className={cn("size-3 shrink-0 transition-transform", open && "rotate-90")}
                aria-hidden
              />
              <DatabaseZap className="size-3 shrink-0 text-safe" aria-hidden />
              <span className="shrink-0">
                Cypher, {statements.length} {statements.length === 1 ? "statement" : "statements"}
              </span>
              {!open && preview ? (
                <code className="min-w-0 truncate font-mono text-fg-muted">{preview}</code>
              ) : null}
            </button>
            {open ? (
              <div className="mt-2">
                <StatementList statements={statements} />
              </div>
            ) : null}
          </>
        ) : result ? (
          <p className="text-[11px] text-fg-muted">
            {result.entry.outcome === "unknown_anchor"
              ? "The anchor lookup found no transaction with this ID in the loaded graph, so no evidence was returned."
              : result.entry.status === "error"
                ? "The call failed before any statement returned."
                : "No Cypher was recorded for this call."}
          </p>
        ) : null}
      </div>
    </motion.article>
  );
});
