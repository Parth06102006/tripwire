"use client";

import Link from "next/link";
import type { Route } from "next";
import { useMemo, useState } from "react";
import {
  buildGraphModel,
  focusFor,
  neighborhood,
  transactionNodeId,
} from "../../lib/graph-model";
import { baseRequest, investigationErrorMessage, useInvestigation } from "../../lib/investigation";
import { Button } from "../ui/controls";
import { Card, CardHeader } from "../ui/card";
import GraphCanvas from "./graph-canvas";

interface GraphPreviewProps {
  transactionId: string | null;
  title?: string;
  /** Load without a click. Off by default so lists never trigger graph queries unprompted. */
  autoLoad?: boolean;
}

/**
 * Compact graph for a real investigation response. The investigation runs only
 * on request, because it queries FalkorDB, and reuses the Simulation cache.
 */
export default function GraphPreview({ transactionId, title = "Graph preview", autoLoad = false }: GraphPreviewProps) {
  const [requested, setRequested] = useState<string | null>(null);
  const active = transactionId !== null && (autoLoad || requested === transactionId) ? transactionId : null;
  const query = useInvestigation(active ? baseRequest(active) : null);
  const result = query.data;

  const model = useMemo(
    () => (result ? buildGraphModel(result.evidence, result.transaction_id) : null),
    [result],
  );
  const visible = useMemo(
    () => (model && result ? neighborhood(model, transactionNodeId(result.transaction_id), 2) : null),
    [model, result],
  );
  const focus = useMemo(
    () => (model && result ? focusFor(model, { kind: "node", id: transactionNodeId(result.transaction_id) }) : { nodes: new Set<string>(), edges: new Set<string>() }),
    [model, result],
  );

  const open = transactionId ? (`/simulation?transaction_id=${encodeURIComponent(transactionId)}` as Route) : null;

  return (
    <Card aria-label={title}>
      <CardHeader
        title={title}
        description={result ? `${result.evidence.transactions.length} transfers, ${result.evidence.accounts.length} accounts returned` : "Real graph query result"}
        actions={
          open ? (
            <Link href={open} className="text-xs text-accent hover:underline">
              Open in Simulation
            </Link>
          ) : null
        }
      />
      {transactionId === null ? (
        <p className="text-xs text-dim">Select an item to preview its graph.</p>
      ) : active === null ? (
        <div className="flex flex-col items-start gap-2">
          <p className="text-xs text-dim">
            Runs a bounded investigation for <span className="font-mono text-ink">{transactionId}</span> against FalkorDB.
          </p>
          <Button onClick={() => setRequested(transactionId)}>Load graph preview</Button>
        </div>
      ) : query.isError ? (
        <div role="alert" className="text-xs text-critical">
          {investigationErrorMessage(query.error)}
        </div>
      ) : !result || !model ? (
        <div role="status" aria-label="Graph preview loading" className="skeleton h-48 w-full" />
      ) : result.evidence.transactions.length === 0 ? (
        <p className="text-xs text-dim">The queries returned no graph evidence within bounds. That is not proof of safety.</p>
      ) : (
        <GraphCanvas
          model={model}
          visible={visible}
          focus={focus}
          layoutKey={result.investigation_id}
          selection={null}
          compact
          label={`Compact graph of ${result.evidence.transactions.length} returned transfers. Open Simulation for the full workspace.`}
          className="h-52 w-full rounded-control bg-canvas"
        />
      )}
    </Card>
  );
}
