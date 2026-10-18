"use client";

import { Route } from "lucide-react";
import { memo, useMemo } from "react";

import { EmptyState, Mono } from "@/components/shared/states";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";
import { formatAmount, formatSourceTimestamp } from "@/lib/formatters";
import type { Selection } from "@/lib/graph/flow";
import {
  describePathDirection,
  transactionNodeId,
  transactions,
  type EvidencePath,
  type InvestigationGraph,
} from "@/lib/graph/model";

type Props = {
  graph: InvestigationGraph;
  verifiedIds: ReadonlySet<string>;
  selection: Selection;
  onSelect: (selection: Selection) => void;
};

export const EvidencePanel = memo(function EvidencePanel({
  graph,
  verifiedIds,
  selection,
  onSelect,
}: Props) {
  const groups = useMemo(() => {
    const byLabel = new Map<string, EvidencePath[]>();
    for (const entry of graph.paths) {
      const label = describePathDirection(entry.path.direction);
      const list = byLabel.get(label);
      if (list) list.push(entry);
      else byLabel.set(label, [entry]);
    }
    return [...byLabel.entries()];
  }, [graph.paths]);

  const txs = useMemo(
    () =>
      transactions(graph).sort((a, b) =>
        a.transaction.timestamp.localeCompare(b.transaction.timestamp),
      ),
    [graph],
  );

  if (graph.nodes.size === 0) {
    return (
      <EmptyState icon={Route} title="No evidence yet">
        Evidence appears here when an investigation response arrives.
      </EmptyState>
    );
  }

  return (
    <div className="space-y-5 p-4">
      <section aria-labelledby="paths-heading">
        <h3 id="paths-heading" className="text-xs font-semibold text-fg-secondary">
          Returned paths ({graph.paths.length})
        </h3>
        {groups.length === 0 ? (
          <p className="mt-1 text-xs text-fg-muted">
            The queries returned no paths within the bounds.
          </p>
        ) : (
          groups.map(([label, entries]) => (
            <div key={label} className="mt-2">
              <p className="mb-1 text-[11px] text-fg-muted">
                {label} ({entries.length})
              </p>
              <ul className="space-y-px">
                {entries.map((entry) => {
                  const active = selection?.kind === "path" && selection.id === entry.id;
                  return (
                    <li key={entry.id}>
                      <button
                        type="button"
                        aria-pressed={active}
                        onClick={() => onSelect(active ? null : { kind: "path", id: entry.id })}
                        className={cn(
                          "flex w-full items-center gap-2 rounded-sm px-1.5 py-1 text-left text-xs transition-colors",
                          active
                            ? "bg-accent/15 text-fg"
                            : "text-fg-secondary hover:bg-surface-elevated hover:text-fg",
                        )}
                      >
                        <span className="w-12 shrink-0 text-fg-muted">
                          depth {entry.path.depth}
                        </span>
                        <Mono className="min-w-0 flex-1 truncate">
                          {entry.path.transaction_ids.join(", ")}
                        </Mono>
                        {entry.firstSeq === graph.latestSeq && graph.latestSeq > 1 ? (
                          <Badge tone="agent">New</Badge>
                        ) : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))
        )}
      </section>

      <section aria-labelledby="tx-heading">
        <h3 id="tx-heading" className="text-xs font-semibold text-fg-secondary">
          Returned transactions ({txs.length})
        </h3>
        <table className="mt-1.5 w-full text-xs">
          <thead className="sr-only">
            <tr>
              <th>Transaction</th>
              <th>Timestamp</th>
              <th>Amount paid</th>
            </tr>
          </thead>
          <tbody>
            {txs.map((node) => {
              const tx = node.transaction;
              const active = selection?.kind === "node" && selection.id === node.id;
              return (
                <tr
                  key={node.id}
                  className={cn(
                    "border-b border-border/50 last:border-0",
                    active && "bg-accent/10",
                  )}
                >
                  <td className="py-1 pr-2">
                    <button
                      type="button"
                      onClick={() =>
                        onSelect({
                          kind: "node",
                          id: transactionNodeId(tx.transaction_id),
                          reveal: true,
                        })
                      }
                      className="rounded-sm text-left hover:text-accent hover:underline"
                    >
                      <Mono
                        className={cn(
                          node.isAnchor && "text-critical",
                          verifiedIds.has(tx.transaction_id) && !node.isAnchor && "text-safe",
                        )}
                      >
                        {tx.transaction_id}
                      </Mono>
                    </button>
                  </td>
                  <td className="py-1 pr-2 text-fg-muted">{formatSourceTimestamp(tx.timestamp)}</td>
                  <td className="py-1 text-right text-fg-secondary">
                    {formatAmount(tx.amount_paid, tx.payment_currency, { compact: true })}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </div>
  );
});
