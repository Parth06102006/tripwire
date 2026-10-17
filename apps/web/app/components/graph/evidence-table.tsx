"use client";

import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { useMemo, useState } from "react";
import type { InvestigationEvidence } from "../../lib/api";
import { formatAmount } from "../../lib/format";
import { transactionNodeId, type Selection } from "../../lib/graph-model";
import { Card, CardHeader, cx } from "../ui/card";
import { Button, TextInput } from "../ui/controls";
import { StatusBadge } from "../ui/badge";

type Row =
  | { kind: "transfer"; key: string; sortTime: string; index: number; txId: string }
  | { kind: "path"; key: string; sortTime: string; index: number };

type SortKey = "type" | "time";

interface EvidenceTableProps {
  evidence: InvestigationEvidence;
  selection: Selection;
  selectedTransactionId: string | null;
  onSelect: (selection: Selection) => void;
}

export default function EvidenceTable({
  evidence,
  selection,
  selectedTransactionId,
  onSelect,
}: EvidenceTableProps) {
  const [filter, setFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "transfer" | "path">("all");
  const [sort, setSort] = useState<{ key: SortKey; direction: 1 | -1 }>({ key: "time", direction: 1 });

  const rows = useMemo<Row[]>(() => {
    const transfers: Row[] = evidence.transactions.map((tx, index) => ({
      kind: "transfer",
      key: `tx:${tx.transaction_id}`,
      sortTime: tx.timestamp,
      index,
      txId: tx.transaction_id,
    }));
    const paths: Row[] = evidence.paths.map((_, index) => ({
      kind: "path",
      key: `path:${index}`,
      sortTime: "",
      index,
    }));
    return [...paths, ...transfers];
  }, [evidence]);

  const text = (row: Row): string => {
    if (row.kind === "transfer") {
      const tx = evidence.transactions[row.index];
      return `${tx.transaction_id} ${tx.source_account_key} ${tx.destination_account_key} ${tx.payment_format ?? ""}`.toLowerCase();
    }
    const path = evidence.paths[row.index];
    return `${path.direction} ${path.account_keys.join(" ")} ${path.transaction_ids.join(" ")}`.toLowerCase();
  };

  const visible = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    const filtered = rows.filter(
      (row) =>
        (typeFilter === "all" || row.kind === typeFilter) &&
        (needle === "" || text(row).includes(needle)),
    );
    return [...filtered].sort((a, b) => {
      const primary =
        sort.key === "type" ? a.kind.localeCompare(b.kind) : a.sortTime.localeCompare(b.sortTime);
      return primary * sort.direction || a.index - b.index;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, filter, typeFilter, sort]);

  const toggleSort = (key: SortKey) =>
    setSort((previous) =>
      previous.key === key ? { key, direction: previous.direction === 1 ? -1 : 1 } : { key, direction: 1 },
    );

  const sortIcon = (key: SortKey) =>
    sort.key !== key ? (
      <ArrowUpDown aria-hidden="true" className="h-3 w-3" />
    ) : sort.direction === 1 ? (
      <ArrowUp aria-hidden="true" className="h-3 w-3 text-accent" />
    ) : (
      <ArrowDown aria-hidden="true" className="h-3 w-3 text-accent" />
    );

  const ariaSort = (key: SortKey) =>
    sort.key !== key ? "none" : sort.direction === 1 ? "ascending" : "descending";

  return (
    <Card aria-label="Evidence" padded={false}>
      <div className="p-4 pb-0 sm:px-6 sm:pt-6">
        <CardHeader
          title="Evidence"
          description="Records returned by the executed graph queries. Selecting a row highlights its graph elements."
          actions={
            <>
              <TextInput
                aria-label="Filter evidence"
                placeholder="Filter by id, account or format"
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
                className="w-56 font-mono"
              />
              <select
                aria-label="Evidence type"
                value={typeFilter}
                onChange={(event) => setTypeFilter(event.target.value as typeof typeFilter)}
                className="rounded-control border border-line-strong bg-raised px-2 py-1.5 text-xs text-ink"
              >
                <option value="all">All types</option>
                <option value="transfer">Transfer records</option>
                <option value="path">Paths</option>
              </select>
            </>
          }
        />
      </div>
      {visible.length === 0 ? (
        <p className="px-6 pb-6 text-xs text-dim">
          {rows.length === 0
            ? "The executed queries returned no evidence. An empty result is not proof that nothing exists outside the query bounds."
            : "No evidence matches the current filter."}
        </p>
      ) : (
        <div className="max-h-[420px] overflow-auto">
          <table className="w-full min-w-[820px] border-collapse text-left text-xs">
            <thead className="sticky top-0 bg-card">
              <tr className="border-y border-line text-dim">
                <th scope="col" aria-sort={ariaSort("type")} className="px-4 py-2 font-medium sm:pl-6">
                  <button type="button" onClick={() => toggleSort("type")} className="inline-flex items-center gap-1 hover:text-ink">
                    Type {sortIcon("type")}
                  </button>
                </th>
                <th scope="col" className="px-4 py-2 font-medium">Record / explanation</th>
                <th scope="col" className="px-4 py-2 font-medium">Source</th>
                <th scope="col" className="px-4 py-2 font-medium">Related entity</th>
                <th scope="col" aria-sort={ariaSort("time")} className="px-4 py-2 font-medium">
                  <button type="button" onClick={() => toggleSort("time")} className="inline-flex items-center gap-1 hover:text-ink">
                    Timestamp {sortIcon("time")}
                  </button>
                </th>
                <th scope="col" className="px-4 py-2 font-medium sm:pr-6">Action</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => {
                const selected =
                  row.kind === "transfer"
                    ? selectedTransactionId === row.txId
                    : selection?.kind === "path" && selection.index === row.index;
                const inspect = () =>
                  onSelect(
                    row.kind === "transfer"
                      ? { kind: "node", id: transactionNodeId(row.txId) }
                      : { kind: "path", index: row.index },
                  );
                if (row.kind === "transfer") {
                  const tx = evidence.transactions[row.index];
                  return (
                    <tr
                      key={row.key}
                      aria-selected={selected}
                      className={cx("selectable border-b border-line last:border-0 hover:bg-hover", selected && "bg-accent-soft")}
                    >
                      <td className="px-4 py-2.5 sm:pl-6">
                        <StatusBadge tone="neutral" icon="none">Transfer record</StatusBadge>
                      </td>
                      <td className="px-4 py-2.5">
                        <p className="font-mono text-ink">{tx.transaction_id}</p>
                        <p className="text-dim">
                          {formatAmount(tx.amount_paid, tx.payment_currency)}
                          {tx.payment_format ? ` via ${tx.payment_format}` : ""}
                        </p>
                      </td>
                      <td className="px-4 py-2.5 text-dim">Graph query result (source record)</td>
                      <td className="max-w-64 px-4 py-2.5 font-mono break-all text-dim">
                        {tx.source_account_key} → {tx.destination_account_key}
                      </td>
                      <td className="px-4 py-2.5 font-mono whitespace-nowrap text-dim">{tx.timestamp}</td>
                      <td className="px-4 py-2.5 sm:pr-6">
                        <Button onClick={inspect} aria-pressed={selected} aria-label={`Inspect transfer ${tx.transaction_id}`}>
                          Inspect
                        </Button>
                      </td>
                    </tr>
                  );
                }
                const path = evidence.paths[row.index];
                return (
                  <tr
                    key={row.key}
                    aria-selected={selected}
                    className={cx("selectable border-b border-line last:border-0 hover:bg-hover", selected && "bg-accent-soft")}
                  >
                    <td className="px-4 py-2.5 sm:pl-6">
                      <StatusBadge tone="accent" icon="none">Path</StatusBadge>
                    </td>
                    <td className="px-4 py-2.5">
                      <p className="text-ink">
                        {path.direction}, depth {path.depth}
                      </p>
                      <p className="text-dim">{path.transaction_ids.length} transfers across {path.account_keys.length} accounts</p>
                    </td>
                    <td className="px-4 py-2.5 text-dim">Graph path query (derived from records)</td>
                    <td className="max-w-64 px-4 py-2.5 font-mono break-all text-dim">
                      {path.account_keys.join(" → ")}
                    </td>
                    <td className="px-4 py-2.5 text-dim">—</td>
                    <td className="px-4 py-2.5 sm:pr-6">
                      <Button onClick={inspect} aria-pressed={selected} aria-label={`Inspect path ${row.index + 1}`}>
                        Inspect
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
