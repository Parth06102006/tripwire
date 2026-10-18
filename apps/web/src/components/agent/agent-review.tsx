"use client";

import { ArrowLeft, Check, Copy, List, Play, Waypoints, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useCallback, useMemo, useState } from "react";

import { Composer } from "@/components/agent/composer";
import { Transcript } from "@/components/agent/transcript";
import { CasePanel } from "@/components/investigation/case-panel";
import { EvidencePanel } from "@/components/investigation/evidence-panel";
import { GraphCanvas } from "@/components/investigation/graph/graph-canvas";
import { SelectionDetail } from "@/components/investigation/selection-detail";
import { Mono } from "@/components/shared/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DEFAULT_REVIEW_BOUNDS, useAgentReview, type ReviewBounds } from "@/hooks/use-agent-review";
import { useHealth } from "@/hooks/use-health";
import { batchNodeIds, type ToolItem } from "@/lib/agent/session";
import type { ModelRoute } from "@/lib/api-schemas";
import { formatInteger, formatScore } from "@/lib/formatters";
import type { Selection } from "@/lib/graph/flow";
import { graphCounts, transactionNodeId, verifiedTransactionIds } from "@/lib/graph/model";

const ROUTE_BADGE: Record<ModelRoute, { label: string; tone: "critical" | "review" | "verified" }> =
  {
    blocked_by_rule: { label: "Blocked by rule", tone: "critical" },
    flagged_for_review: { label: "Flagged for review", tone: "review" },
    standard_path: { label: "Standard path", tone: "verified" },
  };

/**
 * The agent review screen: the conversation with the agent on the left and
 * the investigation graph it builds on the right. Both render one session
 * state, fed by the streaming investigation endpoint.
 */
export function AgentReview({ transactionId }: { transactionId: string }) {
  const review = useAgentReview(transactionId);
  const health = useHealth();
  const [bounds, setBounds] = useState<ReviewBounds>(DEFAULT_REVIEW_BOUNDS);
  const [selection, setSelection] = useState<Selection>(null);
  const [showEvidence, setShowEvidence] = useState(false);
  const [copied, setCopied] = useState(false);

  const copyTransactionId = async () => {
    try {
      await navigator.clipboard.writeText(transactionId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable
    }
  };

  const { state, streaming, pending, start, stop, showAll } = review;
  const { graph, positions, latest, items, runs } = state;
  const verifiedIds = useMemo(() => verifiedTransactionIds(latest?.report), [latest]);
  const pathsById = useMemo(
    () => new Map(graph.paths.map((entry) => [entry.id, entry])),
    [graph.paths],
  );
  const counts = graphCounts(graph);
  const lastRouting = [...items].reverse().find((item) => item.kind === "routing");
  const started = lastRouting?.kind === "routing" ? lastRouting.started : null;
  const lastRun = runs[runs.length - 1];
  const completed = runs.some((run) => run.status === "completed");

  const select = useCallback((next: Selection) => setSelection(next), []);
  const showTool = useCallback(
    (item: ToolItem) =>
      setSelection((current) =>
        current?.kind === "elements" && current.key === item.key
          ? null
          : { kind: "elements", key: item.key, nodeIds: batchNodeIds(state, item.batchSeq) },
      ),
    [state],
  );
  const showEvidenceId = useCallback(
    (id: string) => setSelection({ kind: "node", id: transactionNodeId(id), reveal: true }),
    [],
  );
  const runGate = useCallback(() => start(bounds, { act: true }), [start, bounds]);

  const inspecting = selection && selection.kind !== "elements" ? selection : null;

  return (
    <div className="flex min-h-dvh flex-col lg:h-dvh lg:flex-row">
      <section
        className="order-2 flex min-h-[70vh] flex-col border-border lg:order-1 lg:min-h-0 lg:w-[460px] lg:shrink-0 lg:border-r xl:w-[500px]"
        aria-label="Agent review"
      >
        <header className="border-b border-border px-4 pt-4 pb-3">
          <Link
            href="/overview"
            className="inline-flex items-center gap-1 rounded-sm text-xs text-fg-muted hover:text-fg"
          >
            <ArrowLeft className="size-3.5" aria-hidden /> Alert queue
          </Link>
          <div className="mt-1.5 flex items-center justify-between gap-2">
            <h1 className="flex items-center gap-2 text-base font-semibold">
              <span className="sr-only">Agent review of </span>
              <Mono>{transactionId}</Mono>
              <button
                type="button"
                onClick={copyTransactionId}
                aria-label="Copy transaction ID"
                className="rounded p-1 text-fg-muted hover:bg-surface-elevated hover:text-fg"
              >
                {copied ? (
                  <Check className="size-3.5 text-safe" aria-hidden />
                ) : (
                  <Copy className="size-3.5" aria-hidden />
                )}
              </button>
            </h1>
            {started ? (
              <span className="font-mono text-sm font-bold text-fg">
                Score {formatScore(started.risk_score)}
              </span>
            ) : null}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-fg-secondary">
            {started ? (
              <>
                <Badge tone={ROUTE_BADGE[started.route].tone}>
                  {ROUTE_BADGE[started.route].label}
                </Badge>
                <span className="text-fg-muted">policy {started.policy_version}</span>
              </>
            ) : (
              <span className="text-fg-muted">Not reviewed yet</span>
            )}
          </div>
        </header>

        <div className="min-h-0 flex-1 scrollbar-thin overflow-y-auto px-4 py-4">
          {items.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border-strong p-4 text-xs text-fg-secondary">
              <p className="text-sm font-medium text-fg">Start the agent review</p>
              <p className="mt-1">
                The agent queries FalkorDB around this transaction. Each tool call appears here with
                the Cypher it ran, and what it finds is drawn on the graph as it arrives. The review
                ends with a verified risk level and the simulated decision from the escalation
                chain.
              </p>
            </div>
          ) : (
            <Transcript
              items={items}
              activeKey={selection?.kind === "elements" ? selection.key : null}
              onShowTool={showTool}
              onEvidence={showEvidenceId}
              footer={
                completed ? (
                  <div className="rounded-lg border border-border bg-surface">
                    <CasePanel
                      transactionId={transactionId}
                      latestAction={latest?.action ?? null}
                      canRunGate={!streaming}
                      gateRunning={streaming && lastRun?.request.act === true}
                      onRunGate={runGate}
                    />
                  </div>
                ) : null
              }
            />
          )}
        </div>

        <Composer
          bounds={bounds}
          onChange={setBounds}
          onStart={() => start(bounds)}
          onStop={stop}
          onShowAll={showAll}
          streaming={streaming}
          pending={pending}
          hasRun={runs.length > 0}
          llmConfigured={health.data?.llm === "configured"}
        />
      </section>

      <section
        className="relative order-1 h-[55vh] min-h-[360px] lg:order-2 lg:h-auto lg:flex-1"
        aria-label="Investigation graph"
      >
        {graph.nodes.size > 0 ? (
          <GraphCanvas
            graph={graph}
            positions={positions}
            verifiedIds={verifiedIds}
            pathsById={pathsById}
            selection={selection}
            onSelect={select}
            following={streaming}
          />
        ) : (
          <div data-graph-canvas="" className="flex h-full items-center justify-center p-6">
            <div className="max-w-md text-center">
              {streaming ? (
                <div className="flex flex-col items-center">
                  <div className="relative flex size-12 items-center justify-center">
                    <span className="absolute size-12 animate-ping rounded-full bg-accent/25" />
                    <span className="size-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
                  </div>
                  <p className="mt-4 text-sm font-semibold text-fg">Querying FalkorDB Graph...</p>
                  <p className="mt-1 text-xs text-fg-secondary">
                    Traversing transaction paths and counterparties within the bounded window.
                  </p>
                </div>
              ) : (
                <div className="rounded-xl border border-border bg-surface/85 p-6 shadow-2xl backdrop-blur">
                  <div className="mx-auto flex size-11 items-center justify-center rounded-lg border border-accent/40 bg-accent-soft text-accent">
                    <Waypoints className="size-5" aria-hidden />
                  </div>
                  <h2 className="mt-3.5 text-sm font-semibold text-fg">
                    Graph Investigation Ready
                  </h2>
                  <p className="mt-1.5 text-xs leading-relaxed text-fg-secondary">
                    The agent will execute bounded Cypher queries in FalkorDB (up to{" "}
                    {bounds.max_hops} hops) to uncover transaction networks, pass-through clearing
                    hubs, and circular flows.
                  </p>
                  <div className="mt-4">
                    <Button
                      size="sm"
                      onClick={() => start(bounds)}
                      className="inline-flex items-center gap-1.5"
                    >
                      <Play className="size-3.5" aria-hidden />
                      Start Investigation
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="pointer-events-none absolute top-3 left-3 flex flex-wrap items-center gap-2">
          {graph.nodes.size > 0 ? (
            <span className="rounded-md border border-border bg-canvas/90 px-2.5 py-1 text-[11px] text-fg-secondary">
              {formatInteger(counts.transactions)} transactions, {formatInteger(counts.accounts)}{" "}
              accounts, {formatInteger(counts.paths)} paths
              {selection ? (
                <span className="text-fg-muted">; dimmed is outside the selection</span>
              ) : null}
            </span>
          ) : null}
        </div>

        {graph.nodes.size > 0 ? (
          <Button
            size="sm"
            className="absolute top-3 right-3 z-10"
            aria-pressed={showEvidence}
            onClick={() => setShowEvidence((value) => !value)}
          >
            <List /> Evidence list
          </Button>
        ) : null}

        <AnimatePresence>
          {inspecting || showEvidence ? (
            <motion.aside
              key={inspecting ? "inspect" : "evidence"}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 12 }}
              transition={{ duration: 0.2 }}
              className="absolute top-14 right-3 bottom-14 z-10 w-[min(360px,calc(100%-1.5rem))] scrollbar-thin overflow-y-auto rounded-lg border border-border-strong bg-surface/95 shadow-2xl shadow-black/50 backdrop-blur"
              aria-label={inspecting ? "Selected element" : "Evidence list"}
            >
              <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-surface px-3 py-2">
                <span className="text-xs font-semibold">
                  {inspecting ? "Inspect" : "Evidence list"}
                </span>
                <button
                  type="button"
                  aria-label="Close"
                  onClick={() => (inspecting ? setSelection(null) : setShowEvidence(false))}
                  className="rounded-sm p-1 text-fg-muted hover:bg-surface-elevated hover:text-fg"
                >
                  <X className="size-3.5" />
                </button>
              </div>
              {inspecting ? (
                <SelectionDetail
                  graph={graph}
                  selection={inspecting}
                  pathsById={pathsById}
                  verifiedIds={verifiedIds}
                  onSelect={select}
                />
              ) : (
                <EvidencePanel
                  graph={graph}
                  verifiedIds={verifiedIds}
                  selection={selection}
                  onSelect={select}
                />
              )}
            </motion.aside>
          ) : null}
        </AnimatePresence>
      </section>
    </div>
  );
}
