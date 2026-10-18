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
      "Ingests the synthetic IBM AMLworld HI-Small v8 dataset comprising 761,639 scored replay transactions and 354,660 accounts. Offline evaluation labels are strictly excluded at this boundary.",
    techDetails: [
      "Target-free Parquet scores loaded at cold boot in ~9ms.",
      "Schema enforcement strictly validates absence of 'is_laundering' or 'typology' labels.",
      "Zero ground-truth leakage into inference services.",
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
      "Computes rolling behavioral features for every transaction at timestamp t using strictly prior event history. Future data is cryptographically invisible to prevent data leakage.",
    techDetails: [
      "Rolling 1h, 24h, 7d, and 30d velocity and count aggregations.",
      "Inbound vs outbound volume asymmetry, fan-out ratios, and balance delta percentiles.",
      "Vectorized Parquet computation pipeline with DuckDB and PyArrow.",
    ],
    latency: "0.08ms per row (16-thread SIMD)",
    invariant: "Temporal causality: features for time t never observe events after t.",
  },
  {
    id: 3,
    label: "Detection Engine",
    sublabel: "LightGBM + Rules",
    icon: Cpu,
    title: "Stage 3: Champion Dual-Stage Detection",
    description:
      "LightGBM Champion (C1) scores transactions along a continuous calibrated risk distribution. A deterministic block threshold (score >= 0.999) simulates instant rule-based containment.",
    techDetails: [
      "Champion model achieves 0.752 Average Precision on held-out test cohort.",
      "+374% detection improvement over classical baseline (0.150 AP).",
      "Triaged into 3 deterministic routes: blocked_by_rule, flagged_for_review, standard_path.",
    ],
    latency: "76,988 transactions/sec (1 CPU thread)",
    invariant: "Deterministic policy ownership: models output scores, deterministic rules decide.",
  },
  {
    id: 4,
    label: "Graph Traversal",
    sublabel: "FalkorDB Subgraphs",
    icon: Network,
    title: "Stage 4: FalkorDB Graph Evidence Extraction",
    description:
      "When a transaction triggers review, the API queries FalkorDB to extract the multi-hop topological context around the anchor transaction. Accounts and transfers are traversed via linear Cypher algebra.",
    techDetails: [
      "First-class transaction pattern: (:Account)-[:SENT]->(:Transaction)-[:RECEIVED]->(:Account).",
      "Directed queries extract 2-hop counterparties, fan-out rings, and pass-through conduits.",
      "Bounded connection pooling (16 handles) prevents thread contention.",
    ],
    latency: "6.2ms P95 traversal latency",
    invariant: "Graph authority: UI topology must derive exclusively from executed Cypher queries.",
  },
  {
    id: 5,
    label: "LLM Agent",
    sublabel: "MCP Tool Boundary",
    icon: Bot,
    title: "Stage 5: Autonomous LLM Agent & Evidence Verifier",
    description:
      "An autonomous Gemini agent investigates the alert by executing structured graph tools over the Model Context Protocol (MCP). The verifier validates cited nodes, amounts, and paths against Cypher records.",
    techDetails: [
      "Tool-calling protocol isolates agent reasoning from database execution.",
      "Cryptographic evidence verification prevents LLM hallucinations.",
      "Graceful deterministic fallback if provider or network is unavailable.",
    ],
    latency: "1.2s - 2.8s total dossier generation",
    invariant: "Evidence-backed claims: reports may cite only records returned by verified tools.",
  },
  {
    id: 6,
    label: "Case Workbench",
    sublabel: "Analyst Audit",
    icon: ShieldAlert,
    title: "Stage 6: Analyst Workbench & Case Memory",
    description:
      "Human compliance officers review the evidence, inspect Cytoscape graph visualizations, review automated risk factors, and make final case determinations with full audit provenance.",
    techDetails: [
      "Persistent SQLite case store with append-only audit trail triggers.",
      "Case state machine: Open -> Reviewed (Confirmed / Dismissed).",
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
