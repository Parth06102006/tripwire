/**
 * Typed client for the TraceAML API.
 *
 * All payloads mirror docs/contracts.md via the backend Pydantic schemas.
 * Responses are validated structurally before use; nothing is invented when
 * the API is unreachable — callers render explicit loading/error states.
 */

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

export class ApiError extends Error {
  readonly status: number;
  readonly detail: string;

  constructor(status: number, detail: string) {
    super(`API request failed (${status}): ${detail}`);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
}

export type Decision = "allow" | "review";

export interface AlertItem {
  transaction_id: string;
  timestamp: string;
  score: number;
  decision: Decision;
}

export interface AlertsResponse {
  items: AlertItem[];
  total: number;
  limit: number;
  offset: number;
}

export interface SplitMetrics {
  rows: number;
  prevalence: number;
  alerts: number;
  precision: number;
  recall: number;
}

export interface ThresholdMetrics {
  precision: number;
  recall: number;
  f1: number;
  true_positives: number;
  false_positives: number;
}

export interface BudgetMetrics {
  budget: number;
  alerts: number;
  true_positives: number;
  precision: number;
  recall: number;
}

export interface ModelBenchmark {
  average_precision: Record<string, number>;
  val_threshold_max_f1: number;
  test_at_val_threshold: ThresholdMetrics;
  test_at_alert_budget: BudgetMetrics;
  splits: Record<string, SplitMetrics>;
}

export interface BenchmarksResponse {
  models: Record<string, ModelBenchmark>;
  performance?: PerformanceSummary | null;
}

export interface LatencyStats {
  samples: number;
  p50_ms: number;
  p95_ms: number;
  mean_ms: number;
}

export interface SerialLatencyStats extends LatencyStats {
  serial_requests_per_second: number;
}

export interface PerformanceSummary {
  measured_on: string;
  dataset_label: string;
  hardware: string;
  graph_scope: string;
  execution_mode: string;
  model_inference: {
    single_prepared_row: LatencyStats;
    full_test_cohort: {
      rows: number;
      repeats: number;
      median_seconds: number;
      transactions_per_second: number;
      threads: number;
      max_abs_error_vs_saved_scores: number;
    };
  };
  api: {
    alerts_limit_50: SerialLatencyStats;
    benchmarks: SerialLatencyStats;
    investigation: SerialLatencyStats & {
      graph_query_sum: LatencyStats;
      evidence_transactions: number;
      evidence_accounts: number;
      evidence_paths: number;
      all_reports_validated: boolean;
    };
  };
  graph_queries: {
    trace_funds: LatencyStats;
    inspect_counterparties: LatencyStats;
    fan_out: LatencyStats & { matches_min: number; matches_max: number };
    fan_in: LatencyStats & { matches_min: number; matches_max: number };
    pass_through: LatencyStats & { matches_min: number; matches_max: number };
  };
  run_id?: string | null;
  git_commit?: string | null;
  cost: {
    external_llm_calls: number;
    external_llm_cost: string;
    local_compute_cost: string;
    cost_per_1000_decisions: string;
    dollar_weighted_recall: string;
  };
}

export interface HealthResponse {
  status: "ok";
  falkordb: "available" | "unavailable" | "not_configured";
  version: string;
  llm?: "configured" | "not_configured";
}

export interface InvestigationRequest {
  transaction_id: string;
  max_hops: number;
  time_window_seconds: number;
  result_limit: number;
  use_llm?: boolean;
  act?: boolean;
}

export interface TransactionEvidence {
  transaction_id: string;
  timestamp: string;
  source_account_key: string;
  destination_account_key: string;
  amount_paid: number | null;
  payment_currency: string | null;
  amount_received: number | null;
  receiving_currency: string | null;
  payment_format: string | null;
}

export interface AccountEvidence {
  account_key: string;
}

export interface GraphPath {
  anchor_transaction_id: string;
  direction: string;
  depth: number;
  account_keys: string[];
  transaction_ids: string[];
}

export interface InvestigationEvidence {
  transactions: TransactionEvidence[];
  accounts: AccountEvidence[];
  paths: GraphPath[];
  query_duration_ms: number;
  tool_durations_ms?: { tool: string; query_duration_ms: number }[];
}

export type InvestigationOutcome =
  | "evidence_found"
  | "no_matching_path"
  | "unknown_anchor"
  | "inconclusive";

export interface ToolTraceEntry {
  tool_run_id: string;
  tool: "trace_funds" | "inspect_counterparties" | "detect_flow_patterns";
  transport: "direct" | "mcp";
  origin: "policy" | "model";
  arguments: Record<string, string | number | boolean>;
  outcome: InvestigationOutcome | "invalid_input";
  status: "ok" | "error";
  duration_ms: number;
  result_count: number;
  path_count: number;
  truncated: boolean;
}

export interface CaseActionResult {
  proposed_action: "none" | "open_case" | "enrich_case";
  proposed_by: "agent" | "policy";
  reason: string;
  status: "executed" | "denied" | "no_action";
  denial_code: string | null;
  case_id: string | null;
  evidence_refs: string[];
  tool_run_ids: string[];
}

export interface LlmRunInfo {
  provider: string;
  model: string;
  status: "completed" | "fallback" | "unavailable";
  fallback_reason: string | null;
  rounds: number;
  tool_calls: number;
  input_tokens: number | null;
  output_tokens: number | null;
  duration_ms: number;
  estimated_cost_usd: number | null;
}

export interface InvestigationReport {
  hypothesis: string;
  supporting_transaction_ids: string[];
  counterevidence_ids: string[];
  recommendation: "review";
  validation: "validated";
  source?: "deterministic" | "llm";
  llm?: LlmRunInfo | null;
  proposed_action?: "none" | "open_case" | "enrich_case";
  action_reason?: string | null;
}

export interface InvestigationResponse {
  investigation_id: string;
  transaction_id: string;
  risk_score: number;
  decision: Decision;
  policy_version: string;
  evidence: InvestigationEvidence;
  report: InvestigationReport | null;
  created_at: string;
  outcome?: InvestigationOutcome;
  tool_trace?: ToolTraceEntry[];
  action?: CaseActionResult | null;
}

export type CaseStatus = "suspected" | "under_review" | "confirmed" | "dismissed";

export interface CaseHistoryEntry {
  review_id: string;
  action: "open" | "enrich" | "confirm" | "dismiss";
  reviewer_id: string;
  pattern_type: string | null;
  notes: string | null;
  timestamp: string;
}

export interface CaseEvidenceEntry {
  evidence_id: string;
  review_id: string;
  action: "open_case" | "enrich_case";
  proposed_by: "agent" | "policy";
  investigation_id: string;
  reason: string;
  evidence_refs: string[];
  tool_run_ids: string[];
  tool_trace: ToolTraceEntry[];
  risk_score: number;
  decision: Decision;
  policy_version: string;
  timestamp: string;
}

export interface CaseItem {
  case_id: string;
  transaction_id: string;
  status: CaseStatus;
  risk_score: number;
  opened_by: string;
  created_at: string;
  updated_at: string;
  history: CaseHistoryEntry[];
  evidence: CaseEvidenceEntry[];
}

export interface CaseListResponse {
  items: CaseItem[];
  total: number;
  limit: number;
  offset: number;
}

export interface CaseReviewRequest {
  action: "confirm" | "dismiss";
  reviewer_id: string;
  pattern_type?: string | null;
  notes?: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function errorDetail(status: number, body: unknown): string {
  if (isRecord(body) && typeof body.detail === "string" && body.detail.length > 0) {
    return body.detail;
  }
  if (status === 404) return "Not found.";
  if (status === 503) return "A required service is unavailable.";
  return `Unexpected response (HTTP ${status}).`;
}

export async function fetchJson<T>(
  path: string,
  init?: RequestInit,
  validate?: (body: unknown) => body is T,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      headers: { "Content-Type": "application/json" },
      ...init,
    });
  } catch {
    throw new ApiError(0, "The API is unreachable. Start the backend and retry.");
  }
  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  if (!response.ok) {
    throw new ApiError(response.status, errorDetail(response.status, body));
  }
  if (validate && !validate(body)) {
    throw new ApiError(response.status, "The API returned an unexpected shape.");
  }
  return body as T;
}

export function isAlertsResponse(body: unknown): body is AlertsResponse {
  return (
    isRecord(body) &&
    Array.isArray(body.items) &&
    typeof body.total === "number" &&
    typeof body.limit === "number" &&
    typeof body.offset === "number"
  );
}

export function isBenchmarksResponse(body: unknown): body is BenchmarksResponse {
  if (!isRecord(body) || !isRecord(body.models)) return false;
  if (body.performance === undefined || body.performance === null) return true;
  if (!isRecord(body.performance)) return false;
  return (
    typeof body.performance.measured_on === "string" &&
    isRecord(body.performance.model_inference) &&
    isRecord(body.performance.api) &&
    isRecord(body.performance.graph_queries) &&
    isRecord(body.performance.cost)
  );
}

export function isHealthResponse(body: unknown): body is HealthResponse {
  return (
    isRecord(body) &&
    body.status === "ok" &&
    (body.falkordb === "available" ||
      body.falkordb === "unavailable" ||
      body.falkordb === "not_configured") &&
    typeof body.version === "string"
  );
}

export function isInvestigationResponse(body: unknown): body is InvestigationResponse {
  return (
    isRecord(body) &&
    typeof body.transaction_id === "string" &&
    typeof body.risk_score === "number" &&
    isRecord(body.evidence)
  );
}

export const alertsQuery = (limit: number, offset: number) => ({
  queryKey: ["alerts", limit, offset] as const,
  queryFn: () =>
    fetchJson<AlertsResponse>(
      `/api/alerts?limit=${limit}&offset=${offset}`,
      undefined,
      isAlertsResponse,
    ),
});

export const benchmarksQuery = {
  queryKey: ["benchmarks"] as const,
  queryFn: () =>
    fetchJson<BenchmarksResponse>("/api/benchmarks", undefined, isBenchmarksResponse),
};

export const healthQuery = {
  queryKey: ["health"] as const,
  queryFn: () => fetchJson<HealthResponse>("/api/health", undefined, isHealthResponse),
};

export async function postInvestigation(
  request: InvestigationRequest,
): Promise<InvestigationResponse> {
  return fetchJson<InvestigationResponse>(
    "/api/investigations",
    { method: "POST", body: JSON.stringify(request) },
    isInvestigationResponse,
  );
}

export function isCaseItem(body: unknown): body is CaseItem {
  return (
    isRecord(body) &&
    typeof body.case_id === "string" &&
    typeof body.transaction_id === "string" &&
    typeof body.status === "string" &&
    Array.isArray(body.history)
  );
}

export function isCaseListResponse(body: unknown): body is CaseListResponse {
  return (
    isRecord(body) &&
    Array.isArray(body.items) &&
    typeof body.total === "number" &&
    typeof body.limit === "number" &&
    typeof body.offset === "number"
  );
}

export const casesQuery = (status: CaseStatus | null, limit: number, offset = 0) => ({
  queryKey: ["cases", status, limit, offset] as const,
  queryFn: () => {
    const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    if (status) params.set("status", status);
    return fetchJson<CaseListResponse>(
      `/api/cases?${params.toString()}`,
      undefined,
      isCaseListResponse,
    );
  },
});

export const caseQuery = (caseId: string) => ({
  queryKey: ["case", caseId] as const,
  queryFn: () =>
    fetchJson<CaseItem>(`/api/cases/${encodeURIComponent(caseId)}`, undefined, isCaseItem),
});

export function postCase(request: {
  transaction_id: string;
  opened_by: string;
  notes?: string | null;
}): Promise<CaseItem> {
  return fetchJson<CaseItem>(
    "/api/cases",
    { method: "POST", body: JSON.stringify(request) },
    isCaseItem,
  );
}

export function postCaseReview(caseId: string, request: CaseReviewRequest): Promise<CaseItem> {
  return fetchJson<CaseItem>(
    `/api/cases/${encodeURIComponent(caseId)}/review`,
    { method: "POST", body: JSON.stringify(request) },
    isCaseItem,
  );
}

export interface ReviewQueueSummary {
  total: number;
  reviewCount: number;
}

/**
 * Exact count of review-decision alerts without a dedicated endpoint.
 * The queue is ranked by score and the decision is a score threshold, so
 * review rows form a prefix; binary-search the boundary with single-row reads.
 */
export async function fetchReviewQueueSummary(): Promise<ReviewQueueSummary> {
  const read = (offset: number) =>
    fetchJson<AlertsResponse>(`/api/alerts?limit=1&offset=${offset}`, undefined, isAlertsResponse);
  const first = await read(0);
  if (first.total === 0 || first.items[0]?.decision !== "review") {
    return { total: first.total, reviewCount: 0 };
  }
  let low = 0;
  let high = first.total;
  while (high - low > 1) {
    const mid = Math.floor((low + high) / 2);
    const page = await read(mid);
    if (page.items[0]?.decision === "review") low = mid;
    else high = mid;
  }
  return { total: first.total, reviewCount: high };
}
