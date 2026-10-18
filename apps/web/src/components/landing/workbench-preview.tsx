"use client";

import {
  ArrowRight,
  BellRing,
  ChartColumn,
  LayoutDashboard,
  Layers,
  Network,
  Search,
  TriangleAlert,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { BrandGlyph } from "./brand";

/* ------------------------------------------------------------------ *
 * Graph geometry & static evidence records
 * ------------------------------------------------------------------ */

type NodeKind = "origin" | "bank" | "hub" | "alert";

interface PreviewNode {
  id: string;
  x: number;
  y: number;
  kind: NodeKind;
  label?: string;
  account: string;
  bankName: string;
}

interface PreviewEdge {
  from: string;
  to: string;
  highlight?: boolean;
}

const NODE_RADIUS = 24;

const NODES: readonly PreviewNode[] = [
  {
    id: "origin",
    x: 58,
    y: 152,
    kind: "origin",
    label: "Origin",
    account: "B0412::A331992",
    bankName: "Origin Bank 0412",
  },
  {
    id: "b1",
    x: 168,
    y: 92,
    kind: "bank",
    account: "B0118::A209411",
    bankName: "Transit Union 0118",
  },
  {
    id: "b2",
    x: 168,
    y: 212,
    kind: "bank",
    account: "B0244::A882019",
    bankName: "Commercial 0244",
  },
  {
    id: "hub",
    x: 302,
    y: 152,
    kind: "hub",
    account: "B0521::A892110",
    bankName: "Central Clearing Hub",
  },
  {
    id: "c1",
    x: 438,
    y: 66,
    kind: "bank",
    account: "B0332::A551029",
    bankName: "Regional Trust 0332",
  },
  {
    id: "c2",
    x: 438,
    y: 152,
    kind: "bank",
    account: "B0490::A100944",
    bankName: "Direct Settlement 0490",
  },
  {
    id: "c3",
    x: 438,
    y: 238,
    kind: "bank",
    account: "B0715::A449102",
    bankName: "Offshore Gateway 0715",
  },
  {
    id: "target",
    x: 560,
    y: 152,
    kind: "alert",
    label: "Target",
    account: "B0677::A118221",
    bankName: "Target Beneficiary Bank",
  },
];

const EDGES: readonly PreviewEdge[] = [
  { from: "origin", to: "b1", highlight: true },
  { from: "origin", to: "b2" },
  { from: "b1", to: "hub", highlight: true },
  { from: "b2", to: "hub" },
  { from: "hub", to: "c1" },
  { from: "hub", to: "c2", highlight: true },
  { from: "hub", to: "c3" },
  { from: "c1", to: "target" },
  { from: "c2", to: "target", highlight: true },
  { from: "c3", to: "target" },
];

const NODE_TONE: Record<NodeKind, { stroke: string; fill: string; glyph: string; pulse: boolean }> =
  {
    origin: { stroke: "var(--accent)", fill: "#151312", glyph: "var(--accent)", pulse: true },
    bank: {
      stroke: "rgba(230,231,229,0.22)",
      fill: "#131415",
      glyph: "rgba(230,231,229,0.72)",
      pulse: false,
    },
    hub: { stroke: "rgba(242,140,56,0.75)", fill: "#171310", glyph: "var(--accent)", pulse: false },
    alert: { stroke: "var(--critical)", fill: "#1a1211", glyph: "var(--critical)", pulse: true },
  };

function nodeById(id: string): PreviewNode {
  const found = NODES.find((node) => node.id === id);
  if (!found) throw new Error(`Unknown preview node: ${id}`);
  return found;
}

function edgeGeometry(edge: PreviewEdge) {
  const from = nodeById(edge.from);
  const to = nodeById(edge.to);
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy) || 1;
  const ux = dx / length;
  const uy = dy / length;
  return {
    x1: from.x + ux * (NODE_RADIUS + 5),
    y1: from.y + uy * (NODE_RADIUS + 5),
    x2: to.x - ux * (NODE_RADIUS + 9),
    y2: to.y - uy * (NODE_RADIUS + 9),
  };
}

function NodeGlyph({ glyph, kind }: { glyph: string; kind: NodeKind }) {
  const common = {
    stroke: glyph,
    strokeWidth: 1.5,
    fill: "none",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  if (kind === "origin") {
    return (
      <g {...common}>
        <circle cx="0" cy="-4" r="3.4" />
        <path d="M-6 6.4c0-3.3 2.7-5.4 6-5.4s6 2.1 6 5.4" />
      </g>
    );
  }
  return (
    <g {...common}>
      <path d="M-7.4-1.6 0-7.4 7.4-1.6H-7.4Z" />
      <path d="M-5.4-1.6v7.8M0-1.6v7.8M5.4-1.6v7.8" />
      <path d="M-7.8 6.6h15.6" />
    </g>
  );
}

/* ------------------------------------------------------------------ *
 * Window chrome & Navigation definition
 * ------------------------------------------------------------------ */

interface SidebarEntry {
  readonly label: string;
  readonly href: string;
  readonly icon: typeof LayoutDashboard;
  readonly badge?: string;
}

const SIDEBAR: readonly SidebarEntry[] = [
  { label: "Overview", href: "/overview", icon: LayoutDashboard },
  { label: "Investigation", href: "/investigation", icon: Network },
  { label: "Performance", href: "/performance", icon: ChartColumn },
];

interface NodeDetail {
  txId: string;
  timestamp: string;
  amount: string;
  from: string;
  to: string;
  format: string;
  summary: string;
}

const NODE_DETAILS: Record<string, NodeDetail> & { default: NodeDetail } = {
  default: {
    txId: "TX-20220907-104328",
    timestamp: "2022-09-07 10:43:28",
    amount: "125,000.00 USD",
    from: "B0412::A331992",
    to: "B0677::A118221",
    format: "WIRE_TRANSFER",
    summary:
      "Identified a multi-hop transfer path (3 hops) with high-value round amounts and rapid movement between connected accounts.",
  },
  origin: {
    txId: "TX-20220907-104328",
    timestamp: "2022-09-07 10:43:28",
    amount: "125,000.00 USD",
    from: "B0412::A331992",
    to: "B0118::A209411",
    format: "WIRE_TRANSFER",
    summary:
      "Origin account initiated high-value wire disbursement into intermediary accounts with no previous transaction history.",
  },
  hub: {
    txId: "TX-20220907-110215",
    timestamp: "2022-09-07 11:02:15",
    amount: "124,500.00 USD",
    from: "B0118::A209411",
    to: "B0490::A100944",
    format: "WIRE_TRANSFER",
    summary:
      "Central routing hub: inflow received and re-transferred within 20 minutes, with almost the full amount passed on.",
  },
  target: {
    txId: "TX-20220907-111840",
    timestamp: "2022-09-07 11:18:40",
    amount: "123,800.00 USD",
    from: "B0490::A100944",
    to: "B0677::A118221",
    format: "WIRE_TRANSFER",
    summary:
      "Target beneficiary flagged for offshore layering destination. Rapid consolidation from intermediary mule ring.",
  },
};

export default function WorkbenchPreview() {
  const [selectedNode, setSelectedNode] = useState<string>("default");
  const [activeTab, setActiveTab] = useState<string>("Overview");

  const currentDetails = NODE_DETAILS[selectedNode] ?? NODE_DETAILS.default;

  return (
    <figure className="relative mx-auto w-full max-w-[1180px]">
      <div className="rounded-[20px] bg-gradient-to-b from-white/16 via-white/8 to-white/4 p-px shadow-[0_60px_160px_-40px_rgba(0,0,0,0.98)]">
        <div className="relative overflow-hidden rounded-[19px] bg-[#0b0c0d]">
          {/* Subtle top amber atmosphere sheen */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-36 bg-[radial-gradient(65%_120%_at_50%_0%,rgba(242,140,56,0.18),transparent_72%)]"
          />

          {/* Title bar matching the baseline screenshot */}
          <div className="relative flex h-12 items-center justify-between gap-4 border-b border-line px-3 sm:px-4">
            <span className="flex items-center gap-2">
              <BrandGlyph className="h-5 w-5" />
              <span className="text-[12px] font-bold tracking-[0.24em] text-white uppercase">
                Tripwire
              </span>
            </span>

            <div className="flex items-center gap-3 text-dim">
              <span className="cursor-pointer p-1 transition-colors hover:text-ink">
                <Search aria-hidden="true" className="h-3.5 w-3.5" />
              </span>
              <span className="relative cursor-pointer p-1 transition-colors hover:text-ink">
                <BellRing aria-hidden="true" className="h-3.5 w-3.5" />
                <span className="absolute top-0.5 right-0.5 h-1.5 w-1.5 rounded-full bg-accent" />
              </span>
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-[#4c5561] to-[#1e2327] text-[10px] font-medium text-white ring-1 ring-white/14">
                JD
              </span>
            </div>
          </div>

          <div className="grid md:grid-cols-[186px_minmax(0,1fr)] xl:grid-cols-[186px_minmax(0,1fr)_310px]">
            {/* Left workbench navigation sidebar */}
            <aside className="hidden flex-col gap-0.5 border-r border-line bg-[#090a0b] p-3 md:flex">
              {SIDEBAR.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.label;
                return (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => setActiveTab(item.label)}
                    className={cn(
                      "relative flex w-full items-center gap-2.5 rounded-[8px] px-2.5 py-2 text-left text-[12px] transition-colors",
                      isActive
                        ? "bg-[#2a1b12] font-medium text-white"
                        : "text-dim hover:bg-white/[0.04] hover:text-ink",
                    )}
                  >
                    <Icon
                      aria-hidden="true"
                      className={cn("h-3.5 w-3.5 shrink-0", isActive ? "text-accent" : "text-dim")}
                    />
                    <span className="truncate">{item.label}</span>
                    {item.badge ? (
                      <span className="ml-auto rounded-full bg-white/6 px-1.5 py-px font-mono text-[10px] text-dim">
                        {item.badge}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </aside>

            {/* Center live investigation graph viewport */}
            <div className="flex min-w-0 flex-col">
              <div className="flex flex-wrap items-start justify-between gap-3 px-4 pt-4 sm:px-5">
                <div className="min-w-0">
                  <span className="inline-flex items-center gap-2 text-[10px] font-semibold tracking-[0.2em] text-accent uppercase">
                    <span aria-hidden="true" className="relative flex h-1.5 w-1.5">
                      <span className="absolute inset-0 animate-ping rounded-full bg-accent opacity-75" />
                      <span className="relative h-1.5 w-1.5 rounded-full bg-accent" />
                    </span>
                    SAMPLE INVESTIGATION
                  </span>
                  <h3 className="mt-1 text-[16px] font-semibold tracking-tight text-white">
                    Suspicious Transaction Network
                  </h3>
                </div>

                <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-[#131415] px-2.5 py-1 font-mono text-[10px] text-dim">
                  bounded Cypher · 3 hops · 6 h
                </span>
              </div>

              {/* Network graph canvas with interactive nodes */}
              <div className="relative mt-2 h-[220px] px-2 sm:h-[270px] xl:h-[304px]">
                <svg
                  viewBox="0 0 620 304"
                  role="img"
                  aria-label="Interactive graph: origin account, intermediary nodes, hub and flagged target with highlighted 3-hop money flow."
                  className="h-full w-full select-none"
                >
                  <defs>
                    <pattern id="preview-grid" width="28" height="28" patternUnits="userSpaceOnUse">
                      <path d="M28 0H0v28" fill="none" stroke="rgba(230,231,229,0.04)" />
                    </pattern>
                    <marker
                      id="preview-arrow"
                      viewBox="0 0 10 10"
                      refX="8"
                      refY="5"
                      markerWidth="5"
                      markerHeight="5"
                      orient="auto-start-reverse"
                    >
                      <path d="M0 0 10 5 0 10Z" fill="rgba(230,231,229,0.3)" />
                    </marker>
                    <marker
                      id="preview-arrow-accent"
                      viewBox="0 0 10 10"
                      refX="8"
                      refY="5"
                      markerWidth="5"
                      markerHeight="5"
                      orient="auto-start-reverse"
                    >
                      <path d="M0 0 10 5 0 10Z" fill="var(--accent)" />
                    </marker>
                  </defs>

                  <rect width="620" height="304" fill="url(#preview-grid)" />

                  {/* Edges */}
                  {EDGES.map((edge) => {
                    const geometry = edgeGeometry(edge);
                    return (
                      <line
                        key={`${edge.from}-${edge.to}`}
                        {...geometry}
                        stroke={edge.highlight ? "rgba(242,140,56,0.6)" : "rgba(230,231,229,0.15)"}
                        strokeWidth={edge.highlight ? 1.8 : 1}
                        markerEnd={
                          edge.highlight ? "url(#preview-arrow-accent)" : "url(#preview-arrow)"
                        }
                      />
                    );
                  })}

                  {/* Flow animation dashes traveling along highlighted path */}
                  {EDGES.filter((e) => e.highlight).map((edge) => (
                    <line
                      key={`flow-${edge.from}-${edge.to}`}
                      {...edgeGeometry(edge)}
                      stroke="var(--accent)"
                      strokeWidth="2.4"
                      strokeLinecap="round"
                      strokeDasharray="6 22"
                      className="animate-flow"
                    />
                  ))}

                  {/* Graph nodes */}
                  {NODES.map((node) => {
                    const tone = NODE_TONE[node.kind];
                    const isSelected = selectedNode === node.id;
                    return (
                      <g
                        key={node.id}
                        transform={`translate(${node.x} ${node.y})`}
                        onClick={() => setSelectedNode(node.id)}
                        className="cursor-pointer transition-transform duration-150 hover:scale-105"
                      >
                        {tone.pulse ? (
                          <circle
                            r={NODE_RADIUS + 7}
                            fill="none"
                            stroke={tone.stroke}
                            strokeWidth="1"
                            className="node-pulse animate-node-pulse"
                          />
                        ) : null}

                        {isSelected ? (
                          <circle
                            r={NODE_RADIUS + 4}
                            fill="none"
                            stroke="white"
                            strokeWidth="1.5"
                            strokeDasharray="3 3"
                          />
                        ) : null}

                        <circle
                          r={NODE_RADIUS}
                          fill={tone.fill}
                          stroke={tone.stroke}
                          strokeWidth="1.4"
                        />
                        <circle
                          r={NODE_RADIUS + 5}
                          fill="none"
                          stroke={tone.stroke}
                          strokeOpacity="0.18"
                        />
                        <NodeGlyph glyph={tone.glyph} kind={node.kind} />

                        {node.label ? (
                          <text
                            y={NODE_RADIUS + 18}
                            textAnchor="middle"
                            fill={node.kind === "alert" ? "#ef6a62" : "rgba(230,231,229,0.75)"}
                            fontSize="11"
                            fontFamily="var(--font-sans)"
                            fontWeight="500"
                          >
                            {node.label}
                          </text>
                        ) : null}
                      </g>
                    );
                  })}
                </svg>
              </div>

              {/* Bottom 4 metric indicators from the baseline screenshot */}
              <div className="grid grid-cols-2 gap-2 border-t border-line p-3 sm:grid-cols-4 sm:px-4">
                {/* 1. Hops in path */}
                <div className="flex items-center gap-2.5 rounded-[9px] border border-line bg-[#101112] px-3 py-2">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[6px] bg-[#172535] text-[#4ea8de]">
                    <Network aria-hidden="true" className="h-4 w-4" />
                  </span>
                  <div>
                    <span className="block text-[15px] font-bold text-white tabular-nums">3</span>
                    <span className="block text-[10px] text-dim">Hops in path</span>
                  </div>
                </div>

                {/* 2. Connected accounts */}
                <div className="flex items-center gap-2.5 rounded-[9px] border border-line bg-[#101112] px-3 py-2">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[6px] bg-[#14291e] text-[#62b978]">
                    <Users aria-hidden="true" className="h-4 w-4" />
                  </span>
                  <div>
                    <span className="block text-[15px] font-bold text-white tabular-nums">6</span>
                    <span className="block text-[10px] text-dim">Connected accounts</span>
                  </div>
                </div>

                {/* 3. Related transactions */}
                <div className="flex items-center gap-2.5 rounded-[9px] border border-line bg-[#101112] px-3 py-2">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[6px] bg-[#1d222e] text-[#748cad]">
                    <Layers aria-hidden="true" className="h-4 w-4" />
                  </span>
                  <div>
                    <span className="block text-[15px] font-bold text-white tabular-nums">8</span>
                    <span className="block text-[10px] text-dim">Related transactions</span>
                  </div>
                </div>

                {/* 4. Risk indicator */}
                <div className="flex items-center gap-2.5 rounded-[9px] border border-line bg-[#101112] px-3 py-2">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[6px] bg-[#2d1715] text-critical">
                    <TriangleAlert aria-hidden="true" className="h-4 w-4" />
                  </span>
                  <div>
                    <span className="block text-[15px] font-bold text-critical">High</span>
                    <span className="block text-[10px] text-dim">Risk indicator</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right evidence & details panel matching screenshot */}
            <aside className="flex min-w-0 flex-col justify-between border-t border-line bg-[#090a0b]/60 px-4 py-4 sm:px-5 lg:border-t-0 xl:border-l">
              <div>
                <p className="text-[11px] font-semibold tracking-[0.16em] text-white">
                  Transaction Details
                </p>

                <dl className="mt-3.5 space-y-2.5">
                  <div className="flex items-baseline justify-between gap-3 text-[11px]">
                    <dt className="shrink-0 text-dim">Transaction ID</dt>
                    <dd className="truncate font-mono text-white">{currentDetails.txId}</dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-3 text-[11px]">
                    <dt className="shrink-0 text-dim">Timestamp</dt>
                    <dd className="truncate font-mono text-white">{currentDetails.timestamp}</dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-3 text-[11px]">
                    <dt className="shrink-0 text-dim">Amount</dt>
                    <dd className="truncate font-mono font-medium text-white">
                      {currentDetails.amount}
                    </dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-3 text-[11px]">
                    <dt className="shrink-0 text-dim">From</dt>
                    <dd className="truncate font-mono text-accent">{currentDetails.from}</dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-3 text-[11px]">
                    <dt className="shrink-0 text-dim">To</dt>
                    <dd className="truncate font-mono text-white">{currentDetails.to}</dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-3 text-[11px]">
                    <dt className="shrink-0 text-dim">Payment Format</dt>
                    <dd className="truncate font-mono text-white">{currentDetails.format}</dd>
                  </div>
                </dl>

                <div className="mt-5 border-t border-line pt-4">
                  <p className="text-[11px] font-semibold tracking-[0.16em] text-white">
                    Investigation Summary
                  </p>
                  <p className="mt-2.5 rounded-[9px] border border-line bg-[#101112] p-3 text-[11.5px] leading-5 text-[#9fa3a0]">
                    {currentDetails.summary}
                  </p>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-line/60 pt-3">
                <Link
                  href="/investigation"
                  className="group inline-flex items-center gap-1.5 text-[12px] font-semibold text-accent transition-colors hover:text-white"
                >
                  View full investigation
                  <ArrowRight
                    aria-hidden="true"
                    className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1"
                  />
                </Link>
                <Link
                  href="/overview"
                  className="font-mono text-[11px] text-dim transition-colors hover:text-ink"
                >
                  Live queue &rarr;
                </Link>
              </div>
            </aside>
          </div>
        </div>
      </div>

      <figcaption className="mt-5 flex flex-col items-center gap-1.5 text-center text-[12px] text-dim sm:flex-row sm:justify-center sm:gap-2">
        <span>
          Interactive preview on synthetic IBM AMLworld replay data. Click nodes to inspect.
        </span>
        <Link
          href="/overview"
          className="inline-flex items-center gap-1 font-medium text-ink underline decoration-line-strong underline-offset-4 transition-colors hover:text-accent hover:decoration-accent"
        >
          Open the workbench
          <ArrowRight aria-hidden="true" className="h-3 w-3" />
        </Link>
      </figcaption>
    </figure>
  );
}
