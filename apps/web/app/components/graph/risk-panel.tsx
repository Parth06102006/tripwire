import Link from "next/link";
import type { Route } from "next";
import type { InvestigationResponse } from "../../lib/api";
import { formatDurationMs, formatScore } from "../../lib/format";
import { StatusBadge, DecisionBadge } from "../ui/badge";
import { Card, CardHeader, Metadata } from "../ui/card";
import { Disclosure } from "../ui/motion";
import OpenCaseButton from "../cases/open-case-button";

const OUTCOME_TEXT: Record<string, string> = {
  evidence_found: "Evidence found within the query bounds.",
  no_matching_path: "Queries ran and found no matching path within bounds. This does not mean the transaction is safe.",
  unknown_anchor: "The anchor transaction was not found in the graph.",
  inconclusive: "The graph result was inconclusive.",
};

export default function RiskPanel({ result }: { result: InvestigationResponse }) {
  const report = result.report;
  const action = result.action;
  return (
    <Card aria-label="Risk and policy summary" className="flex flex-col gap-4">
      <CardHeader title="Risk and policy" />

      <dl className="grid grid-cols-2 gap-3">
        <div>
          <dt className="text-xs text-dim">Risk estimate</dt>
          <dd className="mt-0.5 font-mono text-xl font-semibold text-ink tabular-nums">
            {formatScore(result.risk_score)}
          </dd>
          <dd className="text-[11px] text-dim">Model score, not a fraud finding</dd>
        </div>
        <div>
          <dt className="text-xs text-dim">Policy decision</dt>
          <dd className="mt-1">
            <DecisionBadge decision={result.decision} />
          </dd>
          <dd className="mt-1 text-[11px] text-dim">Deterministic, policy {result.policy_version}</dd>
        </div>
      </dl>

      {result.outcome ? (
        <div>
          <p className="text-xs text-dim">Observed facts (graph result)</p>
          <p className="mt-0.5 text-xs leading-5 text-ink">{OUTCOME_TEXT[result.outcome]}</p>
          <p className="mt-0.5 text-[11px] text-dim">
            Evidence phase {formatDurationMs(result.evidence.query_duration_ms)} wall time.
          </p>
        </div>
      ) : null}

      {report ? (
        <div>
          <div className="flex items-center gap-2">
            <p className="text-xs text-dim">Explanation</p>
            <StatusBadge tone="neutral" icon="none">
              {report.source === "llm" ? "LLM narrative, verified" : "Deterministic narrative"}
            </StatusBadge>
          </div>
          <p className="mt-1 text-sm leading-6 text-ink">{report.hypothesis}</p>
          <p className="mt-1 text-[11px] text-dim">
            Recommendation: {report.recommendation} (fixed by code). Citations were checked against
            retrieved evidence.
          </p>
          {report.counterevidence_ids.length > 0 ? (
            <p className="mt-1 text-[11px] text-dim">
              Counterevidence: <span className="font-mono">{report.counterevidence_ids.join(", ")}</span>
            </p>
          ) : null}
        </div>
      ) : (
        <p className="text-xs text-dim">No report was produced for this response.</p>
      )}

      {action ? (
        <div className="rounded-control border border-line p-3">
          <p className="text-xs text-dim">Case action (gate decision)</p>
          <p className="mt-1 text-xs text-ink">
            {action.status === "executed" ? "Executed" : action.status === "denied" ? "Denied" : "No action"}
            {": "}
            {action.reason}
          </p>
          {action.case_id ? (
            <Link
              href={`/cases?case=${encodeURIComponent(action.case_id)}` as Route}
              className="mt-1 inline-block text-xs text-accent hover:underline"
            >
              View case {action.case_id}
            </Link>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <OpenCaseButton transactionId={result.transaction_id} />
        <p className="text-[11px] text-dim">Confirmation of fraud happens only in Cases.</p>
      </div>

      <Disclosure title="Technical details">
        <dl className="grid grid-cols-2 gap-2">
          <Metadata label="Investigation">{result.investigation_id}</Metadata>
          <Metadata label="Created">{result.created_at}</Metadata>
          {report?.llm ? (
            <>
              <Metadata label="LLM">{report.llm.provider} / {report.llm.model}</Metadata>
              <Metadata label="LLM status">
                {report.llm.status}
                {report.llm.fallback_reason ? ` (${report.llm.fallback_reason})` : ""}
              </Metadata>
              <Metadata label="Rounds / tool calls">{report.llm.rounds} / {report.llm.tool_calls}</Metadata>
              <Metadata label="Tokens in / out">
                {report.llm.input_tokens ?? "—"} / {report.llm.output_tokens ?? "—"}
              </Metadata>
            </>
          ) : null}
        </dl>
        {result.tool_trace && result.tool_trace.length > 0 ? (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[420px] text-left text-[11px]">
              <caption className="pb-1 text-left text-dim">Tool trace</caption>
              <thead>
                <tr className="text-dim">
                  <th scope="col" className="pr-2 font-medium">Tool</th>
                  <th scope="col" className="pr-2 font-medium">Origin</th>
                  <th scope="col" className="pr-2 font-medium">Outcome</th>
                  <th scope="col" className="pr-2 font-medium">Results</th>
                  <th scope="col" className="font-medium">Time</th>
                </tr>
              </thead>
              <tbody className="font-mono">
                {result.tool_trace.map((entry) => (
                  <tr key={entry.tool_run_id} className="border-t border-line">
                    <td className="py-1 pr-2">{entry.tool}</td>
                    <td className="pr-2">{entry.origin}/{entry.transport}</td>
                    <td className="pr-2">{entry.status === "error" ? "error" : entry.outcome}</td>
                    <td className="pr-2">{entry.result_count}{entry.truncated ? "+" : ""}</td>
                    <td>{formatDurationMs(entry.duration_ms)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </Disclosure>
    </Card>
  );
}
