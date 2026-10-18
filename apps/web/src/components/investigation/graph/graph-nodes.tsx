"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import { ShieldCheck } from "lucide-react";
import { memo } from "react";

import { cn } from "@/lib/cn";
import type { AccountFlowNode, TransactionFlowNode } from "@/lib/graph/flow";
import {
  currencyCode,
  formatAmount,
  formatSourceTimestamp,
  splitAccountKey,
} from "@/lib/formatters";

// Edges attach to fixed side handles; the analyst never draws edges.
function Handles() {
  return (
    <>
      <Handle
        type="target"
        position={Position.Left}
        isConnectable={false}
        className="!size-1 !min-h-0 !min-w-0 !border-0 !bg-transparent"
      />
      <Handle
        type="source"
        position={Position.Right}
        isConnectable={false}
        className="!size-1 !min-h-0 !min-w-0 !border-0 !bg-transparent"
      />
    </>
  );
}

const ROLE_LABEL = {
  alert_sender: "Alert sender",
  alert_receiver: "Alert receiver",
  alert_both: "Alert sender and receiver",
} as const;

/**
 * Account: a quiet rectangle, account number in mono, bank beneath. The
 * two accounts of the alert transfer carry a red edge and their role.
 */
export const AccountNode = memo(function AccountNode({ data }: NodeProps<AccountFlowNode>) {
  const { bank, account } = splitAccountKey(data.accountKey);
  return (
    <div
      className={cn(
        "graph-node flex h-full w-full flex-col justify-center rounded-md border bg-card px-3",
        data.role ? "border-critical/45" : "border-line-strong",
      )}
      title={data.accountKey}
    >
      <Handles />
      <span className="truncate font-mono text-[11px] leading-tight text-fg">{account}</span>
      <span className="truncate text-[10px] leading-tight text-fg-muted">
        {data.role ? (
          <span className="text-critical/90">{ROLE_LABEL[data.role]}</span>
        ) : bank ? (
          `bank ${bank}`
        ) : (
          "account"
        )}
      </span>
    </div>
  );
});

function TransactionBody({ data, alert }: { data: TransactionFlowNode["data"]; alert: boolean }) {
  const tx = data.transaction;
  const crossCurrency =
    tx.receiving_currency && tx.payment_currency && tx.receiving_currency !== tx.payment_currency;
  return (
    <div
      className={cn(
        "graph-node relative flex h-full w-full flex-col justify-center rounded-full border px-3.5",
        alert
          ? "graph-node-alert border-critical bg-[#2a1614]"
          : data.verified
            ? "border-safe/40 bg-[#14201a]"
            : "border-line-strong bg-raised",
      )}
      title={tx.transaction_id}
    >
      <Handles />
      <span className="flex items-center gap-1">
        <span
          className={cn(
            "truncate text-[11px] leading-tight font-semibold",
            alert ? "text-[#ffd9d5]" : "text-fg",
          )}
        >
          {formatAmount(tx.amount_paid, tx.payment_currency, { compact: true })}
          {crossCurrency ? (
            <span className="font-normal text-fg-muted">
              {" "}
              to {currencyCode(tx.receiving_currency)}
            </span>
          ) : null}
        </span>
        {data.verified && !alert ? (
          <ShieldCheck
            className="ml-auto size-3 shrink-0 text-safe"
            aria-label="Cited by the verified report"
          />
        ) : null}
      </span>
      <span className="truncate text-[10px] leading-tight text-fg-muted">
        {alert ? <span className="text-critical">Alert </span> : null}
        {formatSourceTimestamp(tx.timestamp).slice(5)}
      </span>
    </div>
  );
}

/** Transaction: a pill with the amount paid and when; the alert glows red. */
export const TransactionNode = memo(function TransactionNode({
  data,
}: NodeProps<TransactionFlowNode>) {
  return <TransactionBody data={data} alert={false} />;
});

export const AlertNode = memo(function AlertNode({ data }: NodeProps<TransactionFlowNode>) {
  return <TransactionBody data={data} alert />;
});

export const nodeTypes = {
  account: AccountNode,
  transaction: TransactionNode,
  alert: AlertNode,
};
