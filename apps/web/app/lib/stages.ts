import {
  ApiError,
  type InvestigationRequest,
  type InvestigationResponse,
} from "./api";
import { formatDurationMs, formatScore } from "./format";

export type StageState = "pending" | "running" | "completed" | "failed" | "skipped" | "unavailable";

export interface Stage {
  id: string;
  label: string;
  state: StageState;
  detail: string;
}

export const STAGE_LABELS = [
  ["alert", "Alert"],
  ["context", "Context"],
  ["tool_selection", "Tool selection"],
  ["graph_query", "Graph query"],
  ["evidence", "Evidence"],
  ["verification", "Verification"],
  ["policy_gate", "Policy gate"],
  ["outcome", "Outcome"],
] as const;

export type RunPhase =
  | { phase: "idle" }
  | { phase: "loading" }
  | { phase: "error"; error: unknown }
  | { phase: "success"; result: InvestigationResponse; request: InvestigationRequest };

export const STAGE_NOTE: Record<RunPhase["phase"], string> = {
  idle: "No investigation has run. Stages stay pending until one does.",
  loading:
    "The API reports stage detail only with the finished response, so stages stay pending while the request runs.",
  error: "The request failed; stages after the failure were not reached.",
  success:
    "Stage states are derived from the response fields (tool trace, outcome, report, decision, action). The API does not stream per-stage progress.",
};

function build(states: Record<string, [StageState, string]>): Stage[] {
  return STAGE_LABELS.map(([id, label]) => {
    const [state, detail] = states[id] ?? ["pending", "Not started."];
    return { id, label, state, detail };
  });
}

export function deriveStages(run: RunPhase): Stage[] {
  if (run.phase === "idle" || run.phase === "loading") {
    return build({});
  }

  if (run.phase === "error") {
    const detail =
      run.error instanceof ApiError
        ? run.error.detail
        : "Unexpected client error.";
    const states: Record<string, [StageState, string]> = {
      alert: ["failed", detail],
    };
    for (const [id] of STAGE_LABELS.slice(1)) {
      states[id] = ["skipped", "Not reached."];
    }
    return build(states);
  }

  const { result, request } = run;
  const trace = result.tool_trace ?? [];
  const toolErrors = trace.filter((entry) => entry.status === "error").length;
  const outcome = result.outcome;
  const report = result.report;
  const action = result.action;

  const policyCalls = trace.filter((entry) => entry.origin === "policy").length;
  const modelCalls = trace.length - policyCalls;
  const states: Record<string, [StageState, string]> = {
    alert: ["completed", `Scored ${formatScore(result.risk_score)}.`],
    context: [
      "completed",
      `Up to ${request.max_hops} hops, ${request.time_window_seconds} s window, ${request.result_limit} results.`,
    ],
    tool_selection:
      trace.length > 0
        ? ["completed", `${trace.length} tool call${trace.length === 1 ? "" : "s"}: ${policyCalls} policy, ${modelCalls} model.`]
        : ["unavailable", "This response carries no tool trace."],
    graph_query:
      outcome === "unknown_anchor"
        ? ["failed", "Anchor transaction not found in the graph."]
        : toolErrors > 0
          ? ["failed", `${toolErrors} tool call${toolErrors === 1 ? "" : "s"} errored.`]
          : ["completed", `Evidence phase took ${formatDurationMs(result.evidence.query_duration_ms)}.`],
    evidence:
      outcome === "evidence_found" || (outcome === undefined && result.evidence.transactions.length > 0)
        ? [
            "completed",
            `${result.evidence.transactions.length} transfers, ${result.evidence.accounts.length} accounts, ${result.evidence.paths.length} paths.`,
          ]
        : outcome === "no_matching_path"
          ? ["completed", "Query ran; no matching path in bounds. This is not proof of safety."]
          : outcome === "inconclusive"
            ? ["failed", "Result inconclusive."]
            : outcome === "unknown_anchor"
              ? ["skipped", "No anchor, no evidence."]
              : ["completed", "No transfers returned within the bounds."],
    verification: report
      ? [
          "completed",
          report.llm?.status === "fallback"
            ? `LLM fell back (${report.llm.fallback_reason ?? "unspecified"}); deterministic report validated against evidence.`
            : `${report.source === "llm" ? "LLM" : "Deterministic"} report validated against retrieved evidence.`,
        ]
      : ["skipped", "No report was produced."],
    policy_gate: [
      "completed",
      `Policy ${result.policy_version} decided ${result.decision}.`,
    ],
    outcome: action
      ? action.status === "executed"
        ? ["completed", `Case action ${action.proposed_action} executed${action.case_id ? ` on ${action.case_id}` : ""}.`]
        : action.status === "denied"
          ? ["completed", `Case action denied${action.denial_code ? ` (${action.denial_code})` : ""}.`]
          : ["completed", "Gate reviewed the proposal; no action taken."]
      : ["completed", `Decision ${result.decision}. No case action was requested.`],
  };
  return build(states);
}
