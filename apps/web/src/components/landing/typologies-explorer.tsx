"use client";

import { useState } from "react";
import { CheckCircle2, Copy, Terminal } from "lucide-react";
import { cn } from "@/lib/cn";
import { SectionHeading } from "./section-heading";

interface TypologyBound {
  label: string;
  value: string;
}

interface Typology {
  id: string;
  name: string;
  subtitle: string;
  description: string;
  cypher: string;
  verdict: "SIMULATED BLOCK" | "REVIEW REQUIRED";
  threatLevel: "High" | "Critical" | "Elevated";
  bounds: readonly TypologyBound[];
}

const TYPOLOGIES: readonly [Typology, ...Typology[]] = [
  {
    id: "layering",
    name: "Fan-Out / Fan-In Layering",
    subtitle: "Rapid dispersal across intermediary hops and offshore consolidation",
    description:
      "Funds leave an origin account, split across transit mules within a narrow time window, and reconsolidate into a destination account. Bounded multi-hop Cypher detects the fan-out and fan-in convergence.",
    cypher: `MATCH path = (origin:Account {id: $originId})-[:SENT]->(t1:Transaction)
      -[:RECEIVED]->(mule:Account)-[:SENT]->(t2:Transaction)
      -[:RECEIVED]->(dest:Account)
WHERE t1.timestamp <= t2.timestamp
  AND duration.inHours(t1.timestamp, t2.timestamp).hours <= 6
  AND t2.amount >= t1.amount * 0.95
RETURN path, sum(t1.amount) AS volumeTransferred
LIMIT 50;`,
    verdict: "SIMULATED BLOCK",
    threatLevel: "Critical",
    bounds: [
      { label: "Traversal scope", value: "2 transfers" },
      { label: "Time horizon", value: "6 hours" },
      { label: "Retention floor", value: "≥ 95% of amount" },
      { label: "Row cap", value: "LIMIT 50" },
    ],
  },
  {
    id: "structuring",
    name: "Structuring & Smurfing",
    subtitle: "High-volume sub-threshold deposits designed to evade currency limits",
    description:
      "A primary subject splits a large cash sum into consecutive transfers just below the reporting threshold ($9,000 – $9,999). A bounded aggregation groups the window by sender and counts the burst.",
    cypher: `MATCH (source:Account)-[:SENT]->(tx:Transaction)
WHERE tx.timestamp >= $windowStart AND tx.timestamp <= $windowEnd
  AND tx.amount > 9000.0 AND tx.amount < 10000.0
WITH source, count(tx) AS numTransfers, sum(tx.amount) AS totalVolume
WHERE numTransfers >= 5
RETURN source.id, numTransfers, totalVolume
ORDER BY totalVolume DESC;`,
    verdict: "REVIEW REQUIRED",
    threatLevel: "High",
    bounds: [
      { label: "Traversal scope", value: "Fan-out from one sender" },
      { label: "Time horizon", value: "24 hours" },
      { label: "Trigger", value: "≥ 5 transfers, $9,000–$9,999" },
      { label: "Row cap", value: "Grouped by sender" },
    ],
  },
  {
    id: "cycles",
    name: "Circular Wash Cycles",
    subtitle: "Closed-loop routing masking beneficial ownership across shell entities",
    description:
      "Funds traverse a sequence of affiliated accounts and return to the originator or related beneficiary, creating fictitious commercial activity and disguising the source of wealth. Bounded cycle detection isolates the loop.",
    cypher: `MATCH path = (a:Account)-[:SENT*3..6]->(a:Account)
WHERE all(t in nodes(path)[1..-1] WHERE t:Transaction)
  AND duration.between(head(relationships(path)).timestamp, 
                       last(relationships(path)).timestamp).days <= 30
RETURN path, length(path) AS cycleLength
LIMIT 20;`,
    verdict: "REVIEW REQUIRED",
    threatLevel: "Critical",
    bounds: [
      { label: "Traversal scope", value: "Closed loop, 3 to 6 transfers" },
      { label: "Time horizon", value: "30 days" },
      { label: "Cycle filter", value: "Transactions only" },
      { label: "Row cap", value: "LIMIT 20" },
    ],
  },
  {
    id: "bipartite",
    name: "Bipartite Mule Network",
    subtitle: "Dense bipartite clustering routing stolen card and payment proceeds",
    description:
      "A dense cluster of sender accounts transfers funds to a shared intermediate mule pool, which distributes funds onward to cash-out accounts. Bipartite projection queries isolate the shared pool behind the activity.",
    cypher: `MATCH (senders:Account)-[:SENT]->(tx1:Transaction)-[:RECEIVED]->(mule:Account)
MATCH (mule)-[:SENT]->(tx2:Transaction)-[:RECEIVED]->(cashout:Account)
WITH mule, count(DISTINCT senders) AS inDegree, count(DISTINCT cashout) AS outDegree
WHERE inDegree >= 8 AND outDegree >= 3
RETURN mule.id, inDegree, outDegree;`,
    verdict: "SIMULATED BLOCK",
    threatLevel: "High",
    bounds: [
      { label: "Traversal scope", value: "2-hop bipartite" },
      { label: "Fan-in floor", value: "≥ 8 senders" },
      { label: "Fan-out floor", value: "≥ 3 cash-outs" },
      { label: "Row cap", value: "Grouped by mule" },
    ],
  },
];

export default function TypologiesExplorer() {
  const [activeId, setActiveId] = useState<string>("layering");
  const [copied, setCopied] = useState<boolean>(false);

  const current = TYPOLOGIES.find((t) => t.id === activeId) ?? TYPOLOGIES[0];

  const handleCopy = () => {
    navigator.clipboard.writeText(current.cypher);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section
      id="typologies"
      data-anchor
      className="border-t border-line px-5 py-20 sm:px-8 sm:py-24"
    >
      <div className="mx-auto w-full max-w-[1260px]">
        <div data-reveal>
          <SectionHeading
            eyebrow="Typology Engine"
            title="How money hides in graphs."
            description="Laundering hides in graph shape: a fan-out, a closed loop, a mule pool, a burst just under a reporting threshold. Each card holds a bounded Cypher pattern, the bounds around it, and the verdict the policy returns."
          />
        </div>

        {/* Typology selection tabs */}
        <div className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" data-reveal>
          {TYPOLOGIES.map((typology) => {
            const isSelected = typology.id === activeId;
            return (
              <button
                key={typology.id}
                type="button"
                onClick={() => setActiveId(typology.id)}
                className={cn(
                  "flex flex-col rounded-card border p-4 text-left transition-all duration-200",
                  isSelected
                    ? "border-accent bg-[#1a1512] shadow-[0_12px_32px_-12px_rgba(242,140,56,0.3)] ring-1 ring-accent/30"
                    : "border-line bg-card/60 text-dim hover:border-line-strong hover:bg-card hover:text-ink",
                )}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={cn(
                      "rounded-full border px-2 py-0.5 font-mono text-[10px] tracking-wider uppercase",
                      isSelected
                        ? "border-accent/40 bg-accent/10 font-semibold text-accent"
                        : "border-line text-dim",
                    )}
                  >
                    {typology.threatLevel} Threat
                  </span>
                  {isSelected ? (
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
                  ) : null}
                </div>
                <h3
                  className={cn(
                    "mt-3 text-[15px] font-semibold tracking-tight",
                    isSelected ? "text-white" : "text-ink",
                  )}
                >
                  {typology.name}
                </h3>
                <p className="mt-1.5 line-clamp-2 text-[12px] leading-5 text-dim">
                  {typology.subtitle}
                </p>
              </button>
            );
          })}
        </div>

        {/* Detailed interactive typology inspector card */}
        <div
          data-reveal
          className="mt-6 overflow-hidden rounded-card border border-line bg-[#0d0e0f] shadow-2xl"
        >
          <div className="grid lg:grid-cols-12">
            {/* Left explanation column */}
            <div className="flex flex-col justify-between border-b border-line p-6 sm:p-8 lg:col-span-5 lg:border-r lg:border-b-0">
              <div>
                <div className="flex items-center gap-2.5">
                  <span className="font-mono text-[11px] tracking-[0.18em] text-accent uppercase">
                    Typology Analysis
                  </span>
                  <span className="h-1 w-1 rounded-full bg-dim" />
                  <span
                    className={cn(
                      "rounded px-2 py-0.5 font-mono text-[10px] font-semibold",
                      current.verdict === "SIMULATED BLOCK"
                        ? "border border-critical/30 bg-critical/15 text-critical"
                        : "border border-warning/30 bg-warning/15 text-warning",
                    )}
                  >
                    {current.verdict}
                  </span>
                </div>

                <h4 className="mt-3 text-[22px] font-bold tracking-tight text-white">
                  {current.name}
                </h4>

                <p className="mt-3.5 text-[14px] leading-6 text-[#9fa3a0]">{current.description}</p>

                {/* Query bounds grid */}
                <div className="mt-6 grid grid-cols-2 gap-3 border-t border-line/60 pt-5">
                  {current.bounds.map((bound, index) => (
                    <div
                      key={bound.label}
                      className="rounded-[8px] border border-line bg-[#141516] p-3"
                    >
                      <span className="block text-[11px] text-dim">{bound.label}</span>
                      <span
                        className={cn(
                          "mt-1 block font-mono text-[13px] font-semibold",
                          index === 2 ? "text-accent" : index === 3 ? "text-safe" : "text-white",
                        )}
                      >
                        {bound.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-6 flex items-center justify-between border-t border-line/60 pt-4 text-[12px] text-dim">
                <span>Deterministic Policy: Human Confirmation Required</span>
              </div>
            </div>

            {/* Right Cypher code execution console */}
            <div className="flex flex-col justify-between bg-[#070809] p-6 sm:p-8 lg:col-span-7">
              <div>
                <div className="flex items-center justify-between border-b border-line pb-3">
                  <div className="flex items-center gap-2">
                    <Terminal aria-hidden="true" className="h-4 w-4 text-accent" />
                    <span className="font-mono text-[12px] font-medium text-white">
                      FalkorDB Cypher Engine
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="flex items-center gap-1.5 rounded-control border border-line px-2.5 py-1 text-[11px] text-dim transition-colors hover:bg-white/[0.04] hover:text-ink"
                  >
                    {copied ? (
                      <>
                        <CheckCircle2 aria-hidden="true" className="h-3.5 w-3.5 text-safe" />
                        <span className="text-safe">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy aria-hidden="true" className="h-3.5 w-3.5" />
                        <span>Copy Cypher</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="mt-4 overflow-x-auto">
                  <pre className="font-mono text-[12.5px] leading-6 text-[#d0d3cf] selection:bg-accent/30">
                    <code>
                      {current.cypher.split("\n").map((line, i) => {
                        return (
                          <div key={i} className="flex">
                            <span className="w-8 shrink-0 text-[11px] text-dim/50 select-none">
                              {i + 1}
                            </span>
                            <span className="min-w-0">
                              {line.includes("MATCH") ||
                              line.includes("WHERE") ||
                              line.includes("RETURN") ||
                              line.includes("WITH") ||
                              line.includes("ORDER BY") ||
                              line.includes("LIMIT") ? (
                                <span className="font-medium text-accent">{line}</span>
                              ) : (
                                line
                              )}
                            </span>
                          </div>
                        );
                      })}
                    </code>
                  </pre>
                </div>
              </div>

              <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-line/60 pt-4 text-[11px] text-dim">
                <span>
                  First-class transactions:
                  (:Account)-[:SENT]-&gt;(:Transaction)-[:RECEIVED]-&gt;(:Account)
                </span>
                <span className="font-mono text-safe">Read-only sample</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
