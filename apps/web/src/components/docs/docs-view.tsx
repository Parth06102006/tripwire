"use client";

import { useEffect, useState } from "react";
import { Shield, Terminal, Zap } from "lucide-react";
import { DocsHeader } from "./docs-header";
import { DocsArticleHeader } from "./docs-article-header";
import { DocsToc, DOC_SECTIONS } from "./docs-toc";
import { DocsPipelineDiagram } from "./docs-pipeline-diagram";
import { DocsTypologyCard } from "./docs-typology-card";
import { DocsCodeBlock, DocsCallout } from "./docs-code-block";
import { DocsGlossary } from "./docs-glossary";
import { DocsFooter } from "./docs-footer";
import { cn } from "@/lib/cn";

export function DocsView() {
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("traceaml-docs-theme");
        if (saved === "light" || saved === "dark") return saved;
      } catch {
        // Storage access blocked or SSR
      }
    }
    return "dark";
  });
  const [progress, setProgress] = useState(0);
  const [activeSection, setActiveSection] = useState<string>("introduction");
  const [claps, setClaps] = useState(142);

  const toggleTheme = () => {
    setTheme((current) => {
      const next = current === "dark" ? "light" : "dark";
      try {
        localStorage.setItem("traceaml-docs-theme", next);
      } catch {
        // Storage access blocked
      }
      return next;
    });
  };

  // Scroll Progress calculation
  useEffect(() => {
    const handleScroll = () => {
      const totalHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (totalHeight > 0) {
        const currentProgress = (window.scrollY / totalHeight) * 100;
        setProgress(currentProgress);
      }
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // IntersectionObserver to highlight currently visible section
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
            break;
          }
        }
      },
      { rootMargin: "-80px 0px -60% 0px" },
    );

    DOC_SECTIONS.forEach((sec) => {
      const el = document.getElementById(sec.id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  return (
    <div
      data-theme={theme}
      className={cn(
        "min-h-screen transition-colors duration-200",
        theme === "light"
          ? "theme-light bg-[#fcfcfb] text-[#191919]"
          : "theme-dark bg-[#080909] text-[#e6e7e5]",
      )}
    >
      <DocsHeader progress={progress} theme={theme} onToggleTheme={toggleTheme} />

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 md:py-12">
        <div className="flex gap-12">
          {/* Main Article Column */}
          <article className="max-w-[760px] min-w-0 flex-1">
            <DocsArticleHeader
              theme={theme}
              onToggleTheme={toggleTheme}
              claps={claps}
              onClap={() => setClaps((c) => c + 1)}
            />

            {/* Editorial Body Content */}
            <div className="mt-8 space-y-12 text-sm leading-[1.8] sm:text-base sm:leading-[1.85]">
              {/* SECTION 1 */}
              <section id="introduction" className="scroll-mt-24 space-y-5">
                <h2 className="text-xl font-bold tracking-tight text-fg sm:text-2xl">
                  1. The Money Laundering Challenge
                </h2>
                <p className="text-fg-secondary">
                  If you are a software engineer or data scientist entering the compliance and
                  financial crime space for the first time, your initial instinct might be
                  straightforward:
                  <span className="italic">
                    {" "}
                    “Why can’t we just write an SQL query that flags transactions greater than
                    $10,000?”
                  </span>
                </p>
                <p className="text-fg-secondary">
                  In practical banking systems, that simple query represents exactly what
                  sophisticated bad actors anticipate. Real-world money laundering rarely takes the
                  form of a single million-dollar wire from an illicit entity directly into a luxury
                  asset account. Instead, illicit syndicates fracture capital across dozens of
                  intermediary conduit accounts, stagger timestamps across banking holidays, and
                  calibrate individual amounts to sit just beneath regulatory thresholds.
                </p>

                <DocsCallout type="info" title="The Three Classical Stages of Money Laundering">
                  <div className="space-y-2">
                    <p>
                      <strong>Placement:</strong> Injecting illegitimate cash into legitimate
                      financial institutions (e.g., small cash deposits across multiple automated
                      teller machines).
                    </p>
                    <p>
                      <strong>Layering:</strong> Concealing the audit trail through an intricate web
                      of transfers, cross-border wires, and shell companies.
                    </p>
                    <p>
                      <strong>Integration:</strong> Withdrawing the cleaned funds through legitimate
                      commerce, commercial invoices, or real estate purchases.
                    </p>
                  </div>
                </DocsCallout>

                <p className="text-fg-secondary">
                  TraceAML was engineered from the ground up to counter this exact challenge. Rather
                  than treating transactions as isolated, tabular records in a relational database,
                  TraceAML models the entire financial ecosystem as a high-velocity, directed
                  money-flow graph.
                </p>
              </section>

              {/* SECTION 2 */}
              <section id="graph-foundation" className="scroll-mt-24 space-y-5">
                <h2 className="text-xl font-bold tracking-tight text-fg sm:text-2xl">
                  2. The Graph Representation Model
                </h2>
                <p className="text-fg-secondary">
                  In graph theory, modeling transactions as edges between accounts (e.g.,{" "}
                  <code className="rounded bg-surface px-1.5 py-0.5 text-xs text-accent">
                    (:Account)-[:TRANSFERRED]-&gt;(:Account)
                  </code>
                  ) is a common pitfall. When multiple transfers occur between the same two accounts
                  over time, edges become cluttered with arrays of timestamps and amounts, making
                  multi-hop Cypher queries computationally intractable.
                </p>
                <p className="text-fg-secondary">
                  TraceAML enforces a fundamental architectural invariant:
                  <strong> First-Class Transactions</strong>.
                </p>

                <div className="my-6 rounded-lg border border-border-strong bg-surface p-4 text-center sm:p-6">
                  <div className="inline-flex flex-wrap items-center justify-center gap-2 font-mono text-xs text-fg">
                    <span className="rounded-md border border-accent bg-accent-soft px-3 py-1.5 font-bold text-accent">
                      (:Account)
                    </span>
                    <span className="text-fg-muted">--[:SENT]--&gt;</span>
                    <span className="rounded-md border border-warning bg-warning/10 px-3 py-1.5 font-bold text-warning">
                      (:Transaction)
                    </span>
                    <span className="text-fg-muted">--[:RECEIVED]--&gt;</span>
                    <span className="rounded-md border border-accent bg-accent-soft px-3 py-1.5 font-bold text-accent">
                      (:Account)
                    </span>
                  </div>
                  <p className="mt-3 text-xs text-fg-muted">
                    TraceAML Canonical Graph Schema: Transactions are nodes holding immutable
                    attributes (timestamp, amount, currency, channel).
                  </p>
                </div>

                <p className="text-fg-secondary">
                  This modeling choice delivers three major operational advantages:
                </p>
                <ul className="list-disc space-y-2 pl-5 text-fg-secondary">
                  <li>
                    <strong>Stable Transaction IDs:</strong> Every transfer possesses a permanent
                    node ID, allowing deterministic joins between machine learning inference
                    artifacts and graph topology.
                  </li>
                  <li>
                    <strong>Bi-directional Traversal:</strong> An investigator can effortlessly
                    trace upstream sources of funds (
                    <code className="rounded bg-surface px-1 text-xs">SENT</code>) or downstream
                    dispersion (<code className="rounded bg-surface px-1 text-xs">RECEIVED</code>)
                    in a single Cypher hop.
                  </li>
                  <li>
                    <strong>Zero Multi-Edge Overhead:</strong> FalkorDB stores each transaction as
                    an independent entity in sparse matrix memory, keeping neighbor degree
                    operations O(1).
                  </li>
                </ul>

                <DocsCallout type="invariant" title="The Evaluation Isolation Invariant">
                  TraceAML operates in a strictly target-free environment during live workbench
                  inference. Target labels (<code className="font-mono text-xs">is_laundering</code>
                  ) and ground-truth typologies remain quarantined in offline evaluation test sets.
                  The inference graph and API contracts never receive or return ground-truth labels.
                </DocsCallout>
              </section>

              {/* SECTION 3 */}
              <section id="end-to-end-architecture" className="scroll-mt-24 space-y-5">
                <h2 className="text-xl font-bold tracking-tight text-fg sm:text-2xl">
                  3. End-to-End System Pipeline
                </h2>
                <p className="text-fg-secondary">
                  How does raw transactional data transform into an actionable compliance
                  investigation? TraceAML orchestrates six decoupled stages to bridge
                  high-throughput streaming with deep multi-hop evidence extraction:
                </p>

                {/* Interactive Pipeline Diagram */}
                <DocsPipelineDiagram />

                <p className="text-fg-secondary">
                  The pipeline is engineered for sub-second analyst responsiveness. While machine
                  learning scoring evaluates over 76,000 transactions per second, graph evidence
                  traversal completes in under 7ms, giving investigators instantaneous visual
                  intelligence.
                </p>
              </section>

              {/* SECTION 4 */}
              <section id="key-typologies" className="scroll-mt-24 space-y-5">
                <h2 className="text-xl font-bold tracking-tight text-fg sm:text-2xl">
                  4. The 4 AML Typology Patterns
                </h2>
                <p className="text-fg-secondary">
                  In the synthetic IBM AMLworld dataset, laundering syndicates employ four primary
                  structural behaviors. Understanding these topologies is essential for recognizing
                  why simple tabular rules fail while graph queries succeed.
                </p>

                {/* Interactive Typology Explorer */}
                <DocsTypologyCard />

                <p className="text-fg-secondary">
                  Notice how each typology is characterized by a distinctive topological footprint:
                  fan-outs create star graphs, structuring creates inbound bottlenecks,
                  pass-throughs form linear conduit chains, and round-tripping forms directed
                  cycles.
                </p>
              </section>

              {/* SECTION 5 */}
              <section id="detection-scoring" className="scroll-mt-24 space-y-5">
                <h2 className="text-xl font-bold tracking-tight text-fg sm:text-2xl">
                  5. LightGBM & Decision Invariants
                </h2>
                <p className="text-fg-secondary">
                  TraceAML pairs graph traversals with a high-performance gradient boosting
                  detection engine. During the model selection tournament (recorded in Iteration 2
                  benchmarks), three candidate architectures were evaluated against the baseline:
                </p>

                <div className="my-6 overflow-x-auto">
                  <table className="w-full overflow-hidden rounded-lg border border-border-strong text-left text-xs">
                    <thead className="text-3xs border-b border-border-strong bg-surface font-semibold text-fg-muted uppercase">
                      <tr>
                        <th className="p-3">Model Candidate</th>
                        <th className="p-3">Feature Set</th>
                        <th className="p-3">Test AP</th>
                        <th className="p-3">Hard Bulk AP</th>
                        <th className="p-3">Recall @ Budget</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-strong bg-surface-sunken font-mono">
                      <tr>
                        <td className="p-3 font-sans font-medium text-fg">Baseline (Iter 1)</td>
                        <td className="p-3 font-sans text-fg-muted">Simple tabular counts</td>
                        <td className="p-3 text-fg-muted">0.158</td>
                        <td className="p-3 text-fg-muted">0.150</td>
                        <td className="p-3 text-fg-muted">21.4%</td>
                      </tr>
                      <tr>
                        <td className="p-3 font-sans font-medium text-fg">Candidate C3</td>
                        <td className="p-3 font-sans text-fg-muted">Tabular + velocity windows</td>
                        <td className="p-3 text-fg-muted">0.241</td>
                        <td className="p-3 text-fg-muted">0.150</td>
                        <td className="p-3 text-fg-muted">21.4%</td>
                      </tr>
                      <tr>
                        <td className="p-3 font-sans font-medium text-fg">Candidate C2</td>
                        <td className="p-3 font-sans text-fg-muted">Graph degree + ratios</td>
                        <td className="p-3 text-fg-muted">0.733</td>
                        <td className="p-3 text-fg-muted">0.574</td>
                        <td className="p-3 text-fg-muted">47.5%</td>
                      </tr>
                      <tr className="bg-accent-soft/20 text-fg">
                        <td className="p-3 font-sans font-bold text-accent">Champion C1</td>
                        <td className="p-3 font-sans font-medium">
                          Full Vectorized Graph Features
                        </td>
                        <td className="p-3 font-bold text-accent">0.752</td>
                        <td className="p-3 font-bold text-accent">0.600</td>
                        <td className="p-3 font-bold text-accent">47.7%</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <DocsCallout type="tip" title="Why Hard Bulk AP Matters">
                  <p>
                    Standard test splits often include easy, high-value transfers. TraceAML
                    evaluates models on the stringent{" "}
                    <strong>Hard Bulk September 9–10 split</strong>, isolating structured,
                    multi-account syndicate activity. Champion C1 maintains an outstanding 0.600
                    Average Precision on this difficult slice.
                  </p>
                </DocsCallout>

                <h3 className="pt-2 text-base font-semibold text-fg">
                  The Three Deterministic Routes
                </h3>
                <p className="text-fg-secondary">
                  Scores produced by the Champion model are mapped into three operational lanes:
                </p>
                <div className="grid gap-3 text-xs sm:grid-cols-3">
                  <div className="rounded-lg border border-critical/30 bg-critical/5 p-3.5">
                    <span className="font-semibold text-critical">1. Blocked by Rule</span>
                    <p className="mt-1 text-fg-muted">
                      Score &gt;= 0.999. Immediate simulated containment. Automated hold on funds.
                      Cannot be reversed by LLM agents.
                    </p>
                  </div>
                  <div className="rounded-lg border border-warning/30 bg-warning/5 p-3.5">
                    <span className="font-semibold text-warning">2. Flagged for Review</span>
                    <p className="mt-1 text-fg-muted">
                      Score &gt;= Review Threshold (0.475 - 0.700). Primary operational queue (1,585
                      alerts). Dispatched to compliance investigators.
                    </p>
                  </div>
                  <div className="rounded-lg border border-border-strong bg-surface p-3.5">
                    <span className="font-semibold text-fg">3. Standard Path</span>
                    <p className="mt-1 text-fg-muted">
                      Score &lt; Threshold. Standard straight-through processing. Preserved in
                      replay audit log for historical baseline reference.
                    </p>
                  </div>
                </div>
              </section>

              {/* SECTION 6 */}
              <section id="graph-traversal" className="scroll-mt-24 space-y-5">
                <h2 className="text-xl font-bold tracking-tight text-fg sm:text-2xl">
                  6. FalkorDB & Cypher Traversals
                </h2>
                <p className="text-fg-secondary">
                  When an analyst investigates an alert, how does TraceAML retrieve multi-hop
                  relationships without locking up the server? It leverages{" "}
                  <strong>FalkorDB</strong>, a high-throughput graph database engine built upon
                  Redis.
                </p>
                <p className="text-fg-secondary">
                  FalkorDB stores graph topologies as sparse adjacency matrices and translates
                  Cypher queries into highly optimized matrix multiplication operations via
                  GraphBLAS. This allows multi-hop pattern matching to run directly across CPU cache
                  lines.
                </p>

                <DocsCodeBlock
                  language="cypher"
                  filename="trace_funds.cypher"
                  code={`MATCH path = (origin:Account)-[:SENT]->(tx:Transaction)-[:RECEIVED]->(destination:Account)
WHERE tx.id = $transaction_id
OPTIONAL MATCH (destination)-[:SENT]->(downstream_tx:Transaction)-[:RECEIVED]->(second_hop:Account)
WHERE downstream_tx.timestamp >= tx.timestamp 
  AND downstream_tx.timestamp <= tx.timestamp + $time_window
RETURN path, downstream_tx, second_hop LIMIT $result_limit;`}
                />

                <p className="text-fg-secondary">
                  In production sweeps against 998,021 transactions and 354,660 accounts, FalkorDB
                  delivers:
                </p>
                <ul className="list-disc space-y-1.5 pl-5 text-fg-secondary">
                  <li>
                    <strong>Trace Funds P95:</strong> 6.20 milliseconds
                  </li>
                  <li>
                    <strong>Counterparty Inspection P95:</strong> 2.33 milliseconds
                  </li>
                  <li>
                    <strong>Pass-Through Detection P95:</strong> 1.98 milliseconds
                  </li>
                </ul>
              </section>

              {/* SECTION 7 */}
              <section id="llm-agent" className="scroll-mt-24 space-y-5">
                <h2 className="text-xl font-bold tracking-tight text-fg sm:text-2xl">
                  7. Autonomous LLM Agent & MCP
                </h2>
                <p className="text-fg-secondary">
                  When enabled, TraceAML utilizes an autonomous LLM agent powered by Google Gemini
                  to analyze graph evidence and draft structured investigation narratives. Unlike
                  standard chatbots that hallucinate facts, TraceAML binds the agent to strict
                  operational rails:
                </p>

                <div className="space-y-3">
                  <div className="flex items-start gap-3 rounded-lg border border-border-strong bg-surface p-4">
                    <Terminal className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
                    <div className="text-xs">
                      <strong className="text-fg">Model Context Protocol (MCP) Boundary:</strong>
                      <p className="mt-0.5 text-fg-secondary">
                        The LLM does not execute arbitrary Cypher or touch the raw database. It
                        requests actions through typed MCP tool contracts:{" "}
                        <code className="text-accent">trace_funds</code>,{" "}
                        <code className="text-accent">inspect_counterparties</code>, and{" "}
                        <code className="text-accent">detect_patterns</code>.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 rounded-lg border border-border-strong bg-surface p-4">
                    <Shield className="mt-0.5 size-4 shrink-0 text-safe" aria-hidden />
                    <div className="text-xs">
                      <strong className="text-fg">Deterministic Evidence Verification:</strong>
                      <p className="mt-0.5 text-fg-secondary">
                        Before presenting an agent narrative to an analyst, a deterministic verifier
                        validates that every transaction ID, account ID, currency amount, and
                        timestamp mentioned in the report was physically returned by an approved
                        tool in the trace. If any claim fails validation, the draft is rejected with
                        an explicit error.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 rounded-lg border border-border-strong bg-surface p-4">
                    <Zap className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
                    <div className="text-xs">
                      <strong className="text-fg">Graceful Deterministic Fallback:</strong>
                      <p className="mt-0.5 text-fg-secondary">
                        If the LLM provider experiences network latency, rate limits, or outage,
                        TraceAML seamlessly falls back to deterministic template reporting without
                        dropping the alert or interrupting the analyst review workflow.
                      </p>
                    </div>
                  </div>
                </div>
              </section>

              {/* SECTION 8 */}
              <section id="analyst-workbench" className="scroll-mt-24 space-y-5">
                <h2 className="text-xl font-bold tracking-tight text-fg sm:text-2xl">
                  8. The Analyst Workbench Guide
                </h2>
                <p className="text-fg-secondary">
                  Now that you understand the underlying architecture, here is how to navigate the
                  TraceAML workbench interface efficiently:
                </p>

                <div className="space-y-4 text-xs">
                  <div className="rounded-lg border border-border-strong bg-surface p-4">
                    <h4 className="text-sm font-semibold text-fg">
                      1. Overview Command Center (/overview)
                    </h4>
                    <p className="mt-1 text-fg-secondary">
                      Your operational cockpit. The top KPI HUD shows cohort size, risk triage
                      breakdown, and FalkorDB engine status. The alert queue defaults to{" "}
                      <strong>Flagged for review</strong> (1,585 alerts). Click the{" "}
                      <code className="text-accent">Inspect</code> eye button on any row to open the
                      peek drawer for a quick risk preview without losing queue position.
                    </p>
                  </div>

                  <div className="rounded-lg border border-border-strong bg-surface p-4">
                    <h4 className="text-sm font-semibold text-fg">
                      2. Investigation Canvas (/investigation/[id])
                    </h4>
                    <p className="mt-1 text-fg-secondary">
                      The graph workstation. Shows interactive Cytoscape node visualizations,
                      traveling money flow animations on edges, a circular risk score gauge, and
                      one-click metadata copying. Use the queue stepper (
                      <code className="text-accent">Previous Alert</code> /{" "}
                      <code className="text-accent">Next Alert</code>) to review queued items
                      sequentially.
                    </p>
                  </div>

                  <div className="rounded-lg border border-border-strong bg-surface p-4">
                    <h4 className="text-sm font-semibold text-fg">
                      3. Performance & Evaluation Lab (/performance)
                    </h4>
                    <p className="mt-1 text-fg-secondary">
                      The benchmark hub. Review Champion vs Baseline Average Precision deltas
                      (+374%) and latency distributions. Use the{" "}
                      <strong>Interactive Alert Budget Simulator</strong> slider to project daily
                      alert volume, true vs. false positive ratios, and analyst workload hours.
                    </p>
                  </div>
                </div>

                <DocsCallout type="tip" title="Global Keyboard Shortcuts">
                  <p>
                    Press{" "}
                    <kbd className="rounded border border-border-strong bg-surface px-1.5 py-0.5 font-mono text-2xs text-fg">
                      ?
                    </kbd>{" "}
                    anywhere in the application to view the shortcuts cheat-sheet. Press{" "}
                    <kbd className="rounded border border-border-strong bg-surface px-1.5 py-0.5 font-mono text-2xs text-fg">
                      /
                    </kbd>{" "}
                    to focus the transaction search input, and{" "}
                    <kbd className="rounded border border-border-strong bg-surface px-1.5 py-0.5 font-mono text-2xs text-fg">
                      Esc
                    </kbd>{" "}
                    to dismiss drawers and modals.
                  </p>
                </DocsCallout>
              </section>

              {/* SECTION 9 */}
              <section id="glossary" className="scroll-mt-24 space-y-5">
                <h2 className="text-xl font-bold tracking-tight text-fg sm:text-2xl">
                  9. Technical Glossary & Key Terms
                </h2>
                <p className="text-fg-secondary">
                  A searchable reference guide explaining the core vocabulary across machine
                  learning, graph theory, and financial crime compliance:
                </p>

                {/* Interactive Glossary */}
                <DocsGlossary />
              </section>
            </div>

            {/* Footer with Author Bio and Workbench Links */}
            <DocsFooter claps={claps} onClap={() => setClaps((c) => c + 1)} />
          </article>

          {/* Sticky Sidebar Table of Contents */}
          <DocsToc activeId={activeSection} />
        </div>
      </main>
    </div>
  );
}
