"use client";

import { useState } from "react";
import { GitFork, Repeat, Layers, Zap, ArrowRight } from "lucide-react";
import { cn } from "@/lib/cn";
import { DocsCodeBlock } from "./docs-code-block";

interface TypologyItem {
  id: string;
  name: string;
  shortTag: string;
  icon: typeof GitFork;
  riskTier: "High" | "Critical";
  summary: string;
  mechanism: string;
  redFlags: string[];
  cypher: string;
  benchCount: string;
}

const TYPOLOGIES: TypologyItem[] = [
  {
    id: "fan-out",
    name: "Layered Fan-Out (Dispersion)",
    shortTag: "1-to-N Splitting",
    icon: GitFork,
    riskTier: "Critical",
    summary:
      "A primary origin account transfers a large sum into multiple intermediate mule accounts within a compact time window to fracture audit visibility.",
    mechanism:
      "A single high-balance account sends funds to between 5 and 20 recipient accounts within 10 to 60 minutes. Recipient accounts typically disperse the money further or liquidate via physical branch withdrawals.",
    redFlags: [
      "Source account out-degree explodes from 1.2 to >15.0 within 24 hours.",
      "Outbound transfer amounts are near-uniform or structured in tranches.",
      "Recipient accounts have low historical activity prior to receiving funds.",
    ],
    cypher: `MATCH (origin:Account {id: $source_id})-[:SENT]->(tx:Transaction)-[:RECEIVED]->(mule:Account)
WHERE tx.timestamp >= $window_start AND tx.timestamp <= $window_end
WITH origin, count(DISTINCT mule) AS fan_out_degree, collect(tx.amount) AS tranche_amounts
WHERE fan_out_degree >= 5
RETURN origin.id, fan_out_degree, tranche_amounts`,
    benchCount: "284 detected in test cohort",
  },
  {
    id: "structuring",
    name: "Structuring & Smurfing (Threshold Avoidance)",
    shortTag: "Under-Threshold",
    icon: Layers,
    riskTier: "High",
    summary:
      "Repetitive transactions intentionally calibrated just beneath statutory regulatory reporting limits ($10,000 threshold).",
    mechanism:
      "Multiple individual deposits or transfers valued between $9,000 and $9,950 originate from disparate accounts and converge into a single consolidation node.",
    redFlags: [
      "Clustering of transfer values in the 90th percentile of reporting limits ($9,500-$9,900).",
      "Cumulative aggregated inflow exceeds reporting threshold by 5x or more.",
      "Minimal temporal spacing between deposits across accounts.",
    ],
    cypher: `MATCH (sender:Account)-[:SENT]->(tx:Transaction)-[:RECEIVED]->(aggregator:Account {id: $target_id})
WHERE tx.amount >= 9000 AND tx.amount < 10000
WITH aggregator, count(tx) AS structured_count, sum(tx.amount) AS total_inflow
WHERE structured_count >= 3
RETURN aggregator.id, structured_count, total_inflow`,
    benchCount: "412 detected in test cohort",
  },
  {
    id: "pass-through",
    name: "Rapid Pass-Through (Velocity Tunnel)",
    shortTag: "Zero-Dwell Time",
    icon: Zap,
    riskTier: "High",
    summary:
      "Intermediate conduit accounts that receive and immediately forward incoming capital with near-zero dwell time and balance retention.",
    mechanism:
      "Funds enter Account B from Account A and depart to Account C within minutes. The conduit account maintains near-zero ending balance and extracts a negligible fee (0.5-2%).",
    redFlags: [
      "Account dwell time is less than 15 minutes between receipt and transmission.",
      "Balance turnover ratio approaches 1.0 (inflow equals outflow).",
      "No legitimate commercial, payroll, or utility activity present on the account.",
    ],
    cypher: `MATCH (in_tx:Transaction)-[:RECEIVED]->(conduit:Account)-[:SENT]->(out_tx:Transaction)
WHERE out_tx.timestamp >= in_tx.timestamp 
  AND out_tx.timestamp <= in_tx.timestamp + 1800
  AND abs(out_tx.amount - in_tx.amount) / in_tx.amount < 0.05
RETURN conduit.id, in_tx.amount, out_tx.amount, (out_tx.timestamp - in_tx.timestamp) AS latency_seconds`,
    benchCount: "530 detected in test cohort",
  },
  {
    id: "circular",
    name: "Circular Round-Tripping (Synthetic Volume)",
    shortTag: "Cyclic Cycles",
    icon: Repeat,
    riskTier: "Critical",
    summary:
      "Funds routed through a daisy chain of shell accounts that ultimately return to the originator or an affiliated entity to simulate genuine revenue.",
    mechanism:
      "Capital loops from Account A -> B -> C -> D -> A through synthetic invoices or sham consulting fees, laundering provenance and inflating ledger turnover.",
    redFlags: [
      "Closed directed cycle in transaction graph (length 3 to 6 hops).",
      "Origination and terminal accounts share beneficial ownership or common device IP.",
      "Decaying capital volume along the chain corresponding to layer commission tolls.",
    ],
    cypher: `MATCH path = (start:Account {id: $account_id})-[:SENT|RECEIVED*4..8]->(start)
WHERE all(i in range(0, size(relationships(path))-2) 
      WHERE (relationships(path)[i]).timestamp <= (relationships(path)[i+1]).timestamp)
RETURN path, length(path) AS cycle_depth LIMIT 10`,
    benchCount: "179 detected in test cohort",
  },
];

export function DocsTypologyCard() {
  const [activeTab, setActiveTab] = useState<string>("fan-out");
  const active: TypologyItem = TYPOLOGIES.find((t) => t.id === activeTab) ?? TYPOLOGIES[0]!;
  const Icon = active.icon;

  return (
    <div className="my-8 rounded-xl border border-border-strong bg-surface p-5 shadow-sm sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-border-strong pb-4">
        <div>
          <h4 className="text-sm font-semibold tracking-wide text-fg uppercase">
            Interactive AML Typology Explorer
          </h4>
          <p className="text-xs text-fg-muted">
            Select a synthetic IBM AMLworld typology pattern to view graph traversal mechanics
          </p>
        </div>
        <span className="rounded-full bg-accent-soft px-3 py-1 font-mono text-2xs font-medium text-accent">
          {active.benchCount}
        </span>
      </div>

      {/* Typology Selection Tabs */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="tablist">
        {TYPOLOGIES.map((item) => {
          const TabIcon = item.icon;
          const isSelected = item.id === activeTab;
          return (
            <button
              key={item.id}
              role="tab"
              aria-selected={isSelected}
              onClick={() => setActiveTab(item.id)}
              className={cn(
                "flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition-all",
                isSelected
                  ? "border-accent bg-accent-soft/30 text-fg shadow-sm"
                  : "border-border-strong bg-surface-sunken text-fg-muted hover:border-fg-muted hover:text-fg",
              )}
            >
              <div className="flex w-full items-center justify-between">
                <TabIcon
                  className={cn("size-4", isSelected ? "text-accent" : "text-fg-muted")}
                  aria-hidden
                />
                <span
                  className={cn(
                    "text-3xs font-semibold uppercase",
                    item.riskTier === "Critical" ? "text-critical" : "text-warning",
                  )}
                >
                  {item.riskTier}
                </span>
              </div>
              <span className="line-clamp-1 text-xs font-semibold text-fg">
                {item.name.split(" ")[0]}
              </span>
              <span className="text-3xs text-fg-muted">{item.shortTag}</span>
            </button>
          );
        })}
      </div>

      {/* Selected Typology Detail Card */}
      <div className="mt-6 space-y-4 rounded-lg border border-border-strong bg-surface-sunken p-4 sm:p-5">
        <div className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-md bg-accent text-accent-ink">
            <Icon className="size-4" aria-hidden />
          </div>
          <div>
            <h5 className="text-sm font-semibold text-fg">{active.name}</h5>
            <p className="text-xs text-fg-muted">{active.summary}</p>
          </div>
        </div>

        <div className="grid gap-4 text-xs md:grid-cols-2">
          <div>
            <span className="font-semibold text-fg">Graph Mechanism</span>
            <p className="mt-1 leading-relaxed text-fg-secondary">{active.mechanism}</p>
          </div>
          <div>
            <span className="font-semibold text-fg">Primary Detection Red Flags</span>
            <ul className="mt-1 space-y-1 text-fg-secondary">
              {active.redFlags.map((flag, idx) => (
                <li key={idx} className="flex items-start gap-1.5">
                  <ArrowRight className="mt-0.5 size-3 shrink-0 text-accent" aria-hidden />
                  <span>{flag}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div>
          <span className="text-2xs font-semibold tracking-wider text-fg-muted uppercase">
            Executed FalkorDB Cypher Pattern
          </span>
          <DocsCodeBlock
            code={active.cypher}
            language="cypher"
            filename="typology_matcher.cypher"
          />
        </div>
      </div>
    </div>
  );
}
