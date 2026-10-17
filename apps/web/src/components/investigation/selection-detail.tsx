"use client";

import { Landmark, MousePointerClick, ShieldCheck, Siren } from "lucide-react";
import type { ReactNode } from "react";

import { EmptyState, Mono } from "@/components/shared/states";
import { Badge } from "@/components/ui/badge";
import type { TransactionEvidence } from "@/lib/api-schemas";
import { formatAmount, formatSourceTimestamp, splitAccountKey } from "@/lib/formatters";
import type { Selection } from "@/lib/graph/flow";
import {
  accountActivity,
  accountNodeId,
  describePathDirection,
  transactionNodeId,
  type EvidencePath,
  type InvestigationGraph,
} from "@/lib/graph/model";

type Props = {
  graph: InvestigationGraph;
  selection: Selection;
  pathsById: ReadonlyMap<string, EvidencePath>;
  verifiedIds: ReadonlySet<string>;
  onSelect: (selection: Selection) => void;
};

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[7.5rem_1fr] gap-2 py-1.5 text-xs">
      <dt className="text-fg-muted">{label}</dt>
      <dd className="min-w-0 break-words text-fg">{children}</dd>
    </div>
  );
}

function AccountLink({
  accountKey,
  onSelect,
}: {
  accountKey: string;
  onSelect: Props["onSelect"];
}) {
  return (
    <button
      type="button"
      className="rounded-sm text-left hover:text-accent hover:underline"
      onClick={() => onSelect({ kind: "node", id: accountNodeId(accountKey), reveal: true })}
    >
      <Mono>{accountKey}</Mono>
    </button>
  );
}

function TransactionLink({
  tx,
  onSelect,
}: {
  tx: TransactionEvidence;
  onSelect: Props["onSelect"];
}) {
  return (
    <button
      type="button"
      onClick={() =>
        onSelect({ kind: "node", id: transactionNodeId(tx.transaction_id), reveal: true })
      }
      className="flex w-full items-baseline justify-between gap-2 rounded-sm px-1.5 py-1 text-left text-xs hover:bg-surface-elevated"
    >
      <Mono className="truncate">{tx.transaction_id}</Mono>
      <span className="shrink-0 text-fg-secondary">
        {formatAmount(tx.amount_paid, tx.payment_currency)}
      </span>
    </button>
  );
}

function pathsContaining(
  paths: ReadonlyMap<string, EvidencePath>,
  transactionId: string,
): EvidencePath[] {
  return [...paths.values()].filter((p) => p.path.transaction_ids.includes(transactionId));
}

export function SelectionDetail({ graph, selection, pathsById, verifiedIds, onSelect }: Props) {
  if (!selection) {
    return (
      <EmptyState icon={MousePointerClick} title="Select an element to inspect it">
        Click an account, transaction, or edge on the graph, or pick a path in the Evidence tab.
        Every value shown comes from a record the graph queries returned.
      </EmptyState>
    );
  }

  if (selection.kind === "elements") return null;

  if (selection.kind === "path") {
    const entry = pathsById.get(selection.id);
    if (!entry) return null;
    const { path } = entry;
    return (
      <div className="p-4">
        <h3 className="text-sm font-semibold">{describePathDirection(path.direction)}</h3>
        <p className="mt-0.5 text-xs text-fg-muted">
          Depth {path.depth}, first returned by run {entry.firstSeq}
        </p>
        <ol className="mt-3 space-y-1 border-l border-accent/50 pl-3">
          {path.account_keys.map((key, index) => {
            const txId = path.transaction_ids[index];
            const tx = txId ? graph.nodes.get(transactionNodeId(txId)) : undefined;
            return (
              <li key={`${key}-${index}`} className="text-xs">
                <AccountLink accountKey={key} onSelect={onSelect} />
                {txId ? (
                  <div className="my-1 ml-2 text-fg-secondary">
                    {tx?.kind === "transaction" ? (
                      <TransactionLink tx={tx.transaction} onSelect={onSelect} />
                    ) : (
                      <Mono>{txId}</Mono>
                    )}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ol>
      </div>
    );
  }

  if (selection.kind === "edge") {
    const edge = graph.edges.get(selection.id);
    if (!edge) return null;
    const tx = graph.nodes.get(transactionNodeId(edge.transactionId));
    return (
      <div className="p-4">
        <h3 className="text-sm font-semibold">
          {edge.kind === "sent" ? "SENT relationship" : "RECEIVED relationship"}
        </h3>
        <dl className="mt-2 divide-y divide-border">
          <Field label="Direction">
            {edge.kind === "sent" ? "Account to transaction" : "Transaction to account"}
          </Field>
          <Field label={edge.kind === "sent" ? "Amount paid" : "Amount received"}>
            <span>{formatAmount(edge.amount, edge.currency)}</span>
          </Field>
          <Field label="Timestamp">{formatSourceTimestamp(edge.timestamp)}</Field>
          <Field label="Transaction">
            {tx?.kind === "transaction" ? (
              <TransactionLink tx={tx.transaction} onSelect={onSelect} />
            ) : (
              <Mono>{edge.transactionId}</Mono>
            )}
          </Field>
        </dl>
      </div>
    );
  }

  const node = graph.nodes.get(selection.id);
  if (!node) return null;

  if (node.kind === "account") {
    const { bank, account } = splitAccountKey(node.accountKey);
    const activity = accountActivity(graph, node.accountKey);
    return (
      <div className="p-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Landmark className="size-4 text-fg-muted" aria-hidden /> Account
        </h3>
        <dl className="mt-2 divide-y divide-border">
          <Field label="Account key">
            <Mono>{node.accountKey}</Mono>
          </Field>
          <Field label="Bank">{bank ? <Mono>{bank}</Mono> : "Not encoded in key"}</Field>
          <Field label="Account">
            <Mono>{account}</Mono>
          </Field>
          <Field label="First returned">Run {node.firstSeq}</Field>
        </dl>
        {[
          { label: "Sent", items: activity.sent },
          { label: "Received", items: activity.received },
        ].map(({ label, items }) => (
          <div key={label} className="mt-4">
            <p className="mb-1 text-xs font-medium text-fg-secondary">
              {label} in returned evidence ({items.length})
            </p>
            {items.length === 0 ? (
              <p className="text-xs text-fg-muted">None returned.</p>
            ) : (
              <ul>
                {items.map((tx) => (
                  <li key={tx.transaction_id}>
                    <TransactionLink tx={tx} onSelect={onSelect} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
        <p className="mt-4 text-[11px] text-fg-muted">
          Only activity inside the investigation bounds is listed; the account may have other
          transfers.
        </p>
      </div>
    );
  }

  const tx = node.transaction;
  const verified = verifiedIds.has(tx.transaction_id);
  const containing = pathsContaining(pathsById, tx.transaction_id);
  return (
    <div className="p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold">Transaction</h3>
        {node.isAnchor ? (
          <Badge tone="critical">
            <Siren aria-hidden />
            Alert
          </Badge>
        ) : null}
        {verified ? (
          <Badge tone="verified">
            <ShieldCheck aria-hidden />
            Cited by verified report
          </Badge>
        ) : (
          <Badge>Returned, not cited</Badge>
        )}
      </div>
      <dl className="mt-2 divide-y divide-border">
        <Field label="Transaction ID">
          <Mono>{tx.transaction_id}</Mono>
        </Field>
        <Field label="Timestamp">{formatSourceTimestamp(tx.timestamp)}</Field>
        <Field label="From">
          <AccountLink accountKey={tx.source_account_key} onSelect={onSelect} />
        </Field>
        <Field label="To">
          <AccountLink accountKey={tx.destination_account_key} onSelect={onSelect} />
        </Field>
        <Field label="Amount paid">
          <span>{formatAmount(tx.amount_paid, tx.payment_currency)}</span>
        </Field>
        <Field label="Amount received">
          <span>{formatAmount(tx.amount_received, tx.receiving_currency)}</span>
        </Field>
        <Field label="Payment format">{tx.payment_format ?? "Not returned"}</Field>
        <Field label="First returned">Run {node.firstSeq}</Field>
      </dl>
      <div className="mt-4">
        <p className="mb-1 text-xs font-medium text-fg-secondary">
          On returned paths ({containing.length})
        </p>
        {containing.length === 0 ? (
          <p className="text-xs text-fg-muted">
            Returned by counterparty inspection, not on a traced path.
          </p>
        ) : (
          <ul className="space-y-0.5">
            {containing.slice(0, 12).map((entry) => (
              <li key={entry.id}>
                <button
                  type="button"
                  onClick={() => onSelect({ kind: "path", id: entry.id })}
                  className="w-full rounded-sm px-1.5 py-1 text-left text-xs text-fg-secondary hover:bg-surface-elevated hover:text-fg"
                >
                  {describePathDirection(entry.path.direction)}, depth {entry.path.depth},{" "}
                  {entry.path.transaction_ids.length} transfers
                </button>
              </li>
            ))}
            {containing.length > 12 ? (
              <li className="px-1.5 text-[11px] text-fg-muted">
                {containing.length - 12} more in the Evidence tab
              </li>
            ) : null}
          </ul>
        )}
      </div>
    </div>
  );
}
