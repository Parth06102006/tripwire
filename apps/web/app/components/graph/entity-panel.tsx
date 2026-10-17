"use client";

import { Fragment } from "react";
import type { InvestigationResponse } from "../../lib/api";
import { formatAmount } from "../../lib/format";
import {
  accountNodeId,
  receivedEdgeId,
  sentEdgeId,
  transactionNodeId,
  RELATION_LABEL,
  type GraphModel,
  type Selection,
} from "../../lib/graph-model";
import { StatusBadge } from "../ui/badge";
import { Metadata } from "../ui/card";
import { Disclosure } from "../ui/motion";

interface EntityPanelProps {
  model: GraphModel;
  result: InvestigationResponse;
  selection: Selection;
  onSelect: (selection: Selection) => void;
}

function EntityLink({ id, label, onSelect }: { id: string; label: string; onSelect: (s: Selection) => void }) {
  return (
    <button
      type="button"
      onClick={() => onSelect({ kind: "node", id })}
      className="break-all rounded text-left font-mono text-xs text-accent underline-offset-4 hover:underline"
    >
      {label}
    </button>
  );
}

function Heading({ type, title }: { type: string; title: string }) {
  return (
    <div>
      <StatusBadge tone="accent" icon="none">
        {type}
      </StatusBadge>
      <h2 className="mt-2 text-base font-semibold break-all text-ink">{title}</h2>
    </div>
  );
}

export default function EntityPanel({ model, result, selection, onSelect }: EntityPanelProps) {
  if (!selection) {
    return (
      <div>
        <h2 className="text-base font-semibold">Selection</h2>
        <p className="mt-2 text-xs leading-5 text-dim">
          Select an entity or relationship on the graph, or inspect a row in the evidence table.
        </p>
      </div>
    );
  }

  if (selection.kind === "path") {
    const path = model.paths[selection.index];
    if (!path) return null;
    return (
      <div className="flex flex-col gap-3">
        <Heading type="Returned path" title={`${path.direction}, depth ${path.depth}`} />
        <p className="text-xs leading-5 text-dim">
          A path returned by the graph queries. It connects {path.account_keys.length} accounts through{" "}
          {path.transaction_ids.length} transfers. The path is a structural fact about the data and
          does not by itself indicate fraud.
        </p>
        <div>
          <p className="text-xs text-dim">Accounts in order</p>
          <ol className="mt-1 flex flex-col gap-1">
            {path.account_keys.map((key, index) => (
              <li key={`${key}-${index}`} className="flex gap-2">
                <span className="font-mono text-xs text-dim">{index + 1}.</span>
                <EntityLink id={accountNodeId(key)} label={key} onSelect={onSelect} />
              </li>
            ))}
          </ol>
        </div>
        <div>
          <p className="text-xs text-dim">Evidence references</p>
          <ul className="mt-1 flex flex-col gap-1">
            {path.transaction_ids.map((id) => (
              <li key={id}>
                <EntityLink id={transactionNodeId(id)} label={id} onSelect={onSelect} />
              </li>
            ))}
          </ul>
        </div>
        <Disclosure title="Technical details">
          <pre className="max-h-60 overflow-auto font-mono text-[11px] text-dim">{JSON.stringify(path, null, 2)}</pre>
        </Disclosure>
      </div>
    );
  }

  if (selection.kind === "edge") {
    const edge = model.elements.find((element) => element.data.id === selection.id);
    if (!edge) return null;
    const txId = edge.data.txId as string;
    const tx = model.transactionsById.get(txId);
    const relation = edge.data.relation as keyof typeof RELATION_LABEL;
    const source = String(edge.data.source);
    const target = String(edge.data.target);
    return (
      <div className="flex flex-col gap-3">
        <Heading type="Relationship" title={RELATION_LABEL[relation]} />
        <p className="text-xs leading-5 text-dim">
          This link is derived from the {relation === "sent" ? "source" : "destination"} account field of
          transfer record <span className="font-mono text-ink">{txId}</span>. The transfer record is the
          source; the link is its graph representation.
        </p>
        <dl className="grid gap-2">
          <Metadata label="From">
            <EntityLink id={source} label={source.replace(/^(acc|tx):/, "")} onSelect={onSelect} />
          </Metadata>
          <Metadata label="To">
            <EntityLink id={target} label={target.replace(/^(acc|tx):/, "")} onSelect={onSelect} />
          </Metadata>
          <Metadata label="Supporting evidence">
            <EntityLink id={transactionNodeId(txId)} label={txId} onSelect={onSelect} />
          </Metadata>
        </dl>
        {tx ? (
          <Disclosure title="Technical details">
            <pre className="max-h-60 overflow-auto font-mono text-[11px] text-dim">{JSON.stringify(tx, null, 2)}</pre>
          </Disclosure>
        ) : null}
      </div>
    );
  }

  const isTransfer = selection.id.startsWith("tx:");
  const ref = selection.id.replace(/^(acc|tx):/, "");

  if (isTransfer) {
    const tx = model.transactionsById.get(ref);
    if (!tx) return null;
    const isAnchor = tx.transaction_id === result.transaction_id;
    return (
      <div className="flex flex-col gap-3">
        <Heading type={isAnchor ? "Transfer, anchor" : "Transfer"} title={tx.transaction_id} />
        <p className="text-xs leading-5 text-dim">
          Direct source record returned by a graph query.
          {isAnchor ? " This is the transaction under investigation." : ""}
        </p>
        <dl className="grid grid-cols-2 gap-2">
          <Metadata label="Paid">{formatAmount(tx.amount_paid, tx.payment_currency)}</Metadata>
          <Metadata label="Received">{formatAmount(tx.amount_received, tx.receiving_currency)}</Metadata>
          <Metadata label="Format">{tx.payment_format ?? "—"}</Metadata>
          <Metadata label="Timestamp">{tx.timestamp}</Metadata>
        </dl>
        <div>
          <p className="text-xs text-dim">Connected entities</p>
          <ul className="mt-1 flex flex-col gap-1">
            <li className="flex items-start gap-2 text-xs">
              <span className="w-16 shrink-0 text-dim">sender</span>
              <EntityLink id={accountNodeId(tx.source_account_key)} label={tx.source_account_key} onSelect={onSelect} />
            </li>
            <li className="flex items-start gap-2 text-xs">
              <span className="w-16 shrink-0 text-dim">receiver</span>
              <EntityLink id={accountNodeId(tx.destination_account_key)} label={tx.destination_account_key} onSelect={onSelect} />
            </li>
          </ul>
        </div>
        <div>
          <p className="text-xs text-dim">Relationships</p>
          <ul className="mt-1 flex flex-col gap-1 text-xs">
            <li>
              <button type="button" className="text-left text-accent hover:underline" onClick={() => onSelect({ kind: "edge", id: sentEdgeId(tx.transaction_id) })}>
                sender sent this transfer
              </button>
            </li>
            <li>
              <button type="button" className="text-left text-accent hover:underline" onClick={() => onSelect({ kind: "edge", id: receivedEdgeId(tx.transaction_id) })}>
                transfer received by receiver
              </button>
            </li>
          </ul>
        </div>
        <Disclosure title="Technical details">
          <pre className="max-h-60 overflow-auto font-mono text-[11px] text-dim">{JSON.stringify(tx, null, 2)}</pre>
        </Disclosure>
      </div>
    );
  }

  const sent = result.evidence.transactions.filter((tx) => tx.source_account_key === ref);
  const received = result.evidence.transactions.filter((tx) => tx.destination_account_key === ref);
  const counterparties = new Set<string>();
  sent.forEach((tx) => counterparties.add(tx.destination_account_key));
  received.forEach((tx) => counterparties.add(tx.source_account_key));
  return (
    <div className="flex flex-col gap-3">
      <Heading type="Account" title={ref} />
      <p className="text-xs leading-5 text-dim">
        Counts cover returned evidence only. This account may have other activity outside the query
        bounds.
      </p>
      <dl className="grid grid-cols-3 gap-2">
        <Metadata label="Sent">{sent.length}</Metadata>
        <Metadata label="Received">{received.length}</Metadata>
        <Metadata label="Counterparties">{counterparties.size}</Metadata>
      </dl>
      {counterparties.size > 0 ? (
        <div>
          <p className="text-xs text-dim">Connected accounts</p>
          <ul className="mt-1 flex max-h-40 flex-col gap-1 overflow-auto">
            {[...counterparties].map((key) => (
              <li key={key}>
                <EntityLink id={accountNodeId(key)} label={key} onSelect={onSelect} />
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <div>
        <p className="text-xs text-dim">Evidence references</p>
        <ul className="mt-1 flex max-h-40 flex-col gap-1 overflow-auto">
          {[...sent, ...received].map((tx) => (
            <Fragment key={tx.transaction_id}>
              <li>
                <EntityLink id={transactionNodeId(tx.transaction_id)} label={tx.transaction_id} onSelect={onSelect} />
              </li>
            </Fragment>
          ))}
        </ul>
      </div>
    </div>
  );
}
