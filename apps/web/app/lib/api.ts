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
}

export interface InvestigationRequest {
  transaction_id: string;
  max_hops: number;
  time_window_seconds: number;
  result_limit: number;
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
}

export interface InvestigationReport {
  hypothesis: string;
  supporting_transaction_ids: string[];
  counterevidence_ids: string[];
  recommendation: "review";
  validation: "validated";
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
  return isRecord(body) && isRecord(body.models);
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

export async function postInvestigation(
  request: InvestigationRequest,
): Promise<InvestigationResponse> {
  return fetchJson<InvestigationResponse>(
    "/api/investigations",
    { method: "POST", body: JSON.stringify(request) },
    isInvestigationResponse,
  );
}
