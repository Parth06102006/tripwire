/**
 * Investigation graph built only from records the API returned.
 *
 * Mirrors the graph contract: accounts and transactions are both nodes,
 * linked as (:Account)-[:SENT]->(:Transaction)-[:RECEIVED]->(:Account).
 * Element IDs are derived from source identifiers, so merging a later batch
 * keeps every existing element and adds only what is new.
 */
import type {
  EvidenceDelta,
  GraphPath,
  InvestigationReport,
  TransactionEvidence,
} from "@/lib/api-schemas";

/**
 * Evidence returned by one tool call (or one whole response), in arrival
 * order. `seq` is 1-based and increases with every batch.
 */
export type EvidenceBatch = EvidenceDelta & {
  seq: number;
  anchorTransactionId: string;
};

export type AccountNode = {
  kind: "account";
  id: string;
  accountKey: string;
  firstSeq: number;
};

export type TransactionNode = {
  kind: "transaction";
  id: string;
  transaction: TransactionEvidence;
  isAnchor: boolean;
  firstSeq: number;
};

export type GraphNode = AccountNode | TransactionNode;

export type GraphEdge = {
  id: string;
  /** SENT runs account to transaction; RECEIVED runs transaction to account. */
  kind: "sent" | "received";
  source: string;
  target: string;
  transactionId: string;
  amount: number | null;
  currency: string | null;
  timestamp: string;
  firstSeq: number;
};

export type EvidencePath = {
  id: string;
  path: GraphPath;
  firstSeq: number;
};

export type InvestigationGraph = {
  nodes: Map<string, GraphNode>;
  edges: Map<string, GraphEdge>;
  paths: EvidencePath[];
  anchorTransactionId: string | null;
  /** Sequence number of the newest batch merged in; 0 when empty. */
  latestSeq: number;
};

export const accountNodeId = (accountKey: string) => `account:${accountKey}`;
export const transactionNodeId = (transactionId: string) => `tx:${transactionId}`;
export const sentEdgeId = (transactionId: string) => `sent:${transactionId}`;
export const receivedEdgeId = (transactionId: string) => `received:${transactionId}`;

export function pathId(path: GraphPath): string {
  return [
    path.direction,
    path.depth,
    path.transaction_ids.join(","),
    path.account_keys.join(","),
  ].join("|");
}

export function emptyGraph(): InvestigationGraph {
  return { nodes: new Map(), edges: new Map(), paths: [], anchorTransactionId: null, latestSeq: 0 };
}

/** Merge batches in order. The first batch to return an element owns it. */
export function buildInvestigationGraph(batches: readonly EvidenceBatch[]): InvestigationGraph {
  const graph = emptyGraph();
  const seenPaths = new Set<string>();

  for (const batch of batches) {
    const { seq, anchorTransactionId } = batch;
    graph.latestSeq = seq;
    graph.anchorTransactionId = anchorTransactionId;

    const addAccount = (accountKey: string) => {
      const id = accountNodeId(accountKey);
      if (!graph.nodes.has(id))
        graph.nodes.set(id, { kind: "account", id, accountKey, firstSeq: seq });
    };

    for (const account of batch.accounts) addAccount(account.account_key);

    for (const transaction of batch.transactions) {
      const txId = transactionNodeId(transaction.transaction_id);
      if (graph.nodes.has(txId)) continue;
      addAccount(transaction.source_account_key);
      addAccount(transaction.destination_account_key);
      graph.nodes.set(txId, {
        kind: "transaction",
        id: txId,
        transaction,
        isAnchor: transaction.transaction_id === anchorTransactionId,
        firstSeq: seq,
      });
      graph.edges.set(sentEdgeId(transaction.transaction_id), {
        id: sentEdgeId(transaction.transaction_id),
        kind: "sent",
        source: accountNodeId(transaction.source_account_key),
        target: txId,
        transactionId: transaction.transaction_id,
        amount: transaction.amount_paid ?? null,
        currency: transaction.payment_currency ?? null,
        timestamp: transaction.timestamp,
        firstSeq: seq,
      });
      graph.edges.set(receivedEdgeId(transaction.transaction_id), {
        id: receivedEdgeId(transaction.transaction_id),
        kind: "received",
        source: txId,
        target: accountNodeId(transaction.destination_account_key),
        transactionId: transaction.transaction_id,
        amount: transaction.amount_received ?? null,
        currency: transaction.receiving_currency ?? null,
        timestamp: transaction.timestamp,
        firstSeq: seq,
      });
    }

    for (const path of batch.paths) {
      const id = pathId(path);
      if (seenPaths.has(id)) continue;
      seenPaths.add(id);
      graph.paths.push({ id, path, firstSeq: seq });
    }
  }
  return graph;
}

export type GraphCounts = { accounts: number; transactions: number; edges: number; paths: number };

export function graphCounts(graph: InvestigationGraph): GraphCounts {
  let accounts = 0;
  let transactions = 0;
  for (const node of graph.nodes.values()) {
    if (node.kind === "account") accounts += 1;
    else transactions += 1;
  }
  return { accounts, transactions, edges: graph.edges.size, paths: graph.paths.length };
}

export function transactions(graph: InvestigationGraph): TransactionNode[] {
  const result: TransactionNode[] = [];
  for (const node of graph.nodes.values()) if (node.kind === "transaction") result.push(node);
  return result;
}

/** Node and edge IDs a path covers, for highlighting. */
export function pathElementIds(path: GraphPath): { nodeIds: Set<string>; edgeIds: Set<string> } {
  const nodeIds = new Set<string>();
  const edgeIds = new Set<string>();
  for (const key of path.account_keys) nodeIds.add(accountNodeId(key));
  for (const txId of path.transaction_ids) {
    nodeIds.add(transactionNodeId(txId));
    edgeIds.add(sentEdgeId(txId));
    edgeIds.add(receivedEdgeId(txId));
  }
  return { nodeIds, edgeIds };
}

/**
 * Transactions the validated report cites. A report reaches the UI only
 * after the API's verifier accepted every reference, so these are the
 * records shown as verified evidence.
 */
export function verifiedTransactionIds(
  report: InvestigationReport | null | undefined,
): Set<string> {
  if (!report || report.validation !== "validated") return new Set();
  const ids = new Set(report.supporting_transaction_ids);
  for (const claim of report.cited_claims) ids.add(claim.transaction_id);
  for (const path of report.cited_paths) for (const id of path.transaction_ids) ids.add(id);
  for (const point of report.reasoning) for (const id of point.evidence_ids) ids.add(id);
  return ids;
}

export type AccountActivity = { sent: TransactionEvidence[]; received: TransactionEvidence[] };

export function accountActivity(graph: InvestigationGraph, accountKey: string): AccountActivity {
  const sent: TransactionEvidence[] = [];
  const received: TransactionEvidence[] = [];
  for (const node of graph.nodes.values()) {
    if (node.kind !== "transaction") continue;
    if (node.transaction.source_account_key === accountKey) sent.push(node.transaction);
    if (node.transaction.destination_account_key === accountKey) received.push(node.transaction);
  }
  return { sent, received };
}

/** Human label for a returned path's direction field. */
export function describePathDirection(direction: string): string {
  if (direction.startsWith("pattern:")) {
    const pattern = direction.slice("pattern:".length);
    if (pattern === "fan_out") return "Fan-out pattern";
    if (pattern === "fan_in") return "Fan-in pattern";
    if (pattern === "pass_through") return "Pass-through pattern";
    return `Pattern ${pattern}`;
  }
  if (direction === "both") return "Traced funds";
  if (direction === "outgoing") return "Traced funds outgoing";
  if (direction === "incoming") return "Traced funds incoming";
  return `Traced ${direction}`;
}
