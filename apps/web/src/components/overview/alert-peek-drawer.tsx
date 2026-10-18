"use client";

import { Check, Copy, ExternalLink, Network, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { investigationHref } from "@/components/overview/transaction-lookup";
import { CaseStatusBadge, RouteBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import { useTransactionCases } from "@/hooks/use-cases";
import type { AlertItem } from "@/lib/api-schemas";
import { cn } from "@/lib/cn";
import { formatScore, formatSourceTimestamp } from "@/lib/formatters";

export function AlertPeekDrawer({ alert, onClose }: { alert: AlertItem; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const cases = useTransactionCases(alert.transaction_id);

  const copyId = async () => {
    try {
      await navigator.clipboard.writeText(alert.transaction_id);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable
    }
  };

  const isCritical = alert.score >= 0.85 || alert.route === "blocked_by_rule";
  const activeCase = cases.data?.active;

  return (
    <aside
      aria-label="Alert details"
      className="flex h-full flex-col rounded-lg border border-border bg-surface p-4 shadow-sm"
    >
      <div className="flex items-start justify-between gap-3 border-b border-border pb-3">
        <div className="min-w-0">
          <span className="text-2xs font-semibold tracking-wider text-accent uppercase">
            Alert Inspection
          </span>
          <div className="mt-1 flex items-center gap-1.5">
            <span className="truncate font-mono text-sm font-semibold text-fg">
              {alert.transaction_id}
            </span>
            <button
              type="button"
              onClick={copyId}
              aria-label="Copy transaction ID"
              className="rounded p-1 text-fg-muted hover:bg-surface-elevated hover:text-fg"
            >
              {copied ? (
                <Check className="size-3.5 text-safe" aria-hidden />
              ) : (
                <Copy className="size-3.5" aria-hidden />
              )}
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Close inspector"
          className="rounded p-1 text-fg-muted hover:bg-surface-elevated hover:text-fg"
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>

      <div className="mt-4 flex-1 scrollbar-thin space-y-4 overflow-y-auto">
        {/* Risk Score & Routing Card */}
        <div className="rounded-md border border-border/70 bg-surface-sunken p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-fg-secondary">Model risk score</span>
            <span
              className={cn(
                "font-mono text-lg font-bold",
                isCritical ? "text-critical" : alert.score >= 0.5 ? "text-warning" : "text-safe",
              )}
            >
              {formatScore(alert.score)}
            </span>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-elevated">
            <div
              className={cn(
                "h-full transition-all",
                isCritical ? "bg-critical" : alert.score >= 0.5 ? "bg-warning" : "bg-safe",
              )}
              style={{ width: `${Math.max(3, alert.score * 100)}%` }}
            />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <RouteBadge route={alert.route} />
            {alert.graph_status === "missing" ? (
              <Badge tone="review">Not in graph</Badge>
            ) : (
              <Badge tone="verified">In FalkorDB</Badge>
            )}
          </div>
        </div>

        {/* Metadata summary */}
        <div className="space-y-2 text-xs">
          <div className="flex items-center justify-between border-b border-border/50 py-1.5">
            <span className="text-fg-muted">Timestamp</span>
            <span className="text-fg-secondary">{formatSourceTimestamp(alert.timestamp)}</span>
          </div>
          <div className="flex items-center justify-between border-b border-border/50 py-1.5">
            <span className="text-fg-muted">Decision policy</span>
            <span className="font-medium text-fg uppercase">{alert.decision}</span>
          </div>
          <div className="flex items-center justify-between border-b border-border/50 py-1.5">
            <span className="text-fg-muted">Case state</span>
            <span>
              {cases.isPending ? (
                <span className="text-fg-muted">Checking...</span>
              ) : activeCase ? (
                <CaseStatusBadge status={activeCase.status} />
              ) : (
                <span className="text-fg-muted">No open case</span>
              )}
            </span>
          </div>
        </div>

        {/* Graph Traversal Context */}
        <div className="rounded-md border border-border/70 bg-surface-elevated/40 p-3 text-xs">
          <div className="flex items-center gap-1.5 font-medium text-fg">
            <Network className="size-3.5 text-accent" aria-hidden />
            Graph Topology Context
          </div>
          <p className="mt-1 text-2xs leading-relaxed text-fg-secondary">
            {alert.graph_status === "missing"
              ? "This transaction is scored in the offline replay cohort but is not in the active FalkorDB instance."
              : "Investigating this transfer queries bounded k-hop counterparties, cyclical loops, and rapid pass-through funds around this anchor."}
          </p>
        </div>
      </div>

      <div className="mt-4 border-t border-border pt-3">
        <Link
          href={investigationHref(alert.transaction_id)}
          className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-accent px-4 py-2 text-xs font-semibold text-accent-ink transition-colors hover:brightness-110"
        >
          <span>Open Graph Investigation</span>
          <ExternalLink className="size-3.5" aria-hidden />
        </Link>
      </div>
    </aside>
  );
}
