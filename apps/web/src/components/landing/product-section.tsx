import { FileCheck, FolderTree, ListChecks, Scale, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { SectionHeading } from "./section-heading";

/** The graph pattern the whole product is built on. */
function PatternDiagram() {
  return (
    <svg
      viewBox="0 0 440 132"
      role="img"
      aria-label="Pattern: an account sends a transaction, and that transaction is received by another account."
      className="mt-7 h-[132px] w-full"
    >
      <defs>
        <marker
          id="pattern-arrow"
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="5"
          markerHeight="5"
          orient="auto-start-reverse"
        >
          <path d="M0 0 10 5 0 10Z" fill="rgba(242,140,56,0.8)" />
        </marker>
      </defs>

      <line
        x1="80"
        y1="60"
        x2="176"
        y2="60"
        stroke="rgba(242,140,56,0.55)"
        markerEnd="url(#pattern-arrow)"
      />
      <line
        x1="264"
        y1="60"
        x2="360"
        y2="60"
        stroke="rgba(242,140,56,0.55)"
        markerEnd="url(#pattern-arrow)"
      />

      <text
        x="128"
        y="50"
        textAnchor="middle"
        fontFamily="var(--font-mono)"
        fontSize="10"
        fill="rgba(230,231,229,0.62)"
      >
        SENT
      </text>
      <text
        x="312"
        y="50"
        textAnchor="middle"
        fontFamily="var(--font-mono)"
        fontSize="10"
        fill="rgba(230,231,229,0.62)"
      >
        RECEIVED
      </text>

      <g transform="translate(220 60)">
        <rect
          x="-40"
          y="-24"
          width="80"
          height="48"
          rx="12"
          fill="#151312"
          stroke="rgba(242,140,56,0.6)"
        />
        <path
          d="M-11 8V-8h5l3-4h6l3 4h5V8Z"
          fill="none"
          stroke="var(--accent)"
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
        <text
          y="40"
          textAnchor="middle"
          fontFamily="var(--font-mono)"
          fontSize="10"
          fill="rgba(242,140,56,0.9)"
        >
          Transaction
        </text>
      </g>

      {[50, 390].map((x) => (
        <g key={x} transform={`translate(${x} 60)`}>
          <circle r="26" fill="#131415" stroke="rgba(230,231,229,0.22)" />
          <g
            stroke="rgba(230,231,229,0.72)"
            strokeWidth="1.4"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M-7.5-1.6 0-7.4 7.5-1.6H-7.5Z" />
            <path d="M-5.4-1.6v7.8M0-1.6v7.8M5.4-1.6v7.8" />
            <path d="M-7.8 6.6h15.6" />
          </g>
          <text
            y="46"
            textAnchor="middle"
            fontFamily="var(--font-mono)"
            fontSize="10"
            fill="rgba(230,231,229,0.62)"
          >
            Account
          </text>
        </g>
      ))}
    </svg>
  );
}

interface Capability {
  icon: typeof ShieldCheck;
  title: string;
  body: ReactNode;
  span: string;
  visual?: ReactNode;
}

const CAPABILITIES: readonly Capability[] = [
  {
    icon: ShieldCheck,
    title: "Graph evidence, straight from FalkorDB",
    body: (
      <>
        Transfers are first class: an account <span className="font-mono text-ink/90">SENT</span> a
        transaction that another account <span className="font-mono text-ink/90">RECEIVED</span>.
        Every node, edge and path on screen is the output of an executed, bounded Cypher query. What
        you see is what the graph returned.
      </>
    ),
    span: "lg:col-span-4",
    visual: <PatternDiagram />,
  },
  {
    icon: ListChecks,
    title: "Three reviewed tools",
    body: (
      <>
        The agent picks among <span className="font-mono text-ink/90">trace_funds</span>,{" "}
        <span className="font-mono text-ink/90">inspect_counterparties</span> and{" "}
        <span className="font-mono text-ink/90">detect_flow_patterns</span>. Each returns records
        from the graph; the model only proposes what to run next.
      </>
    ),
    span: "lg:col-span-2",
  },
  {
    icon: FileCheck,
    title: "Evidence-validated reports",
    body: "Every cited transaction ID, account key, amount and timestamp is checked against what the tools returned. Unsupported claims are rejected before an analyst reads them.",
    span: "lg:col-span-2",
  },
  {
    icon: Scale,
    title: "Policy decides, humans confirm",
    body: "Deterministic policy maps validated inputs to allow, review or a simulated block, and a failed model or provider falls back to the safe path.",
    span: "lg:col-span-2",
  },
  {
    icon: FolderTree,
    title: "Case memory with provenance",
    body: "Only explicit analyst confirmation promotes a suspected entity to confirmed memory. Dismissals stay on the record with their reasoning and full history.",
    span: "lg:col-span-2",
  },
];

export default function ProductSection() {
  return (
    <section id="product" data-anchor className="border-t border-line px-5 py-20 sm:px-8 sm:py-24">
      <div className="mx-auto w-full max-w-[1260px]">
        <div data-reveal>
          <SectionHeading
            eyebrow="Product"
            title="Evidence an analyst can defend."
            description="Tripwire is a workbench: every screen answers to a query that ran, and every recommendation carries the records behind it."
          />
        </div>

        <div className="mt-14 grid gap-4 lg:grid-cols-6">
          {CAPABILITIES.map((capability, index) => {
            const Icon = capability.icon;
            return (
              <article
                key={capability.title}
                data-reveal
                style={{ ["--reveal-delay" as string]: `${(index % 3) * 70}ms` }}
                className={cn(
                  "flex flex-col rounded-card border border-line bg-card/70 p-6 transition-colors duration-[var(--motion-standard)] hover:border-line-strong",
                  capability.span,
                )}
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-line bg-white/[0.03] text-accent">
                  <Icon aria-hidden="true" className="h-4 w-4" />
                </span>
                <h3 className="mt-5 text-[17px] font-semibold tracking-tight text-ink">
                  {capability.title}
                </h3>
                <p className="mt-2.5 text-[14px] leading-7 text-dim">{capability.body}</p>
                {capability.visual}
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
