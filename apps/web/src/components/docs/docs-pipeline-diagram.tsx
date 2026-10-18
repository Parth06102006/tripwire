"use client";

import { useState } from "react";
import {
  Database,
  Clock,
  Cpu,
  Network,
  Bot,
  ShieldAlert,
  ChevronRight,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/cn";

interface Stage {
  id: number;
  label: string;
  sublabel: string;
  icon: typeof Database;
  title: string;
  description: string;
  techDetails: string[];
  latency: string;
  invariant: string;
}

const STAGES: Stage[] = [
  {
    id: 1,
    label: "Replay Stream",
    sublabel: "Target-Free",
    icon: Database,
    title: "Stage 1: Target-Free Replay Ingestion",
    description:
      "The bank's ledger enters as a replay of the synthetic IBM AMLworld HI-Small v8 dataset: 761,639 scored transactions, with no evaluation label on the wire.",
    techDetails: [
      "Target-free transaction and score artifacts load at cold boot in roughly 9ms.",
      "Schema enforcement rejects any artifact carrying label, split, or typology columns.",
      "Ground truth stays in offline evaluation splits, never in the inference path.",
    ],
    latency: "< 10ms warm cache",
    invariant: "Target isolation: labels remain exclusively in offline evaluation splits.",
  },
  {
    id: 2,
    label: "Feature Store",
    sublabel: "Temporal Invariant",
    icon: Clock,
    title: "Stage 2: Point-in-Time Temporal Feature Store",
    description:
      "The model's inputs are computed for every transaction at timestamp t from strictly prior event history, so a scored row can never contain the future it is meant to predict.",
    techDetails: [
      "76 features in seven families, from rolling 1h, 24h, 7d, and 30d velocities to inbound/outbound volume asymmetry.",
      "Vectorized Parquet computation pipeline with DuckDB and PyArrow.",
      "Feature generation never reads a label column.",
    ],
    latency: "0.08ms per row (16-thread SIMD)",
    invariant: "Temporal causality: features for time t never observe events after t.",
  },
  {
    id: 3,
    label: "Detection Model",
    sublabel: "Layer One",
    icon: Cpu,
    title: "Stage 3: Layer One - Champion Detection Model",
    description:
      "The LightGBM champion scores every transaction along a calibrated risk distribution; deterministic policy routes each score into block, review, or standard path.",
    techDetails: [
      "0.752 average precision on the held-out test cohort, 0.600 on the hard September 9-10 bulk slice.",
      "76,988 transactions per second on a single CPU thread.",
      "Three deterministic routes: blocked_by_rule, flagged_for_review, standard_path.",
    ],
    latency: "76,988 transactions/sec (1 CPU thread)",
    invariant: "Deterministic policy ownership: models output scores, deterministic rules decide.",
  },
  {
    id: 4,
    label: "Agent Pass",
    sublabel: "Layer Two",
    icon: Bot,
    title: "Stage 4: Layer Two - Agent Pass & Evidence Verifier",
    description:
      "On requests that opt in, a Gemini tool-calling agent reviews the flagged alert in context through approved graph tools, and a deterministic verifier checks every record the draft cites.",
    techDetails: [
      "Typed, read-only tools: trace_funds, inspect_counterparties, detect_flow_patterns.",
      "Tool calls, model rounds, and wall time are bounded; the agent never writes Cypher or touches the database directly.",
      "Provider failures, timeouts, and unverifiable claims fall back to the deterministic report.",
    ],
    latency: "1.2s - 2.8s total dossier generation",
    invariant: "Evidence-backed claims: reports may cite only records returned by verified tools.",
  },
  {
    id: 5,
    label: "Graph Evidence",
    sublabel: "FalkorDB Subgraphs",
    icon: Network,
    title: "Stage 5: FalkorDB Graph Evidence Extraction",
    description:
      "The query layer behind both paths executes bounded, parameterized Cypher and returns the multi-hop evidence around the anchor transaction: counterparties, funds paths, and flow patterns.",
    techDetails: [
      "First-class transaction pattern: (:Account)-[:SENT]->(:Transaction)-[:RECEIVED]->(:Account).",
      "Traversal capped at 1-3 hops, 30-day windows, 100 rows per query, with a server-side query timeout.",
      "Every executed statement, parameter set, row count, and duration lands in the tool trace.",
    ],
    latency: "6.2ms P95 traversal latency",
    invariant: "Graph authority: UI topology must derive exclusively from executed Cypher queries.",
  },
  {
    id: 6,
    label: "Case Workbench",
    sublabel: "Analyst Audit",
    icon: ShieldAlert,
    title: "Stage 6: Analyst Workbench & Case Memory",
    description:
      "Human compliance officers review the verified evidence, inspect the growing graph, and make the final case determination with full audit provenance.",
    techDetails: [
      "Persistent case store with an append-only audit trail; agent proposals pass a deterministic gate before they become case actions.",
      "Case state machine: suspected to confirmed or dismissed, by explicit analyst action only.",
      "Exportable SAR dossier for regulatory financial reporting.",
    ],
    latency: "< 4ms API response",
    invariant:
      "Human confirmation: only explicit analyst action promotes suspected nodes to confirmed case memory.",
  },
];

export function DocsPipelineDiagram() {
  const [selectedStage, setSelectedStage] = useState<number>(3);
  const active: Stage = STAGES.find((s) => s.id === selectedStage) ?? STAGES[0]!;
  const Icon = active.icon;

  return (
    <div className="my-8 rounded-xl border border-border-strong bg-surface p-5 shadow-sm sm:p-6">
      <div className="mb-4">
        <h4 className="text-sm font-semibold tracking-wide text-fg uppercase">
          End-to-End System Pipeline
        </h4>
        <p className="text-xs text-fg-muted">
          Click any architecture stage to examine its implementation, latency profile, and
          invariants
        </p>
      </div>

      {/* Pipeline Stepper Horizontal Flow */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center">
        {STAGES.map((stage, idx) => {
          const StageIcon = stage.icon;
          const isSelected = stage.id === selectedStage;
          return (
            <div key={stage.id} className="flex flex-1 items-center gap-1.5">
              <button
                type="button"
                onClick={() => setSelectedStage(stage.id)}
                className={cn(
                  "flex w-full flex-col items-start gap-1 rounded-lg border p-2.5 text-left transition-all",
                  isSelected
                    ? "border-accent bg-accent-soft/30 text-fg shadow-sm ring-1 ring-accent"
                    : "border-border-strong bg-surface-sunken text-fg-muted hover:border-fg-muted hover:text-fg",
                )}
              >
                <div className="flex w-full items-center justify-between">
                  <span className="text-3xs font-mono font-semibold text-fg-muted">
                    0{stage.id}
                  </span>
                  <StageIcon
                    className={cn("size-3.5", isSelected ? "text-accent" : "text-fg-muted")}
                    aria-hidden
                  />
                </div>
                <span className="line-clamp-1 text-xs font-semibold text-fg">{stage.label}</span>
                <span className="text-3xs line-clamp-1 text-fg-muted">{stage.sublabel}</span>
              </button>
              {idx < STAGES.length - 1 && (
                <ChevronRight
                  className="hidden size-4 shrink-0 text-fg-muted/40 md:block"
                  aria-hidden
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Active Stage Detailed Breakdown */}
      <div className="mt-5 rounded-lg border border-border-strong bg-surface-sunken p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-strong pb-3">
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-lg bg-accent text-accent-ink">
              <Icon className="size-4" aria-hidden />
            </div>
            <div>
              <h5 className="text-sm font-semibold text-fg">{active.title}</h5>
              <p className="text-xs text-fg-muted">{active.description}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded bg-surface px-2.5 py-1 font-mono text-2xs text-fg-secondary">
              P95 / Throughput: <strong className="text-accent">{active.latency}</strong>
            </span>
          </div>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <span className="text-xs font-semibold text-fg">Engineering Architecture</span>
            <ul className="mt-2 space-y-1.5 text-xs text-fg-secondary">
              {active.techDetails.map((detail, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-safe" aria-hidden />
                  <span>{detail}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-md border border-border-strong bg-surface p-3.5 text-xs">
            <span className="font-semibold tracking-wider text-fg-muted uppercase">
              Operational Invariant
            </span>
            <p className="mt-1.5 leading-relaxed text-fg">{active.invariant}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
