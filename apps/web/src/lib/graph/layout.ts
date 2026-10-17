/**
 * Deterministic left-to-right layout. The same graph always produces the same
 * positions, because dagre receives nodes and edges in merge order.
 *
 * When a later batch adds elements, existing nodes keep their positions (or
 * wherever the analyst dragged them), and each new node is placed relative
 * to a neighbour that is already on screen, so the graph does not jump.
 */
import { Graph, layout } from "@dagrejs/dagre";

import type { InvestigationGraph } from "@/lib/graph/model";

export type Point = { x: number; y: number };

export const NODE_SIZE = {
  account: { width: 176, height: 44 },
  transaction: { width: 148, height: 46 },
} as const;

function dagrePositions(graph: InvestigationGraph): Map<string, Point> {
  const g = new Graph();
  g.setGraph({ rankdir: "LR", nodesep: 18, ranksep: 64, marginx: 24, marginy: 24 });
  g.setDefaultEdgeLabel(() => ({}));
  for (const node of graph.nodes.values()) g.setNode(node.id, { ...NODE_SIZE[node.kind] });
  for (const edge of graph.edges.values()) g.setEdge(edge.source, edge.target);
  layout(g);

  const positions = new Map<string, Point>();
  for (const node of graph.nodes.values()) {
    const placed = g.node(node.id) as { x: number; y: number } | undefined;
    if (!placed) continue;
    const size = NODE_SIZE[node.kind];
    // dagre reports centres; React Flow positions are top-left corners.
    positions.set(node.id, { x: placed.x - size.width / 2, y: placed.y - size.height / 2 });
  }
  return positions;
}

function neighbours(graph: InvestigationGraph): Map<string, string[]> {
  const result = new Map<string, string[]>();
  const link = (a: string, b: string) => {
    const list = result.get(a);
    if (list) list.push(b);
    else result.set(a, [b]);
  };
  for (const edge of graph.edges.values()) {
    link(edge.source, edge.target);
    link(edge.target, edge.source);
  }
  return result;
}

export function layoutGraph(
  graph: InvestigationGraph,
  previous: ReadonlyMap<string, Point> = new Map(),
): Map<string, Point> {
  const fresh = dagrePositions(graph);
  if (previous.size === 0) return fresh;

  const adjacency = neighbours(graph);
  const result = new Map<string, Point>();
  const fallbackShift = firstShift(fresh, previous);

  for (const [id, point] of fresh) {
    const kept = previous.get(id);
    if (kept) {
      result.set(id, kept);
      continue;
    }
    // Move the new node by the same amount its placed neighbour moved
    // between the fresh layout and what is on screen.
    let shift = fallbackShift;
    for (const neighbour of adjacency.get(id) ?? []) {
      const onScreen = previous.get(neighbour);
      const inFresh = fresh.get(neighbour);
      if (onScreen && inFresh) {
        shift = { x: onScreen.x - inFresh.x, y: onScreen.y - inFresh.y };
        break;
      }
    }
    result.set(id, { x: point.x + shift.x, y: point.y + shift.y });
  }
  return result;
}

function firstShift(
  fresh: ReadonlyMap<string, Point>,
  previous: ReadonlyMap<string, Point>,
): Point {
  for (const [id, onScreen] of previous) {
    const inFresh = fresh.get(id);
    if (inFresh) return { x: onScreen.x - inFresh.x, y: onScreen.y - inFresh.y };
  }
  return { x: 0, y: 0 };
}
