"use client";

import "@xyflow/react/dist/base.css";

import {
  Background,
  BackgroundVariant,
  Controls,
  ControlButton,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type EdgeChange,
  type NodeChange,
} from "@xyflow/react";
import { LayoutGrid } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { EdgeMarkers, edgeTypes } from "@/components/investigation/graph/flow-edge";
import { nodeTypes } from "@/components/investigation/graph/graph-nodes";
import {
  highlightFor,
  highlightStyles,
  toFlowEdges,
  toFlowNodes,
  withLabels,
  type FlowEdge,
  type FlowNode,
  type Selection,
} from "@/lib/graph/flow";
import type { Point } from "@/lib/graph/layout";
import { pathElementIds, type EvidencePath, type InvestigationGraph } from "@/lib/graph/model";

type GraphCanvasProps = {
  graph: InvestigationGraph;
  positions: ReadonlyMap<string, Point>;
  verifiedIds: ReadonlySet<string>;
  pathsById: ReadonlyMap<string, EvidencePath>;
  selection: Selection;
  onSelect: (selection: Selection) => void;
  /** Keep the camera on the newest discoveries (while the agent is working). */
  following?: boolean;
};

export function GraphCanvas(props: GraphCanvasProps) {
  return (
    <ReactFlowProvider>
      <Canvas {...props} />
    </ReactFlowProvider>
  );
}

function Canvas({
  graph,
  positions,
  verifiedIds,
  pathsById,
  selection,
  onSelect,
  following = false,
}: GraphCanvasProps) {
  const flow = useReactFlow<FlowNode, FlowEdge>();
  // Positions the analyst dragged to. They win over the computed layout
  // until the layout is reset.
  const [dragged, setDragged] = useState<ReadonlyMap<string, Point>>(new Map());

  // Element objects are rebuilt only when the graph changes. Dragging copies
  // just the moved node, and selection copies just the labelled edges, so
  // React Flow re-renders only what actually changed.
  const baseNodes = useMemo(
    () => toFlowNodes({ graph, positions, verifiedIds }),
    [graph, positions, verifiedIds],
  );
  const nodes = useMemo(() => {
    if (dragged.size === 0) return baseNodes;
    return baseNodes.map((node) => {
      const point = dragged.get(node.id);
      return point ? { ...node, position: point } : node;
    });
  }, [baseNodes, dragged]);
  const baseEdges = useMemo(() => toFlowEdges(graph), [graph]);
  const highlight = useMemo(
    () => highlightFor(graph, selection, pathsById),
    [graph, selection, pathsById],
  );
  const edges = useMemo(() => withLabels(baseEdges, highlight), [baseEdges, highlight]);
  const emphasisCss = useMemo(() => highlightStyles("[data-graph-canvas]", highlight), [highlight]);

  const onNodeClick = useCallback(
    (_: unknown, node: FlowNode) => onSelect({ kind: "node", id: node.id }),
    [onSelect],
  );
  const onEdgeClick = useCallback(
    (_: unknown, edge: FlowEdge) => onSelect({ kind: "edge", id: edge.id }),
    [onSelect],
  );
  const onPaneClick = useCallback(() => onSelect(null), [onSelect]);

  const onNodesChange = useCallback(
    (changes: NodeChange<FlowNode>[]) => {
      const moves: [string, Point][] = [];
      for (const change of changes) {
        if (change.type === "position" && change.position) moves.push([change.id, change.position]);
        // Keyboard selection (Enter on a focused node) arrives as a change.
        if (change.type === "select" && change.selected) onSelect({ kind: "node", id: change.id });
      }
      if (moves.length > 0) {
        setDragged((previous) => {
          const next = new Map(previous);
          for (const [id, point] of moves) next.set(id, point);
          return next;
        });
      }
    },
    [onSelect],
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange<FlowEdge>[]) => {
      for (const change of changes) {
        if (change.type === "select" && change.selected) onSelect({ kind: "edge", id: change.id });
      }
    },
    [onSelect],
  );

  // While the agent works, the camera follows what it just found (plus the
  // alert, for orientation). When it stops, the camera shows everything.
  useEffect(() => {
    if (graph.latestSeq === 0) return;
    const fresh: { id: string }[] = [];
    if (following) {
      for (const node of graph.nodes.values()) {
        if (node.firstSeq === graph.latestSeq || (node.kind === "transaction" && node.isAnchor)) {
          fresh.push({ id: node.id });
        }
      }
    }
    const frame = requestAnimationFrame(() => {
      void flow.fitView(
        fresh.length > 1
          ? { nodes: fresh, padding: 0.3, duration: 650, maxZoom: 1.1, minZoom: 0.35 }
          : { padding: 0.15, duration: 650, maxZoom: 1.1 },
      );
    });
    return () => cancelAnimationFrame(frame);
  }, [flow, graph, following]);

  // Bring a path, a tool call's records, or an element picked from a panel into view.
  useEffect(() => {
    let ids: string[] = [];
    if (selection?.kind === "elements") {
      ids = selection.nodeIds.filter((id) => graph.nodes.has(id));
    } else if (selection?.kind === "path") {
      const path = pathsById.get(selection.id);
      if (path) ids = [...pathElementIds(path.path).nodeIds];
    } else if (selection?.kind === "node" && selection.reveal) {
      ids = [selection.id];
    } else if (selection?.kind === "edge" && selection.reveal) {
      const edge = graph.edges.get(selection.id);
      if (edge) ids = [edge.source, edge.target];
    }
    if (ids.length === 0) return;
    const frame = requestAnimationFrame(() => {
      void flow.fitView({
        nodes: ids.map((id) => ({ id })),
        padding: ids.length === 1 ? 1.2 : 0.35,
        duration: 300,
        maxZoom: 1.2,
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [flow, selection, pathsById, graph]);

  return (
    <div className="relative h-full w-full" data-testid="graph-canvas" data-graph-canvas="">
      <style>{emphasisCss}</style>
      <EdgeMarkers />
      <ReactFlow<FlowNode, FlowEdge>
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onEdgeClick={onEdgeClick}
        onPaneClick={onPaneClick}
        nodesConnectable={false}
        edgesFocusable
        minZoom={0.1}
        maxZoom={2}
        colorMode="dark"
        attributionPosition="bottom-left"
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={24}
          size={1}
          color="rgb(255 255 255 / 0.06)"
        />
        <Controls showInteractive={false} position="bottom-left" orientation="horizontal">
          <ControlButton
            onClick={() => setDragged(new Map())}
            title="Reset layout"
            aria-label="Reset layout"
            disabled={dragged.size === 0}
          >
            <LayoutGrid />
          </ControlButton>
        </Controls>
      </ReactFlow>
      <GraphLegend />
    </div>
  );
}

function GraphLegend() {
  return (
    <ul
      className="pointer-events-none absolute right-3 bottom-3 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-border bg-canvas/90 px-2.5 py-1.5 text-[10px] text-fg-secondary"
      aria-label="Graph legend"
    >
      <li className="flex items-center gap-1.5">
        <span className="h-2.5 w-3.5 rounded-[3px] border border-line-strong bg-card" />
        Account
      </li>
      <li className="flex items-center gap-1.5">
        <span className="h-2.5 w-3.5 rounded-full border border-line-strong bg-raised" />
        Transaction
      </li>
      <li className="flex items-center gap-1.5">
        <span className="graph-node-alert h-2.5 w-3.5 rounded-full border border-critical bg-[#2a1614]" />
        Alert
      </li>
      <li className="flex items-center gap-1.5">
        <span className="h-2.5 w-3.5 rounded-full border border-safe/60 bg-[#14201a]" />
        Cited by the agent
      </li>
      <li className="flex items-center gap-1.5">
        <span className="h-0.5 w-3.5 bg-accent" />
        Just found or selected
      </li>
    </ul>
  );
}
