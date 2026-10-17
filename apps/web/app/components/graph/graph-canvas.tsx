"use client";

import cytoscape from "cytoscape";
import type { Core, StylesheetJson } from "cytoscape";
import { useEffect, useImperativeHandle, useRef, type KeyboardEvent, type Ref } from "react";
import type { FocusSet, GraphModel, Selection } from "../../lib/graph-model";

export interface GraphHandle {
  zoomIn: () => void;
  zoomOut: () => void;
  fit: () => void;
  reset: () => void;
}

interface GraphCanvasProps {
  model: GraphModel;
  /** Elements to show. `null` shows everything in the model. */
  visible: FocusSet | null;
  /** Elements to emphasise. Everything else dims while a focus exists. */
  focus: FocusSet;
  /** Relayout when this changes (mode, depth, root). */
  layoutKey: string;
  selection: Selection;
  onSelect?: (selection: Selection) => void;
  compact?: boolean;
  label: string;
  handle?: Ref<GraphHandle>;
  className?: string;
}

function token(name: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

function buildStyle(compact: boolean): StylesheetJson {
  const ink = token("--ink", "#E6E7E5");
  const dim = token("--dim", "#858985");
  const card = token("--card", "#141515");
  const raised = token("--raised", "#1b1c1c");
  const accent = token("--accent", "#F28C38");
  const lineStrong = "#3a3c3b";
  return [
    {
      selector: "node",
      style: {
        "background-color": raised,
        "border-width": 1,
        "border-color": dim,
        label: compact ? "" : "data(label)",
        color: ink,
        "font-size": 9,
        "font-family": "Inter, ui-sans-serif, system-ui, sans-serif",
        "text-wrap": "ellipsis",
        "text-max-width": "110px",
        "text-valign": "bottom",
        "text-margin-y": 4,
        "text-outline-color": token("--canvas", "#080909"),
        "text-outline-width": 2,
        width: compact ? 14 : 26,
        height: compact ? 14 : 26,
        "transition-property": "opacity, background-color, border-color",
        "transition-duration": 180,
      },
    },
    {
      selector: 'node[kind = "transaction"]',
      style: { shape: "diamond", width: compact ? 10 : 18, height: compact ? 10 : 18, "background-color": card },
    },
    {
      selector: "node[anchor = 1]",
      style: { "border-color": ink, "border-width": 2 },
    },
    {
      selector: "edge",
      style: {
        width: 1,
        "line-color": lineStrong,
        "target-arrow-color": lineStrong,
        "target-arrow-shape": "triangle",
        "arrow-scale": 0.7,
        "curve-style": "bezier",
        label: compact ? "" : "data(label)",
        color: dim,
        "font-size": 8,
        "text-rotation": "autorotate",
        "text-background-color": token("--canvas", "#080909"),
        "text-background-opacity": 0.85,
        "text-background-padding": "2px",
        "transition-property": "opacity, line-color, width",
        "transition-duration": 180,
      },
    },
    { selector: ".dim", style: { opacity: 0.18 } },
    {
      selector: "node.focus",
      style: { "background-color": accent, "border-color": accent, "border-width": 2, color: ink },
    },
    {
      selector: "edge.focus",
      style: {
        width: 2.5,
        "line-color": accent,
        "target-arrow-color": accent,
        color: accent,
      },
    },
    { selector: ".hidden", style: { display: "none" } },
  ];
}

export default function GraphCanvas({
  model,
  visible,
  focus,
  layoutKey,
  selection,
  onSelect,
  compact = false,
  label,
  handle,
  className,
}: GraphCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const cyRef = useRef<Core | null>(null);
  const onSelectRef = useRef(onSelect);
  const reducedMotion = useRef(false);

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useImperativeHandle(handle, () => ({
    zoomIn: () => {
      const cy = cyRef.current;
      if (cy) cy.zoom({ level: cy.zoom() * 1.25, renderedPosition: { x: cy.width() / 2, y: cy.height() / 2 } });
    },
    zoomOut: () => {
      const cy = cyRef.current;
      if (cy) cy.zoom({ level: cy.zoom() / 1.25, renderedPosition: { x: cy.width() / 2, y: cy.height() / 2 } });
    },
    fit: () => cyRef.current?.fit(cyRef.current.elements(":visible"), 32),
    reset: () => {
      const cy = cyRef.current;
      if (!cy) return;
      cy.elements().unselect();
      cy.fit(cy.elements(":visible"), 32);
    },
  }));

  // Build the renderer once per model.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    reducedMotion.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const cy = cytoscape({
      container,
      elements: model.elements,
      style: buildStyle(compact),
      minZoom: 0.15,
      maxZoom: 3,
      wheelSensitivity: 0.25,
      userZoomingEnabled: !compact,
      userPanningEnabled: !compact,
      boxSelectionEnabled: false,
    });
    cyRef.current = cy;
    if (!compact) {
      cy.on("tap", "node", (event) => onSelectRef.current?.({ kind: "node", id: event.target.id() as string }));
      cy.on("tap", "edge", (event) => onSelectRef.current?.({ kind: "edge", id: event.target.id() as string }));
      cy.on("tap", (event) => {
        if (event.target === cy) onSelectRef.current?.(null);
      });
    }
    return () => {
      cy.destroy();
      cyRef.current = null;
    };
  }, [model, compact]);

  // Visibility and layout.
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    cy.batch(() => {
      cy.elements().forEach((element) => {
        const shown = visible === null || visible.nodes.has(element.id()) || visible.edges.has(element.id());
        element.toggleClass("hidden", !shown);
      });
    });
    const shownElements = cy.elements(":visible");
    if (shownElements.length === 0) return;
    shownElements
      .layout({
        name: "cose",
        animate: !reducedMotion.current && !compact,
        animationDuration: 300,
        fit: true,
        padding: compact ? 8 : 32,
        nodeDimensionsIncludeLabels: !compact,
        randomize: false,
      })
      .run();
  }, [model, layoutKey, visible, compact]);

  // Emphasis and selection.
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    const hasFocus = focus.nodes.size > 0 || focus.edges.size > 0;
    cy.batch(() => {
      cy.elements().forEach((element) => {
        const focused = focus.nodes.has(element.id()) || focus.edges.has(element.id());
        element.toggleClass("focus", hasFocus && focused);
        element.toggleClass("dim", hasFocus && !focused);
      });
    });
  }, [model, focus, visible]);

  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    cy.elements().unselect();
    if (selection && selection.kind !== "path") cy.getElementById(selection.id).select();
  }, [model, selection]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const cy = cyRef.current;
    if (!cy || compact) return;
    if (event.key === "+" || event.key === "=") cy.zoom({ level: cy.zoom() * 1.25, renderedPosition: { x: cy.width() / 2, y: cy.height() / 2 } });
    else if (event.key === "-") cy.zoom({ level: cy.zoom() / 1.25, renderedPosition: { x: cy.width() / 2, y: cy.height() / 2 } });
    else if (event.key === "0") cy.fit(cy.elements(":visible"), 32);
    else if (event.key === "Escape") onSelectRef.current?.(null);
    else if (event.key.startsWith("Arrow")) {
      event.preventDefault();
      const step = 40;
      cy.panBy({
        x: event.key === "ArrowLeft" ? step : event.key === "ArrowRight" ? -step : 0,
        y: event.key === "ArrowUp" ? step : event.key === "ArrowDown" ? -step : 0,
      });
    }
  };

  return (
    <div
      ref={containerRef}
      role="group"
      aria-label={label}
      tabIndex={compact ? -1 : 0}
      onKeyDown={onKeyDown}
      className={className}
    />
  );
}
