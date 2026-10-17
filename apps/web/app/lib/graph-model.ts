import type { ElementDefinition } from "cytoscape";
import type { GraphPath, InvestigationEvidence, TransactionEvidence } from "./api";

export type NodeKind = "account" | "transaction";
export type Relation = "sent" | "received_by";

export const RELATION_LABEL: Record<Relation, string> = {
  sent: "sent",
  received_by: "received by",
};

export const accountNodeId = (key: string) => `acc:${key}`;
export const transactionNodeId = (id: string) => `tx:${id}`;
export const sentEdgeId = (txId: string) => `sent:${txId}`;
export const receivedEdgeId = (txId: string) => `recv:${txId}`;

export type Selection =
  | { kind: "node"; id: string }
  | { kind: "edge"; id: string }
  | { kind: "path"; index: number }
  | null;

export interface GraphModel {
  elements: ElementDefinition[];
  transactionsById: Map<string, TransactionEvidence>;
  /** Node ids adjacent to each node, over returned evidence only. */
  neighbors: Map<string, Set<string>>;
  /** Edge ids incident to each node. */
  incident: Map<string, Set<string>>;
  paths: GraphPath[];
}

/** Every element comes from a returned transfer; nothing is inferred. */
export function buildGraphModel(
  evidence: InvestigationEvidence,
  anchorTransactionId: string,
): GraphModel {
  const elements: ElementDefinition[] = [];
  const seen = new Set<string>();
  const neighbors = new Map<string, Set<string>>();
  const incident = new Map<string, Set<string>>();
  const transactionsById = new Map<string, TransactionEvidence>();

  const link = (map: Map<string, Set<string>>, from: string, to: string) => {
    const set = map.get(from) ?? new Set<string>();
    set.add(to);
    map.set(from, set);
  };

  const addNode = (id: string, label: string, kind: NodeKind, ref: string) => {
    if (seen.has(id)) return;
    seen.add(id);
    elements.push({
      data: { id, label, kind, ref, anchor: ref === anchorTransactionId && kind === "transaction" ? 1 : 0 },
    });
  };

  const addEdge = (id: string, source: string, target: string, relation: Relation, txId: string) => {
    elements.push({
      data: { id, source, target, relation, label: RELATION_LABEL[relation], txId },
    });
    link(neighbors, source, target);
    link(neighbors, target, source);
    link(incident, source, id);
    link(incident, target, id);
  };

  for (const account of evidence.accounts) {
    addNode(accountNodeId(account.account_key), account.account_key, "account", account.account_key);
  }
  for (const tx of evidence.transactions) {
    transactionsById.set(tx.transaction_id, tx);
    const txNode = transactionNodeId(tx.transaction_id);
    const from = accountNodeId(tx.source_account_key);
    const to = accountNodeId(tx.destination_account_key);
    addNode(txNode, tx.transaction_id, "transaction", tx.transaction_id);
    addNode(from, tx.source_account_key, "account", tx.source_account_key);
    addNode(to, tx.destination_account_key, "account", tx.destination_account_key);
    addEdge(sentEdgeId(tx.transaction_id), from, txNode, "sent", tx.transaction_id);
    addEdge(receivedEdgeId(tx.transaction_id), txNode, to, "received_by", tx.transaction_id);
  }

  return { elements, transactionsById, neighbors, incident, paths: evidence.paths };
}

export interface FocusSet {
  nodes: Set<string>;
  edges: Set<string>;
}

const EMPTY_FOCUS: FocusSet = { nodes: new Set(), edges: new Set() };

/** Elements a selection points at, resolved against returned evidence. */
export function focusFor(model: GraphModel, selection: Selection): FocusSet {
  if (!selection) return EMPTY_FOCUS;
  if (selection.kind === "node") {
    return {
      nodes: new Set([selection.id]),
      edges: new Set(model.incident.get(selection.id) ?? []),
    };
  }
  if (selection.kind === "edge") {
    const edge = model.elements.find((element) => element.data.id === selection.id);
    if (!edge) return EMPTY_FOCUS;
    return {
      nodes: new Set([edge.data.source as string, edge.data.target as string]),
      edges: new Set([selection.id]),
    };
  }
  const path = model.paths[selection.index];
  if (!path) return EMPTY_FOCUS;
  const nodes = new Set<string>([
    ...path.account_keys.map(accountNodeId),
    ...path.transaction_ids.map(transactionNodeId),
  ]);
  const edges = new Set<string>();
  for (const txId of path.transaction_ids) {
    edges.add(sentEdgeId(txId));
    edges.add(receivedEdgeId(txId));
  }
  return { nodes, edges };
}

/** Explore mode: the selected node plus neighbours out to `depth` hops. */
export function neighborhood(model: GraphModel, rootId: string, depth: number): FocusSet {
  const nodes = new Set<string>([rootId]);
  let frontier = [rootId];
  for (let hop = 0; hop < depth; hop += 1) {
    const next: string[] = [];
    for (const id of frontier) {
      for (const neighbor of model.neighbors.get(id) ?? []) {
        if (!nodes.has(neighbor)) {
          nodes.add(neighbor);
          next.push(neighbor);
        }
      }
    }
    frontier = next;
  }
  const edges = new Set<string>();
  for (const element of model.elements) {
    const { source, target, id } = element.data;
    if (source && target && nodes.has(source as string) && nodes.has(target as string)) {
      edges.add(id as string);
    }
  }
  return { nodes, edges };
}

/** Transaction id that backs a selection, when one exists. */
export function selectedTransactionId(model: GraphModel, selection: Selection): string | null {
  if (!selection || selection.kind === "path") return null;
  if (selection.kind === "edge") {
    const edge = model.elements.find((element) => element.data.id === selection.id);
    return (edge?.data.txId as string | undefined) ?? null;
  }
  return selection.id.startsWith("tx:") ? selection.id.slice(3) : null;
}
