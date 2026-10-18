"use client";

import { Database, LoaderCircle, Play, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { SectionHeading } from "./section-heading";

interface QueryPreset {
  id: string;
  name: string;
  category: string;
  query: string;
  resultRows: {
    source: string;
    txId: string;
    dest: string;
    amount: string;
    timestamp: string;
    flag: string;
  }[];
}

const PRESETS: readonly [QueryPreset, ...QueryPreset[]] = [
  {
    id: "layering",
    name: "Trace a Layering Route",
    category: "Fund Tracking",
    query: `MATCH path = (origin:Account {id: 'B0412::A331992'})-[:SENT]->(t1:Transaction)
      -[:RECEIVED]->(mid:Account)-[:SENT]->(t2:Transaction)
      -[:RECEIVED]->(sink:Account)
WHERE t1.amount >= 100000.0
RETURN origin.id, t1.id, mid.id, t2.id, sink.id, t2.amount, t2.timestamp
LIMIT 5;`,
    resultRows: [
      {
        source: "B0412::A331992",
        txId: "TX-20220907-104328",
        dest: "B0118::A209411",
        amount: "$125,000.00",
        timestamp: "2022-09-07 10:43",
        flag: "Origin Outflow",
      },
      {
        source: "B0118::A209411",
        txId: "TX-20220907-110215",
        dest: "B0521::A892110",
        amount: "$124,500.00",
        timestamp: "2022-09-07 11:02",
        flag: "Mule Transit",
      },
      {
        source: "B0521::A892110",
        txId: "TX-20220907-111840",
        dest: "B0677::A118221",
        amount: "$123,800.00",
        timestamp: "2022-09-07 11:18",
        flag: "Offshore Sink",
      },
    ],
  },
  {
    id: "velocity",
    name: "Pass-Through Velocity (< 30 min)",
    category: "Velocity Check",
    query: `MATCH (mule:Account)-[:RECEIVED]-(inTx:Transaction),
      (mule)-[:SENT]-(outTx:Transaction)
WHERE inTx.timestamp <= outTx.timestamp
  AND duration.inMinutes(inTx.timestamp, outTx.timestamp).minutes <= 30
  AND outTx.amount >= inTx.amount * 0.90
RETURN mule.id, inTx.id, outTx.id, outTx.amount, outTx.timestamp;`,
    resultRows: [
      {
        source: "B0521::A892110",
        txId: "TX-20220907-110215",
        dest: "B0490::A100944",
        amount: "$124,500.00",
        timestamp: "2022-09-07 11:02",
        flag: "Rapid Depletion (18m)",
      },
      {
        source: "B0819::A440192",
        txId: "TX-20220907-142210",
        dest: "B0332::A551029",
        amount: "$88,200.00",
        timestamp: "2022-09-07 14:22",
        flag: "Rapid Depletion (24m)",
      },
      {
        source: "B0910::A771203",
        txId: "TX-20220907-160548",
        dest: "B0715::A449102",
        amount: "$49,900.00",
        timestamp: "2022-09-07 16:05",
        flag: "Rapid Depletion (12m)",
      },
    ],
  },
  {
    id: "structuring",
    name: "Smurfing Burst Detection",
    category: "Aggregation",
    query: `MATCH (sender:Account)-[:SENT]->(tx:Transaction)
WHERE tx.amount >= 9500.0 AND tx.amount < 10000.0
WITH sender, count(tx) AS burstCount, sum(tx.amount) AS aggregated
WHERE burstCount >= 4
RETURN sender.id, burstCount, aggregated
ORDER BY burstCount DESC;`,
    resultRows: [
      {
        source: "B0244::A882019",
        txId: "TX-20220908-091402",
        dest: "B0118::A209411",
        amount: "$9,850.00",
        timestamp: "2022-09-08 09:14",
        flag: "Sub-Threshold (1/5)",
      },
      {
        source: "B0244::A882019",
        txId: "TX-20220908-092815",
        dest: "B0332::A551029",
        amount: "$9,900.00",
        timestamp: "2022-09-08 09:28",
        flag: "Sub-Threshold (2/5)",
      },
      {
        source: "B0244::A882019",
        txId: "TX-20220908-094150",
        dest: "B0490::A100944",
        amount: "$9,750.00",
        timestamp: "2022-09-08 09:41",
        flag: "Sub-Threshold (3/5)",
      },
    ],
  },
];

type Row = QueryPreset["resultRows"][number];

/** How long the query "runs" before its rows arrive, and the gap between rows. */
const RUN_MS = 900;
const ROW_GAP_MS = 320;

type Phase = "idle" | "running" | "done";

/** The account part of a `bank::account` id. */
const accountOf = (id: string) => id.split("::")[1] ?? id;

type GraphNode = { id: string; x: number; y: number };
type GraphEdge = { id: string; from: GraphNode; to: GraphNode; order: number };

const VIEW_W = 520;
const VIEW_H = 150;

/**
 * Lay the returned rows out as a small left-to-right graph: accounts that only
 * send sit in the first column, and every hop moves one column right. A
 * layering route becomes a chain, a burst becomes a fan-out, and unrelated
 * pass-throughs become parallel pairs, all from the same rule.
 */
function layoutRows(rows: readonly Row[]): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const depth = new Map<string, number>();
  const received = new Set(rows.map((row) => row.dest));
  for (const row of rows) if (!received.has(row.source)) depth.set(row.source, 0);
  // Walk the rows until every account has a column; rows are few, so this settles fast.
  for (let pass = 0; pass < rows.length + 1; pass += 1) {
    for (const row of rows) {
      const from = depth.get(row.source) ?? 0;
      if (!depth.has(row.source)) depth.set(row.source, from);
      if ((depth.get(row.dest) ?? -1) < from + 1) depth.set(row.dest, from + 1);
    }
  }
  const columns = Math.max(...depth.values()) + 1;
  const byColumn = new Map<number, string[]>();
  for (const [id, column] of depth) byColumn.set(column, [...(byColumn.get(column) ?? []), id]);

  const position = new Map<string, GraphNode>();
  for (const [column, ids] of byColumn) {
    ids.forEach((id, index) => {
      const x = columns === 1 ? VIEW_W / 2 : 28 + (column * (VIEW_W - 56)) / (columns - 1);
      const y = ((index + 1) * VIEW_H) / (ids.length + 1);
      position.set(id, { id, x, y });
    });
  }
  const nodes = [...position.values()];
  const edges = rows.flatMap((row, order) => {
    const from = position.get(row.source);
    const to = position.get(row.dest);
    return from && to ? [{ id: row.txId, from, to, order }] : [];
  });
  return { nodes, edges };
}

function ResultGraph({ rows, shown }: { rows: readonly Row[]; shown: number }) {
  const { nodes, edges } = layoutRows(rows);
  const visible = edges.filter((edge) => edge.order < shown);
  const lit = new Set(visible.flatMap((edge) => [edge.from.id, edge.to.id]));
  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      role="img"
      aria-label={`The ${shown} returned transfers drawn as a graph`}
      className="h-36 w-full"
    >
      {visible.map((edge) => {
        const midX = (edge.from.x + edge.to.x) / 2;
        const midY = (edge.from.y + edge.to.y) / 2;
        return (
          <g key={edge.id}>
            <line
              x1={edge.from.x}
              y1={edge.from.y}
              x2={edge.to.x}
              y2={edge.to.y}
              pathLength={1}
              strokeDasharray={1}
              strokeDashoffset={1}
              className="[animation:draw-edge_520ms_ease-out_forwards] stroke-accent/70"
              strokeWidth={1.6}
            />
            {/* The transfer itself: a transaction node on the edge, as in the workbench. */}
            <rect
              x={midX - 5}
              y={midY - 5}
              width={10}
              height={10}
              rx={2.5}
              className="[transform-origin:center] [animation:reveal_360ms_ease-out_260ms_both] fill-[#1a110a] stroke-accent [transform-box:fill-box]"
              strokeWidth={1.4}
            />
          </g>
        );
      })}
      {nodes.map((node) => {
        const on = lit.has(node.id);
        return (
          <g key={node.id} className="transition-opacity duration-300" opacity={on ? 1 : 0.25}>
            <circle
              cx={node.x}
              cy={node.y}
              r={7}
              className={cn("fill-[#101112] transition-colors", on ? "stroke-ink" : "stroke-dim")}
              strokeWidth={1.4}
            />
            <text
              x={node.x}
              y={node.y + 19}
              textAnchor="middle"
              className="fill-dim font-mono text-[9px]"
            >
              {accountOf(node.id)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export default function CypherSandbox() {
  const [activePresetId, setActivePresetId] = useState<string>("layering");
  const [phase, setPhase] = useState<Phase>("idle");
  const [shown, setShown] = useState(0);
  const timers = useRef<number[]>([]);

  const currentPreset = PRESETS.find((p) => p.id === activePresetId) ?? PRESETS[0];
  const rows = currentPreset.resultRows;

  const clearTimers = () => {
    for (const id of timers.current) window.clearTimeout(id);
    timers.current = [];
  };
  useEffect(() => clearTimers, []);

  const reset = () => {
    clearTimers();
    setPhase("idle");
    setShown(0);
  };

  /** Replay the recorded run: a short "matching" state, then the rows one by one. */
  const handleRun = () => {
    reset();
    setPhase("running");
    timers.current.push(
      window.setTimeout(() => {
        setPhase("done");
        rows.forEach((_, index) => {
          timers.current.push(window.setTimeout(() => setShown(index + 1), index * ROW_GAP_MS));
        });
      }, RUN_MS),
    );
  };

  const running = phase === "running";

  return (
    <section
      id="sandbox"
      data-anchor
      className="border-t border-line bg-[#090a0b]/80 px-5 py-20 sm:px-8 sm:py-24"
    >
      <div className="mx-auto w-full max-w-[1260px]">
        <div data-reveal>
          <SectionHeading
            eyebrow="Interactive Sandbox"
            title="Cypher you can check, row by row."
            description="Preset Cypher the workbench runs against the synthetic IBM AMLworld replay. Run one and watch the rows FalkorDB returns, transaction by transaction."
          />
        </div>

        <div
          className="mt-12 overflow-hidden rounded-card border border-line bg-[#0c0d0e]"
          data-reveal
        >
          {/* Preset query selector bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-[#101113] p-4 sm:px-6">
            <div className="flex flex-wrap items-center gap-2">
              <span className="mr-2 text-[11px] font-medium tracking-wider text-dim uppercase">
                Query Presets:
              </span>
              {PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  aria-pressed={activePresetId === preset.id}
                  onClick={() => {
                    setActivePresetId(preset.id);
                    reset();
                  }}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-[12px] font-medium transition-colors",
                    activePresetId === preset.id
                      ? "bg-accent font-semibold text-accent-ink"
                      : "bg-[#181a1b] text-dim hover:bg-[#202224] hover:text-ink",
                  )}
                >
                  {preset.name}
                </button>
              ))}
            </div>

            <button
              type="button"
              disabled={running}
              onClick={handleRun}
              className="inline-flex items-center gap-2 rounded-control bg-accent px-4 py-2 text-[12px] font-semibold text-accent-ink shadow-sm transition-transform hover:brightness-110 active:scale-95 disabled:opacity-60"
            >
              {running ? (
                <LoaderCircle aria-hidden="true" className="h-3.5 w-3.5 animate-spin" />
              ) : phase === "done" ? (
                <RotateCcw aria-hidden="true" className="h-3.5 w-3.5" />
              ) : (
                <Play aria-hidden="true" className="h-3.5 w-3.5 fill-current" />
              )}
              {running ? "Executing..." : phase === "done" ? "Run again" : "Execute Query"}
            </button>
          </div>

          <div className="grid lg:grid-cols-12">
            {/* Cypher editor view: the statement wraps, so nothing scrolls sideways. */}
            <div className="min-w-0 border-b border-line bg-[#08090a] p-5 sm:p-6 lg:col-span-6 lg:border-r lg:border-b-0">
              <div className="flex items-center justify-between border-b border-line/60 pb-3 text-[11px] text-dim">
                <span className="font-mono text-accent">Cypher Shell · FalkorDB</span>
                <span>Read-Only Evaluation</span>
              </div>
              <pre className="mt-4 font-mono text-[12.5px] leading-6 break-words whitespace-pre-wrap text-[#d0d4d0] selection:bg-accent/30">
                <code>{currentPreset.query}</code>
              </pre>
            </div>

            {/* Results: what the run returned, as a graph and as rows. */}
            <div
              className="flex min-w-0 flex-col justify-between bg-[#0b0c0d] p-5 sm:p-6 lg:col-span-6"
              aria-live="polite"
              aria-busy={running}
            >
              <div>
                <div className="flex items-center justify-between border-b border-line/60 pb-3 text-[11px] text-dim">
                  <span className="flex items-center gap-1.5 font-medium text-white">
                    <Database aria-hidden="true" className="h-3.5 w-3.5 text-accent" />
                    {phase === "idle"
                      ? "Returned records"
                      : running
                        ? "Matching the pattern..."
                        : `Returned records (${shown} of ${rows.length} rows)`}
                  </span>
                  <span className="font-mono text-dim">Recorded result</span>
                </div>

                {phase === "idle" ? (
                  <div className="flex h-56 flex-col items-center justify-center gap-2 text-center">
                    <Play aria-hidden="true" className="h-5 w-5 text-dim" />
                    <p className="text-[13px] text-dim">
                      Execute the query to see what the graph returns.
                    </p>
                  </div>
                ) : running ? (
                  <div className="flex h-56 flex-col items-center justify-center gap-3">
                    <div className="h-1 w-40 overflow-hidden rounded-full bg-white/5">
                      <div className="h-full w-1/3 animate-[sandbox-scan_900ms_ease-in-out_infinite] rounded-full bg-accent" />
                    </div>
                    <p className="font-mono text-[11px] text-dim">
                      Walking SENT and RECEIVED edges...
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="mt-3 rounded-lg border border-line/60 bg-[#08090a]">
                      <ResultGraph rows={rows} shown={shown} />
                    </div>
                    <table className="mt-3 w-full table-fixed border-collapse text-left text-[11.5px]">
                      <thead>
                        <tr className="border-b border-line text-dim">
                          <th className="pb-2 font-medium">Source</th>
                          <th className="hidden pb-2 font-medium sm:table-cell">Transaction</th>
                          <th className="pb-2 font-medium">Destination</th>
                          <th className="pb-2 font-medium">Amount</th>
                          <th className="pb-2 font-medium">Classification</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line/40 font-mono">
                        {rows.slice(0, shown).map((row) => (
                          <tr
                            key={row.txId}
                            className="animate-[hero-rise_360ms_cubic-bezier(0.22,1,0.36,1)_both] hover:bg-white/[0.02]"
                          >
                            <td className="truncate py-2.5 text-accent">{accountOf(row.source)}</td>
                            <td className="hidden truncate py-2.5 text-white/90 sm:table-cell">
                              {row.txId.replace("TX-", "")}
                            </td>
                            <td className="truncate py-2.5 text-dim">{accountOf(row.dest)}</td>
                            <td className="truncate py-2.5 font-medium text-white">{row.amount}</td>
                            <td className="py-2.5 text-[10.5px]">
                              <span className="block truncate rounded bg-white/6 px-1.5 py-0.5 text-dim">
                                {row.flag}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </>
                )}
              </div>

              <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-line/60 pt-3 text-[11px] text-dim">
                <span>Read-only, human-authored Cypher. Replays a recorded run.</span>
                <span className="font-mono text-ink">
                  Rows come from the graph, never the model
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
