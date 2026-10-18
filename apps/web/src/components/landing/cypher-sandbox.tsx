"use client";

import { useState } from "react";
import { Play, Database } from "lucide-react";
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

export default function CypherSandbox() {
  const [activePresetId, setActivePresetId] = useState<string>("layering");
  const [isRunning, setIsRunning] = useState<boolean>(false);

  const currentPreset = PRESETS.find((p) => p.id === activePresetId) ?? PRESETS[0];

  const handleRun = () => {
    setIsRunning(true);
    setTimeout(() => {
      setIsRunning(false);
    }, 400);
  };

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
            description="Preset Cypher the workbench runs against the synthetic IBM AMLworld replay. Inspect the rows FalkorDB returns, transaction by transaction."
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
                  onClick={() => {
                    setActivePresetId(preset.id);
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
              disabled={isRunning}
              onClick={handleRun}
              className="inline-flex items-center gap-2 rounded-control bg-accent px-4 py-2 text-[12px] font-semibold text-accent-ink shadow-sm transition-transform hover:brightness-110 active:scale-95 disabled:opacity-50"
            >
              <Play
                aria-hidden="true"
                className={cn("h-3.5 w-3.5 fill-current", isRunning && "animate-spin")}
              />
              {isRunning ? "Executing..." : "Execute Query"}
            </button>
          </div>

          <div className="grid lg:grid-cols-12">
            {/* Cypher editor view */}
            <div className="border-b border-line bg-[#08090a] p-5 sm:p-6 lg:col-span-6 lg:border-r lg:border-b-0">
              <div className="flex items-center justify-between border-b border-line/60 pb-3 text-[11px] text-dim">
                <span className="font-mono text-accent">Cypher Shell · FalkorDB</span>
                <span>Read-Only Evaluation</span>
              </div>
              <pre className="mt-4 overflow-x-auto font-mono text-[12.5px] leading-6 text-[#d0d4d0] selection:bg-accent/30">
                <code>{currentPreset.query}</code>
              </pre>
            </div>

            {/* Results table view */}
            <div className="flex flex-col justify-between bg-[#0b0c0d] p-5 sm:p-6 lg:col-span-6">
              <div>
                <div className="flex items-center justify-between border-b border-line/60 pb-3 text-[11px] text-dim">
                  <span className="flex items-center gap-1.5 font-medium text-white">
                    <Database aria-hidden="true" className="h-3.5 w-3.5 text-accent" />
                    Returned records ({currentPreset.resultRows.length} rows)
                  </span>
                  <span className="font-mono text-dim">Recorded result</span>
                </div>

                <div className="mt-4 overflow-x-auto">
                  <table className="w-full border-collapse text-left text-[11.5px]">
                    <thead>
                      <tr className="border-b border-line text-dim">
                        <th className="pb-2 font-medium">Source</th>
                        <th className="pb-2 font-medium">Transaction</th>
                        <th className="pb-2 font-medium">Destination</th>
                        <th className="pb-2 font-medium">Amount</th>
                        <th className="pb-2 font-medium">Classification</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line/40 font-mono">
                      {currentPreset.resultRows.map((row) => (
                        <tr key={row.txId} className="hover:bg-white/[0.02]">
                          <td className="py-2.5 text-accent">{row.source.split("::")[1]}</td>
                          <td className="py-2.5 text-white/90">{row.txId.replace("TX-", "")}</td>
                          <td className="py-2.5 text-dim">{row.dest.split("::")[1]}</td>
                          <td className="py-2.5 font-medium text-white">{row.amount}</td>
                          <td className="py-2.5 text-[10.5px]">
                            <span className="rounded bg-white/6 px-1.5 py-0.5 text-dim">
                              {row.flag}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="mt-5 flex items-center justify-between border-t border-line/60 pt-3 text-[11px] text-dim">
                <span>Read-only, human-authored Cypher</span>
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
