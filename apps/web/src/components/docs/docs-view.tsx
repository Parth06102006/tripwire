"use client";

import { useEffect, useState } from "react";
import { Route, Shield, Terminal, Zap } from "lucide-react";
import SiteHeader from "@/components/landing/site-header";
import { DocsArticleHeader } from "./docs-article-header";
import { DocsToc, DOC_SECTIONS } from "./docs-toc";
import { DocsPipelineDiagram } from "./docs-pipeline-diagram";
import { DocsTypologyCard } from "./docs-typology-card";
import { DocsCodeBlock, DocsCallout } from "./docs-code-block";
import { DocsGlossary } from "./docs-glossary";
import { DocsReference } from "./docs-reference";
import { DocsFooter } from "./docs-footer";
import { useDocsTheme } from "@/hooks/use-docs-theme";
import { cn } from "@/lib/cn";

const COINBASE_FRAUD_AGENT_POST =
  "https://www.coinbase.com/en-in/blog/part-one-how-coinbase-built-evaluated-and-post-trained-a-fraud-agent";

export function DocsView() {
  const { theme } = useDocsTheme();
  const [progress, setProgress] = useState(0);
  const [activeSection, setActiveSection] = useState<string>("introduction");

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
      suppressHydrationWarning
      className={cn(
        "min-h-screen transition-colors duration-200",
        theme === "light"
          ? "theme-light bg-[#fcfcfb] text-[#191919]"
          : "theme-dark bg-[#080909] text-[#e6e7e5]",
      )}
    >
      {/* Reading progress: fixed to the viewport so it survives the shared sticky header. */}
      <div
        className="fixed top-0 left-0 z-[60] h-[3px] bg-accent transition-all duration-75 ease-out"
        style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
        role="progressbar"
        aria-valuenow={Math.round(progress)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Reading progress"
      />

      <a
        href="#doc-content"
        className="sr-only rounded-md bg-accent px-3 py-2 text-accent-ink focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[70]"
      >
        Skip to content
      </a>

      {/* The same navigation as the rest of the site. */}
      <SiteHeader />

      <main id="doc-content" className="mx-auto max-w-6xl px-4 py-8 sm:px-6 md:py-12">
        <div className="flex gap-12">
          {/* Main Article Column */}
          <article className="max-w-[760px] min-w-0 flex-1">
            <DocsArticleHeader />

            {/* Editorial Body Content */}
            <div className="mt-8 space-y-12 text-sm leading-[1.8] sm:text-base sm:leading-[1.85]">
              {/* SECTION 1 */}
              <section id="introduction" className="scroll-mt-24 space-y-5">
                <h2 className="text-xl font-bold tracking-tight text-fg sm:text-2xl">
                  1. The Bank and the Money-Flow Network
                </h2>
                <p className="text-fg-secondary">
                  Start from the bank’s side of the counter. You operate a transactional network
                  that clears hundreds of thousands of transfers, and you already run a machine
                  learning model that scores every one of them. The open question is no longer
                  whether the model can flag suspicious activity. It is what happens after an alert
                  fires: how much of the surrounding network a reviewer can actually see, and how
                  far the evidence behind a decision can be trusted.
                </p>
                <p className="text-fg-secondary">
                  New engineers tend to arrive with one straightforward rule:
                  <span className="italic">
                    {" "}
                    “Why can’t we just write an SQL query that flags transactions greater than
                    $10,000?”
                  </span>{" "}
                  Sophisticated bad actors anticipate exactly that query. Real-world money
                  laundering rarely takes the form of a single million-dollar wire from an illicit
                  entity into a luxury asset account. Illicit syndicates fracture capital across
                  dozens of intermediary conduit accounts, stagger timestamps across banking
                  holidays, and calibrate individual amounts to sit just beneath regulatory
                  thresholds.
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
                  Tripwire is organized around that reality as a layered system, not a single
                  oracle:
                </p>
                <ul className="list-disc space-y-2 pl-5 text-fg-secondary">
                  <li>
                    <strong>Layer one, the model:</strong> a gradient-boosted model scores every
                    replayed transaction, and deterministic policy routes each score to a simulated
                    block, the review queue, or straight-through processing.
                  </li>
                  <li>
                    <strong>Layer two, the agent pass:</strong> a bounded LLM agent picks up flagged
                    reviews and reads the surrounding activity in context, instead of guessing from
                    the aggregates the model was trained to carry.
                  </li>
                  <li>
                    <strong>The graph underneath:</strong> accounts and transfers live in FalkorDB
                    as first-class nodes, so the agent’s context is retrieved evidence rather than
                    model memory.
                  </li>
                </ul>
                <p className="text-fg-secondary">
                  This guide follows that layered path in order: what the model can and cannot do
                  (section 2), what changes when an agent pass is added on top (section 3), and how
                  the agent reads the transaction graph through bounded tools (section 4). The
                  remaining sections cover the AML patterns the graph exposes, the full pipeline,
                  the analyst workbench, and further reading.
                </p>
              </section>

              {/* SECTION 2 */}
              <section id="ml-model" className="scroll-mt-24 space-y-5">
                <h2 className="text-xl font-bold tracking-tight text-fg sm:text-2xl">
                  2. Layer One: The Model That Scores the Stream
                </h2>
                <p className="text-fg-secondary">
                  The first layer is deliberately boring technology, because it has to run across
                  the whole stream. Tripwire pairs graph-derived features with a high-performance
                  gradient boosting detection engine. During the model selection tournament
                  (recorded in the Iteration 2 benchmarks), three candidate architectures were
                  evaluated against the baseline:
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
                    Standard test splits often include easy, high-value transfers. Tripwire
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

                <DocsCallout type="invariant" title="Score In, Policy Out">
                  The model and any LLM output are scores or proposals. Only deterministic policy
                  owns the allow, review, and simulated block decisions: a score at or above the
                  block threshold is held regardless of what a later agent concludes, and no model
                  output moves money on its own.
                </DocsCallout>

                <p className="text-fg-secondary">
                  One limitation of this layer is structural, not a tuning problem. Every feature
                  the model consumes was designed in advance, and many of them are aggregates:
                  counts, velocities, ratios, balances. That compresses a sequence of related
                  transfers into a handful of numbers, and a pattern that only exists in the shape
                  of the activity, such as a fan-out ring or a pass-through chain, survives only as
                  a blur. The model can rank the stream; it cannot follow a funds path, and it
                  cannot explain itself to a reviewer. That gap is where the second layer comes in.
                </p>
              </section>

              {/* SECTION 3 */}
              <section id="agent-pass" className="scroll-mt-24 space-y-5">
                <h2 className="text-xl font-bold tracking-tight text-fg sm:text-2xl">
                  3. Layer Two: The Agent Pass on Flagged Reviews
                </h2>
                <p className="text-fg-secondary">
                  To increase security, the bank adds a second pass. Instead of asking one model to
                  carry the whole decision, Tripwire runs an LLM agent downstream of the detector,
                  over the transactions the model already flagged. The agent’s job is narrow and
                  explicit: look at the alert in the context of the surrounding network, and say
                  whether the evidence supports escalation.
                </p>
                <p className="text-fg-secondary">
                  The pass is opt-in per investigation. With the agent disabled, a request returns
                  the deterministic report: fast, free, and evidence-bound. With{" "}
                  <code className="rounded bg-surface px-1.5 py-0.5 text-xs text-accent">
                    use_llm
                  </code>{" "}
                  enabled and a provider configured, the same evidence set feeds a Gemini
                  tool-calling agent. It selects among the approved graph tools, drafts a hypothesis
                  with a risk level and reasoning, and the draft then has to survive a deterministic
                  verifier. The provider is allowed to fail; the review is not.
                </p>

                <h3 className="pt-2 text-base font-semibold text-fg">
                  The Four Rules That Keep the Pass Bounded
                </h3>
                <div className="space-y-3">
                  <div className="flex items-start gap-3 rounded-lg border border-border-strong bg-surface p-4">
                    <Route className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
                    <div className="text-xs">
                      <strong className="text-fg">Route selectively:</strong>
                      <p className="mt-0.5 text-fg-secondary">
                        The agent is invoked only for flagged reviews that opt in. The bulk of the
                        stream keeps the speed and low cost of the deterministic path, so spending
                        on context follows attention, not volume.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 rounded-lg border border-border-strong bg-surface p-4">
                    <Terminal className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
                    <div className="text-xs">
                      <strong className="text-fg">Tools, not database access:</strong>
                      <p className="mt-0.5 text-fg-secondary">
                        The model never writes Cypher and never touches the raw database. It asks
                        through typed, read-only tools over the Model Context Protocol:{" "}
                        <code className="text-accent">trace_funds</code>,{" "}
                        <code className="text-accent">inspect_counterparties</code>, and{" "}
                        <code className="text-accent">detect_flow_patterns</code>. Arguments are
                        validated against their ranges before any database call, and hops, windows,
                        and row limits are capped.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 rounded-lg border border-border-strong bg-surface p-4">
                    <Shield className="mt-0.5 size-4 shrink-0 text-safe" aria-hidden />
                    <div className="text-xs">
                      <strong className="text-fg">A reviewer, not an actor:</strong>
                      <p className="mt-0.5 text-fg-secondary">
                        The model never sets the risk score, the decision, or the recommendation;
                        the recommendation is fixed to human review by code. A rule-based block
                        cannot be reversed by the agent. Case proposals pass a separate
                        deterministic gate and can only write to the local case store.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 rounded-lg border border-border-strong bg-surface p-4">
                    <Zap className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
                    <div className="text-xs">
                      <strong className="text-fg">Bounded, observable, fallible:</strong>
                      <p className="mt-0.5 text-fg-secondary">
                        Tool calls, model rounds, and wall time are bounded by configuration, and
                        every executed statement, parameter set, row count, and duration lands in
                        the tool trace. Provider errors, timeouts, invalid output, and failed
                        verification all resolve to the deterministic report, with the reason
                        recorded instead of an exception shown.
                      </p>
                    </div>
                  </div>
                </div>

                <p className="text-fg-secondary">
                  What reaches the analyst is only what survived verification. A verified draft
                  reads like a review, not a lecture: a risk level from 1 to 5, a hypothesis,
                  supporting and counter-evidence transaction IDs, and one to six reasoning points,
                  each tied to the evidence IDs that back it. If any cited ID, amount, currency,
                  timestamp, or path is not in the records the tools actually returned, the draft is
                  rejected and the deterministic report stands in its place.
                </p>

                <DocsCallout type="info" title="Field note: the same shape of system at Coinbase">
                  <p>
                    Coinbase’s Onramp team layered an LLM risk agent onto their existing ML model
                    and rules, downstream of those checks: the agent can block a transaction that
                    would otherwise be allowed, but it cannot override an upstream block. In an
                    online experiment, the agent-enabled flow recorded 30% fewer fraudulent
                    transactions and 22% less fraud value than the existing stack alone. Their
                    write-up,{" "}
                    <a
                      href={COINBASE_FRAUD_AGENT_POST}
                      target="_blank"
                      rel="noreferrer"
                      className="font-medium text-accent underline decoration-accent/40 underline-offset-2 hover:decoration-accent"
                    >
                      How Coinbase Built, Evaluated, and Post-Trained a Fraud Agent
                    </a>
                    , is the closest public account of the same design decisions, and it is worth a
                    full read. It is referenced again in section 9.
                  </p>
                </DocsCallout>
              </section>

              {/* SECTION 4 */}
              <section id="graph-foundation" className="scroll-mt-24 space-y-5">
                <h2 className="text-xl font-bold tracking-tight text-fg sm:text-2xl">
                  4. What the Agent Reads: The Graph
                </h2>
                <p className="text-fg-secondary">
                  The agent pass is only as good as the context it can reach, and in Tripwire that
                  context is the money-flow graph itself. The bank’s ledger was always a sequence of
                  transfers between accounts; the design decision is how to store it. Modeling
                  transactions as edges between accounts (e.g.,{" "}
                  <code className="rounded bg-surface px-1.5 py-0.5 text-xs text-accent">
                    (:Account)-[:TRANSFERRED]-&gt;(:Account)
                  </code>
                  ) is a common pitfall. When multiple transfers occur between the same two accounts
                  over time, edges accumulate arrays of timestamps and amounts, and multi-hop Cypher
                  queries become slower and less precise.
                </p>
                <p className="text-fg-secondary">
                  Tripwire enforces a fundamental architectural invariant:
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
                    Tripwire Canonical Graph Schema: Transactions are nodes holding immutable
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
                  Tripwire operates in a strictly target-free environment during live workbench
                  inference. Target labels (<code className="font-mono text-xs">is_laundering</code>
                  ) and ground-truth typologies remain quarantined in offline evaluation test sets.
                  The inference graph and API contracts never receive or return ground-truth labels.
                </DocsCallout>

                <p className="text-fg-secondary">
                  When a reviewer or the agent asks a question, it is answered by bounded Cypher
                  executed against <strong>FalkorDB</strong>, a high-throughput graph database
                  engine built upon Redis that translates queries into sparse-matrix operations via
                  GraphBLAS. The agent reaches it through the same three approved read-only tools
                  every time:
                </p>

                <div className="grid gap-3 text-xs sm:grid-cols-3">
                  <div className="rounded-lg border border-border-strong bg-surface p-3.5">
                    <span className="font-mono font-semibold text-accent">trace_funds</span>
                    <p className="mt-1 text-fg-muted">
                      Ordered transaction and account paths outward from the anchor transfer, by
                      direction, depth, time window, and row limit.
                    </p>
                  </div>
                  <div className="rounded-lg border border-border-strong bg-surface p-3.5">
                    <span className="font-mono font-semibold text-accent">
                      inspect_counterparties
                    </span>
                    <p className="mt-1 text-fg-muted">
                      The accounts on both ends of the anchor and the source-backed repeated
                      activity around them.
                    </p>
                  </div>
                  <div className="rounded-lg border border-border-strong bg-surface p-3.5">
                    <span className="font-mono font-semibold text-accent">
                      detect_flow_patterns
                    </span>
                    <p className="mt-1 text-fg-muted">
                      Fan-in, fan-out, and pass-through matches, with the supporting transaction IDs
                      for each match.
                    </p>
                  </div>
                </div>

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

                <DocsCallout type="warning" title="Empty Results Are Not Safety">
                  Every tool query is parameterized and bounded: traversals cap at a few hops,
                  windows at days not years, and every result set has an explicit row limit. An
                  empty result is not evidence that no suspicious activity exists outside the query
                  scope, and it never maps to an allow decision.
                </DocsCallout>
              </section>

              {/* SECTION 5 */}
              <section id="key-typologies" className="scroll-mt-24 space-y-5">
                <h2 className="text-xl font-bold tracking-tight text-fg sm:text-2xl">
                  5. The AML Patterns the Graph Exposes
                </h2>
                <p className="text-fg-secondary">
                  In the synthetic IBM AMLworld dataset, laundering syndicates repeat a small set of
                  structural behaviors. Each is awkward to express as a predefined feature and
                  natural to express as a traversal, which is why the second layer works on a graph
                  in the first place:
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

              {/* SECTION 6 */}
              <section id="end-to-end-architecture" className="scroll-mt-24 space-y-5">
                <h2 className="text-xl font-bold tracking-tight text-fg sm:text-2xl">
                  6. The Full Pipeline, End to End
                </h2>
                <p className="text-fg-secondary">
                  Putting the layers in order: the replay stream feeds a point-in-time feature
                  store, the model scores every transaction into deterministic routes, the agent
                  pass picks up the flagged reviews, the graph supplies the evidence, and the
                  analyst owns the conclusion.
                </p>

                {/* Interactive Pipeline Diagram */}
                <DocsPipelineDiagram />

                <p className="text-fg-secondary">
                  The pipeline is engineered for sub-second analyst responsiveness. While the model
                  scores over 76,000 transactions per second, graph evidence traversal completes in
                  under 7ms on the demo slice, so the wait a reviewer actually notices is the agent
                  pass, never the database.
                </p>
              </section>

              {/* SECTION 7 */}
              <section id="analyst-workbench" className="scroll-mt-24 space-y-5">
                <h2 className="text-xl font-bold tracking-tight text-fg sm:text-2xl">
                  7. The Analyst Workbench Guide
                </h2>
                <p className="text-fg-secondary">
                  Now that you understand the underlying architecture, here is how to navigate the
                  Tripwire workbench interface efficiently:
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
                      The graph workstation. The conversation pane logs the agent pass as it runs:
                      every graph tool call with its purpose, the executed Cypher and its
                      parameters, and what each result added to the graph. The review ends with a
                      verdict: the simulated decision, the risk level, the path through the
                      escalation chain, and the verified reasoning with clickable evidence. The
                      graph canvas shows traveling money-flow animations on the retrieved edges, and
                      the queue stepper (<code className="text-accent">Previous Alert</code> /{" "}
                      <code className="text-accent">Next Alert</code>) moves through queued items
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

              {/* SECTION 8 */}
              <section id="glossary" className="scroll-mt-24 space-y-5">
                <h2 className="text-xl font-bold tracking-tight text-fg sm:text-2xl">
                  8. Technical Glossary & Key Terms
                </h2>
                <p className="text-fg-secondary">
                  A searchable reference guide explaining the core vocabulary across machine
                  learning, graph databases, and financial crime compliance:
                </p>

                {/* Interactive Glossary */}
                <DocsGlossary />
              </section>

              {/* SECTION 9 */}
              <section id="further-reading" className="scroll-mt-24 space-y-5">
                <h2 className="text-xl font-bold tracking-tight text-fg sm:text-2xl">
                  9. Further Reading: Field Notes
                </h2>
                <p className="text-fg-secondary">
                  The layered design in this guide is not unique to Tripwire; banks, exchanges, and
                  payment processors are converging on the same division of labor. The closest
                  public account is Coinbase’s three-part series on their Onramp fraud agent, which
                  documents the build, the evaluation method, and the post-training work in unusual
                  detail:
                </p>

                <DocsReference
                  title="Part 1: How Coinbase Built, Evaluated, and Post-Trained a Fraud Agent"
                  source="Coinbase Engineering Blog"
                  published="October 2026"
                  href={COINBASE_FRAUD_AGENT_POST}
                  summary="Coinbase Onramp placed an LLM risk agent downstream of its existing ML model and rules engine. The agent reviews recent transaction sequences in context as a constrained reviewer rather than an open-ended workflow, can block a transaction the model would have allowed, and can never override an upstream block. Part 1 covers the build and the online experiment; the later parts cover how the team evaluated frontier models on a domain benchmark and post-trained a smaller model to own the task."
                  metrics={[
                    {
                      value: "30%",
                      label: "Fewer fraudulent transactions in the agent-enabled treatment group",
                    },
                    {
                      value: "22%",
                      label: "Less fraud value than the existing stack alone",
                    },
                    {
                      value: "3x",
                      label: "Projected fraud savings over estimated inference cost",
                    },
                  ]}
                  notes={[
                    "Route selectively: the model and rules handle broad screening, the agent adds contextual review.",
                    "Keep the decision path simple and bounded, with application code owning the policy.",
                    "Instrument the serving layer so detection behavior and serving behavior stay separable.",
                  ]}
                />

                <p className="text-fg-secondary">
                  One scope note before you cite anything on this page: Tripwire is a synthetic IBM
                  AMLworld workbench, not a production deployment and not a Coinbase replica. The
                  shared lesson is about the shape of the system, a model for coverage, an agent for
                  context, and deterministic code for authority. The benchmark numbers in this guide
                  describe the synthetic replay only and do not establish real-world AML
                  effectiveness.
                </p>
              </section>
            </div>

            {/* Workbench launch cards */}
            <DocsFooter />
          </article>

          {/* Sticky Sidebar Table of Contents */}
          <DocsToc activeId={activeSection} />
        </div>
      </main>
    </div>
  );
}
