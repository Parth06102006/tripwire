/**
 * Mapping from the investigation graph to React Flow elements. Pure, so the
 * canvas can derive elements without effects, and so it can be tested without
 * a DOM.
 *
 * Selection never rebuilds nodes or edges. Emphasis (focus, related, dimmed)
 * is a generated stylesheet keyed on the `data-id` attribute React Flow puts
 * on every node and edge wrapper; only the few edges that gain or lose an
 * amount label get new objects.
 */
import type { Edge, Node } from "@xyflow/react";

import type { TransactionEvidence } from "@/lib/api-schemas";
import { NODE_SIZE, type Point } from "@/lib/graph/layout";
import {
  pathElementIds,
  transactionNodeId,
  type EvidencePath,
  type GraphEdge,
  type InvestigationGraph,
} from "@/lib/graph/model";

export type AccountNodeData = {
  accountKey: string;
  /** Whether this account sent or received the alert transfer. */
  role: "alert_sender" | "alert_receiver" | "alert_both" | null;
  isNew: boolean;
};

export type TransactionNodeData = {
  transaction: TransactionEvidence;
  verified: boolean;
  isNew: boolean;
};

export type FlowEdgeData = {
  kind: GraphEdge["kind"];
  amount: number | null;
  currency: string | null;
  /** Show the amount on the edge. Kept to a few edges so labels never pile up. */
  labelled: boolean;
  isNew: boolean;
};

export type AccountFlowNode = Node<AccountNodeData, "account">;
export type TransactionFlowNode = Node<TransactionNodeData, "transaction" | "alert">;
export type FlowNode = AccountFlowNode | TransactionFlowNode;
export type FlowEdge = Edge<FlowEdgeData, "flow">;

/**
 * `reveal` asks the canvas to bring the element into view. Panels set it;
 * clicks on the canvas do not, so the view never jumps under the pointer.
 */
export type Selection =
  | { kind: "node"; id: string; reveal?: boolean }
  | { kind: "edge"; id: string; reveal?: boolean }
  | { kind: "path"; id: string }
  /** A set of nodes, such as everything one tool call returned. */
  | { kind: "elements"; key: string; nodeIds: string[] }
  | null;

/** Node and edge IDs to emphasise; everything else is dimmed. */
export type Highlight = { focus: Set<string>; related: Set<string>; labelled: Set<string> } | null;

export function highlightFor(
  graph: InvestigationGraph,
  selection: Selection,
  pathsById: ReadonlyMap<string, EvidencePath>,
): Highlight {
  if (!selection) return null;
  if (selection.kind === "elements") {
    const focus = new Set(selection.nodeIds.filter((id) => graph.nodes.has(id)));
    for (const edge of graph.edges.values()) {
      if (focus.has(edge.source) && focus.has(edge.target)) focus.add(edge.id);
    }
    return { focus, related: new Set(), labelled: new Set() };
  }
  if (selection.kind === "path") {
    const path = pathsById.get(selection.id);
    if (!path) return null;
    const { nodeIds, edgeIds } = pathElementIds(path.path);
    return { focus: new Set([...nodeIds, ...edgeIds]), related: new Set(), labelled: new Set() };
  }
  if (selection.kind === "edge") {
    const edge = graph.edges.get(selection.id);
    if (!edge) return null;
    return {
      focus: new Set([edge.id]),
      related: new Set([edge.source, edge.target]),
      labelled: new Set([edge.id]),
    };
  }
  const node = graph.nodes.get(selection.id);
  if (!node) return null;
  const related = new Set<string>();
  const labelled = new Set<string>();
  for (const edge of graph.edges.values()) {
    if (edge.source === selection.id || edge.target === selection.id) {
      related.add(edge.id);
      related.add(edge.source === selection.id ? edge.target : edge.source);
      // A transaction has exactly two edges: what was paid and what was received.
      if (node.kind === "transaction") labelled.add(edge.id);
    }
  }
  return { focus: new Set([selection.id]), related, labelled };
}

export function toFlowNodes({
  graph,
  positions,
  verifiedIds,
}: {
  graph: InvestigationGraph;
  positions: ReadonlyMap<string, Point>;
  verifiedIds: ReadonlySet<string>;
}): FlowNode[] {
  const anchor = graph.anchorTransactionId
    ? graph.nodes.get(transactionNodeId(graph.anchorTransactionId))
    : undefined;
  const sender = anchor?.kind === "transaction" ? anchor.transaction.source_account_key : null;
  const receiver =
    anchor?.kind === "transaction" ? anchor.transaction.destination_account_key : null;
  const accountRole = (key: string): AccountNodeData["role"] => {
    if (key === sender && key === receiver) return "alert_both";
    if (key === sender) return "alert_sender";
    if (key === receiver) return "alert_receiver";
    return null;
  };

  const nodes: FlowNode[] = [];
  for (const node of graph.nodes.values()) {
    const position = positions.get(node.id) ?? { x: 0, y: 0 };
    const size = NODE_SIZE[node.kind];
    const isNew = node.firstSeq === graph.latestSeq;
    // Sizes are fixed by design, so they are declared rather than measured.
    const common = {
      id: node.id,
      position,
      width: size.width,
      height: size.height,
      measured: { width: size.width, height: size.height },
      className: isNew ? "is-new" : undefined,
      selectable: true,
      connectable: false,
    };
    if (node.kind === "account") {
      nodes.push({
        ...common,
        type: "account",
        data: { accountKey: node.accountKey, role: accountRole(node.accountKey), isNew },
      });
    } else {
      nodes.push({
        ...common,
        type: node.isAnchor ? "alert" : "transaction",
        data: {
          transaction: node.transaction,
          verified: verifiedIds.has(node.transaction.transaction_id),
          isNew,
        },
      });
    }
  }
  return nodes;
}

export function toFlowEdges(graph: InvestigationGraph): FlowEdge[] {
  const edges: FlowEdge[] = [];
  for (const edge of graph.edges.values()) {
    const isNew = edge.firstSeq === graph.latestSeq;
    edges.push({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: "flow",
      className: isNew ? "is-new" : undefined,
      data: {
        kind: edge.kind,
        amount: edge.amount,
        currency: edge.currency,
        labelled: false,
        isNew,
      },
    });
  }
  return edges;
}

/** Copies only the edges that carry a label; every other edge keeps its identity. */
export function withLabels(edges: FlowEdge[], highlight: Highlight): FlowEdge[] {
  const labelled = highlight?.labelled;
  if (!labelled || labelled.size === 0) return edges;
  return edges.map((edge) =>
    labelled.has(edge.id) && edge.data
      ? { ...edge, data: { ...edge.data, labelled: true }, zIndex: 2 }
      : edge,
  );
}

/** Escape for a double-quoted CSS string, where only quotes and backslashes matter. */
function quoteEscape(value: string): string {
  return value.replace(/["\\]/g, "\\$&");
}

const isEdgeId = (id: string) => id.startsWith("sent:") || id.startsWith("received:");

function selectors(scope: string, ids: Iterable<string>, kind: "node" | "edge"): string[] {
  const result: string[] = [];
  for (const id of ids) {
    if (isEdgeId(id) !== (kind === "edge")) continue;
    result.push(`${scope} .react-flow__${kind}[data-id="${quoteEscape(id)}"]`);
  }
  return result;
}

/** Emphasis for the current selection as CSS rules; empty when nothing is selected. */
export function highlightStyles(scope: string, highlight: Highlight): string {
  if (!highlight) return "";
  const focusNodes = selectors(scope, highlight.focus, "node");
  const relatedNodes = selectors(scope, highlight.related, "node");
  const focusEdges = selectors(scope, highlight.focus, "edge");
  const relatedEdges = selectors(scope, highlight.related, "edge");
  const within = (list: string[], child: string) => list.map((s) => `${s} ${child}`).join(",");

  const rules = [
    `${scope} .react-flow__node { opacity: 0.3; }`,
    `${scope} .react-flow__edge-path { opacity: 0.35; stroke: var(--border); marker-end: url(#arrow-dimmed); }`,
  ];
  if (relatedNodes.length > 0) {
    rules.push(`${relatedNodes.join(",")} { opacity: 1; }`);
    rules.push(
      `${within(relatedNodes, "> *")} { border-color: color-mix(in oklab, var(--accent-accent) 70%, transparent); }`,
    );
  }
  if (relatedEdges.length > 0) {
    rules.push(
      `${within(relatedEdges, ".react-flow__edge-path")} { opacity: 1; stroke: color-mix(in oklab, var(--accent-accent) 70%, var(--border-strong)); marker-end: url(#arrow-related); }`,
    );
  }
  if (focusNodes.length > 0) {
    rules.push(`${focusNodes.join(",")} { opacity: 1; z-index: 2 !important; }`);
    rules.push(
      `${within(focusNodes, "> *")} { box-shadow: 0 0 0 2px var(--surface-sunken), 0 0 0 4px var(--accent-accent); }`,
    );
  }
  if (focusEdges.length > 0) {
    rules.push(
      `${within(focusEdges, ".react-flow__edge-path")} { opacity: 1; stroke: var(--accent-accent); stroke-width: 2; marker-end: url(#arrow-focus); }`,
    );
  }
  return rules.join("\n");
}
