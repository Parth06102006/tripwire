"use client";

import { EdgeLabelRenderer, getBezierPath, type EdgeProps } from "@xyflow/react";
import { memo } from "react";

import type { FlowEdge as FlowEdgeType } from "@/lib/graph/flow";
import { formatAmount } from "@/lib/formatters";

/**
 * Directed SENT or RECEIVED edge. Stroke, width and arrowhead come from CSS
 * (see globals.css and `highlightStyles`), so selection does not re-render
 * edges. Amount labels appear only on the selected edge or a selected
 * transaction's two edges: the transaction node already shows the paid
 * amount, and labels on many edges would bury the structure.
 */
export const FlowEdge = memo(function FlowEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
}: EdgeProps<FlowEdgeType>) {
  const [path, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  return (
    <>
      {/* pathLength=1 lets CSS draw a newly discovered edge from source to
          target with one dash, whatever its real length. */}
      <path id={id} d={path} pathLength={1} fill="none" className="react-flow__edge-path" />
      <path
        d={path}
        fill="none"
        strokeOpacity={0}
        strokeWidth={16}
        className="react-flow__edge-interaction"
      />
      {data?.labelled ? (
        <EdgeLabelRenderer>
          <div
            className="nodrag nopan pointer-events-none absolute rounded-sm border border-accent/40 bg-surface-sunken/95 px-1.5 py-px text-[10px] text-fg"
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
          >
            <span className="text-fg-muted">{data.kind === "sent" ? "Paid " : "Received "}</span>
            <span>{formatAmount(data.amount, data.currency)}</span>
          </div>
        </EdgeLabelRenderer>
      ) : null}
    </>
  );
});

const MARKER_COLORS = {
  normal: "var(--border-strong)",
  related: "color-mix(in oklab, var(--accent-accent) 70%, var(--border-strong))",
  focus: "var(--accent-accent)",
  dimmed: "var(--border)",
} as const;

/** Shared arrowhead markers referenced from CSS by emphasis level. */
export function EdgeMarkers() {
  return (
    <svg className="absolute size-0" aria-hidden>
      <defs>
        {Object.entries(MARKER_COLORS).map(([key, color]) => (
          <marker
            key={key}
            id={`arrow-${key}`}
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
          >
            <path d="M0,0 L10,5 L0,10 z" fill={color} />
          </marker>
        ))}
      </defs>
    </svg>
  );
}

export const edgeTypes = { flow: FlowEdge };
