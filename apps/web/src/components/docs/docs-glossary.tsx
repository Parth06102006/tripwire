"use client";

import { useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import { cn } from "@/lib/cn";

interface Term {
  term: string;
  category: "Machine Learning" | "Graph Database" | "AML Regulatory" | "System Architecture";
  definition: string;
  context: string;
}

const GLOSSARY_TERMS: Term[] = [
  {
    term: "Average Precision (AP)",
    category: "Machine Learning",
    definition:
      "A ranking metric that calculates the area under the Precision-Recall curve. It summarizes how accurately a model ranks illicit transactions above legitimate ones.",
    context:
      "In Tripwire, the Champion model achieves 0.752 AP on the held-out test split, compared to the 0.150 baseline (+374% relative gain).",
  },
  {
    term: "Alert Budget",
    category: "AML Regulatory",
    definition:
      "The finite maximum number of alerts a human compliance department can investigate per calendar day without inducing analyst fatigue or backlog.",
    context:
      "At a 0.001 (0.1%) alert budget over 761,639 transactions (762 total alerts), the Champion model achieves 97.8% precision, identifying 745 confirmed illicit transfers with only 17 false positives.",
  },
  {
    term: "First-Class Transaction",
    category: "Graph Database",
    definition:
      "A graph data modeling pattern where transactions are distinct labeled nodes rather than simple edge properties: (:Account)-[:SENT]->(:Transaction)-[:RECEIVED]->(:Account).",
    context:
      "This invariant ensures stable transaction IDs, attaches multi-currency timestamps directly to the transaction node, and enables bi-directional tracing in Cypher without edge ambiguities.",
  },
  {
    term: "FalkorDB",
    category: "Graph Database",
    definition:
      "A high-throughput low-latency graph database engine built on Redis that utilizes GraphBLAS sparse-matrix linear algebra for Cypher query execution.",
    context:
      "Tripwire queries FalkorDB to extract 2-hop subgraphs and counterparty rings around anchor alerts in sub-6 milliseconds.",
  },
  {
    term: "Temporal Leakage Invariant",
    category: "System Architecture",
    definition:
      "The strict principle that no feature calculated for a transaction occurring at timestamp t may incorporate information or aggregate statistics generated after timestamp t.",
    context:
      "Prevents artificial evaluation inflation. Tripwire generates features exclusively using past time horizons (t <= t_event).",
  },
  {
    term: "Suspicious Activity Report (SAR)",
    category: "AML Regulatory",
    definition:
      "A formalized legal dossier submitted by financial institutions to regulatory authorities (such as FinCEN or FIUs) detailing detected suspicious transactions.",
    context:
      "When an analyst confirms an investigation in Tripwire, the workbench compiles the Cypher graph paths, LLM findings, and transaction timestamps into an audit-ready dossier.",
  },
  {
    term: "Agent Pass",
    category: "System Architecture",
    definition:
      "The optional second layer of review in Tripwire: an LLM tool-calling agent that runs downstream of the model on flagged transactions, with bounded tools and a fixed human-review recommendation.",
    context:
      "Enabled per investigation with use_llm: the agent drafts a risk level from 1 to 5 with reasoning points, and the deterministic verifier accepts them only when every cited record was returned by an approved tool.",
  },
  {
    term: "Tool Trace",
    category: "System Architecture",
    definition:
      "The recorded facts of each graph tool call: tool name, bounded arguments, the executed Cypher statements, row counts, duration, and outcome.",
    context:
      "The evidence verifier and the analyst interface both read from the same tool trace, so a report can cite only records that a tool actually returned.",
  },
  {
    term: "Model Context Protocol (MCP)",
    category: "System Architecture",
    definition:
      "An open protocol developed to standardize how LLMs connect with external data tools, APIs, and graph query execution engines.",
    context:
      "The Gemini agent in Tripwire calls FalkorDB through MCP tools (trace_funds, inspect_counterparties, detect_flow_patterns), preventing raw database access while logging a verifiable tool trace.",
  },
  {
    term: "Deterministic Policy Ownership",
    category: "System Architecture",
    definition:
      "The rule that ML models and LLMs produce scores and recommendations, but only deterministic software rules own actual financial action execution (allow, review, block).",
    context:
      "Even if an LLM proposes a dismissal, it cannot reverse a hard-rule block triggered at the block threshold (score >= 0.999).",
  },
];

export function DocsGlossary() {
  const [query, setQuery] = useState("");
  const [expandedTerm, setExpandedTerm] = useState<string | null>(null);

  const filtered = GLOSSARY_TERMS.filter(
    (item) =>
      item.term.toLowerCase().includes(query.toLowerCase()) ||
      item.definition.toLowerCase().includes(query.toLowerCase()) ||
      item.category.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <div className="my-8 rounded-xl border border-border-strong bg-surface p-5 shadow-sm sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold tracking-wide text-fg uppercase">
            Interactive Technical Glossary
          </h4>
          <p className="text-xs text-fg-muted">
            Quick reference for core concepts across Machine Learning, Graph Databases, and AML
          </p>
        </div>
        <div className="relative w-full sm:w-64">
          <Search
            className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-fg-muted"
            aria-hidden
          />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search glossary..."
            className="w-full rounded-md border border-border-strong bg-surface-sunken py-1.5 pr-3 pl-8 text-xs text-fg placeholder:text-fg-muted focus:border-accent focus:outline-none"
          />
        </div>
      </div>

      <div className="divide-y divide-border-strong rounded-lg border border-border-strong bg-surface-sunken">
        {filtered.length === 0 ? (
          <div className="p-6 text-center text-xs text-fg-muted">
            No glossary terms match your search query.
          </div>
        ) : (
          filtered.map((item) => {
            const isExpanded = expandedTerm === item.term;
            return (
              <div key={item.term} className="p-3.5 sm:p-4">
                <button
                  type="button"
                  onClick={() => setExpandedTerm(isExpanded ? null : item.term)}
                  className="flex w-full items-center justify-between text-left text-xs font-semibold text-fg"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-fg">{item.term}</span>
                    <span className="text-3xs rounded bg-surface px-2 py-0.5 font-medium text-fg-muted">
                      {item.category}
                    </span>
                  </div>
                  <ChevronDown
                    className={cn(
                      "size-4 shrink-0 text-fg-muted transition-transform",
                      isExpanded && "rotate-180",
                    )}
                    aria-hidden
                  />
                </button>
                <div className="mt-1.5 text-xs leading-relaxed text-fg-secondary">
                  {item.definition}
                </div>
                {isExpanded && (
                  <div className="mt-2.5 rounded border border-border-strong bg-surface p-2.5 text-xs">
                    <span className="font-semibold text-accent">Tripwire Context: </span>
                    <span className="text-fg-secondary">{item.context}</span>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
