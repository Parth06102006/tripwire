"use client";

import { Expand, Maximize, RotateCcw, Search, X, ZoomIn, ZoomOut } from "lucide-react";
import { useId, useMemo, useRef, useState } from "react";
import {
  focusFor,
  neighborhood,
  transactionNodeId,
  type FocusSet,
  type GraphModel,
  type Selection,
} from "../../lib/graph-model";
import { Card } from "../ui/card";
import { Button, IconButton, TextInput } from "../ui/controls";
import { SegmentedTabs } from "../ui/motion";
import GraphCanvas, { type GraphHandle } from "./graph-canvas";

export type GraphMode = "explore" | "path" | "all";
type TypeFilter = "all" | "account" | "transaction";

interface GraphWorkspaceProps {
  model: GraphModel;
  anchorTransactionId: string;
  selection: Selection;
  onSelect: (selection: Selection) => void;
}

function nodeIdFor(model: GraphModel, selection: Selection, anchorTransactionId: string): string {
  if (selection?.kind === "node") return selection.id;
  if (selection?.kind === "edge") {
    const edge = model.elements.find((element) => element.data.id === selection.id);
    const txId = edge?.data.txId as string | undefined;
    if (txId) return transactionNodeId(txId);
  }
  return transactionNodeId(anchorTransactionId);
}

export default function GraphWorkspace({
  model,
  anchorTransactionId,
  selection,
  onSelect,
}: GraphWorkspaceProps) {
  const [mode, setMode] = useState<GraphMode>("explore");
  const [depth, setDepth] = useState(1);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [query, setQuery] = useState("");
  const [searchMessage, setSearchMessage] = useState("");
  const handle = useRef<GraphHandle | null>(null);
  const listId = useId();

  const pathCount = model.paths.length;
  const pathIndex = selection?.kind === "path" ? selection.index : 0;
  const rootId = nodeIdFor(model, selection, anchorTransactionId);
  const rootExists = model.neighbors.has(rootId) || model.elements.some((e) => e.data.id === rootId);

  const visible: FocusSet | null = useMemo(() => {
    if (mode === "all") return null;
    if (mode === "path") return pathCount > 0 ? focusFor(model, { kind: "path", index: pathIndex }) : null;
    return rootExists ? neighborhood(model, rootId, depth) : null;
  }, [mode, model, pathCount, pathIndex, rootExists, rootId, depth]);

  const focus: FocusSet = useMemo(() => {
    if (selection) return focusFor(model, selection);
    if (mode === "path" && pathCount > 0) return focusFor(model, { kind: "path", index: pathIndex });
    if (typeFilter !== "all") {
      return {
        nodes: new Set(
          model.elements
            .filter((element) => element.data.kind === typeFilter)
            .map((element) => element.data.id as string),
        ),
        edges: new Set(),
      };
    }
    return { nodes: new Set(), edges: new Set() };
  }, [selection, model, mode, pathCount, pathIndex, typeFilter]);

  const layoutKey = `${mode}|${depth}|${mode === "explore" ? rootId : ""}|${mode === "path" ? pathIndex : ""}`;

  const changeMode = (next: GraphMode) => {
    setMode(next);
    if (next === "path" && pathCount > 0 && selection?.kind !== "path") {
      onSelect({ kind: "path", index: 0 });
    }
    if (next === "explore") setDepth(1);
  };

  const entities = useMemo(
    () =>
      model.elements
        .filter((element) => element.data.kind)
        .map((element) => ({ id: element.data.id as string, label: element.data.ref as string })),
    [model],
  );

  const runSearch = () => {
    const needle = query.trim().toLowerCase();
    if (!needle) return;
    const exact = entities.filter((entity) => entity.label.toLowerCase() === needle);
    const partial = entities.filter((entity) => entity.label.toLowerCase().includes(needle));
    const match = exact[0] ?? (partial.length === 1 ? partial[0] : undefined);
    if (match) {
      setSearchMessage(`Selected ${match.label}.`);
      if (mode === "path") setMode("explore");
      onSelect({ kind: "node", id: match.id });
    } else if (partial.length > 1) {
      setSearchMessage(`${partial.length} returned entities match. Type more of the identifier.`);
    } else {
      setSearchMessage("No returned entity matches. Search covers only records in this investigation.");
    }
  };

  const hasSelection = selection !== null;

  return (
    <Card padded={false} className="flex flex-col overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
        <form
          role="search"
          aria-label="Search returned entities"
          className="flex min-w-[200px] flex-1 items-center gap-1"
          onSubmit={(event) => {
            event.preventDefault();
            runSearch();
          }}
        >
          <div className="relative flex-1">
            <Search aria-hidden="true" className="pointer-events-none absolute top-2 left-2.5 h-3.5 w-3.5 text-dim" />
            <TextInput
              aria-label="Search entities by identifier"
              list={listId}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Find account or transfer"
              className="pl-8 font-mono"
            />
            <datalist id={listId}>
              {entities.slice(0, 200).map((entity) => (
                <option key={entity.id} value={entity.label} />
              ))}
            </datalist>
          </div>
          <Button type="submit" variant="secondary">
            Find
          </Button>
        </form>

        <label className="flex items-center gap-1.5 text-xs text-dim">
          Emphasise
          <select
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value as TypeFilter)}
            className="rounded-control border border-line-strong bg-raised px-2 py-1.5 text-xs text-ink"
          >
            <option value="all">Nothing</option>
            <option value="account">Accounts</option>
            <option value="transaction">Transfers</option>
          </select>
        </label>

        <SegmentedTabs
          label="Graph display mode"
          value={mode}
          onChange={changeMode}
          options={[
            { value: "explore", label: "Explore", hint: "Selected entity and its neighbours" },
            {
              value: "path",
              label: "Path",
              disabled: pathCount === 0,
              hint: pathCount === 0 ? "No paths were returned by the graph queries" : "A path returned by the graph queries",
            },
            { value: "all", label: "All", hint: "Everything returned for this investigation" },
          ]}
        />
      </div>

      <div className="relative">
        <GraphCanvas
          model={model}
          visible={visible}
          focus={focus}
          layoutKey={layoutKey}
          selection={selection}
          onSelect={onSelect}
          label="Evidence graph canvas. Plus and minus zoom, zero fits, arrow keys pan, Escape clears selection. The evidence table below is the full text equivalent."
          handle={handle}
          className="h-[min(62vh,560px)] min-h-[360px] w-full bg-canvas"
        />
        <div className="absolute top-3 right-3 flex flex-col gap-1 rounded-control border border-line bg-card/90 p-1 backdrop-blur">
          <IconButton label="Zoom in" onClick={() => handle.current?.zoomIn()}>
            <ZoomIn aria-hidden="true" className="h-4 w-4" />
          </IconButton>
          <IconButton label="Zoom out" onClick={() => handle.current?.zoomOut()}>
            <ZoomOut aria-hidden="true" className="h-4 w-4" />
          </IconButton>
          <IconButton label="Fit graph to view" onClick={() => handle.current?.fit()}>
            <Maximize aria-hidden="true" className="h-4 w-4" />
          </IconButton>
          <IconButton
            label="Reset view and clear selection"
            onClick={() => {
              handle.current?.reset();
              onSelect(null);
              setDepth(1);
            }}
          >
            <RotateCcw aria-hidden="true" className="h-4 w-4" />
          </IconButton>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line p-3">
        <ul aria-label="Graph legend" className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-dim">
          <li className="flex items-center gap-1.5">
            <span aria-hidden="true" className="inline-block h-3 w-3 rounded-full border border-dim bg-raised" />
            Account
          </li>
          <li className="flex items-center gap-1.5">
            <span aria-hidden="true" className="inline-block h-2.5 w-2.5 rotate-45 border border-dim bg-card" />
            Transfer
          </li>
          <li className="flex items-center gap-1.5">
            <span aria-hidden="true" className="inline-block h-3 w-3 rounded-full border-2 border-ink bg-card" />
            Anchor transfer
          </li>
          <li className="flex items-center gap-1.5">
            <span aria-hidden="true" className="inline-block h-3 w-3 rounded-full bg-accent" />
            Selected or relevant path
          </li>
        </ul>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-dim" aria-live="polite">
            {searchMessage}
          </span>
          {mode === "explore" ? (
            <Button
              onClick={() => setDepth((value) => value + 1)}
              disabled={visible !== null && visible.nodes.size >= model.neighbors.size}
              title="Reveal the next ring of neighbours from the returned evidence. No new query is run."
            >
              <Expand aria-hidden="true" className="h-3.5 w-3.5" />
              Expand neighbours
            </Button>
          ) : null}
          {mode === "path" && pathCount > 0 ? (
            <label className="flex items-center gap-1.5 text-xs text-dim">
              Path
              <select
                value={pathIndex}
                onChange={(event) => onSelect({ kind: "path", index: Number(event.target.value) })}
                className="rounded-control border border-line-strong bg-raised px-2 py-1.5 text-xs text-ink"
              >
                {model.paths.map((path, index) => (
                  <option key={index} value={index}>
                    {index + 1}. {path.direction}, depth {path.depth}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <Button
            onClick={() => {
              onSelect(null);
              setTypeFilter("all");
              setQuery("");
              setSearchMessage("");
            }}
            disabled={!hasSelection && typeFilter === "all" && query === ""}
          >
            <X aria-hidden="true" className="h-3.5 w-3.5" />
            Clear
          </Button>
        </div>
      </div>
      <p className="border-t border-line px-3 py-2 text-[11px] text-dim">
        {mode === "explore"
          ? `Explore: ${depth === 1 ? "direct neighbours" : `${depth} hops`} of the selected entity (default: the anchor transfer), limited to returned evidence.`
          : mode === "path"
            ? "Path: one path returned by the executed graph queries. Order is as returned."
            : `All: ${model.elements.filter((e) => e.data.kind).length} entities returned for this investigation.`}
      </p>
    </Card>
  );
}
