/**
 * Typed client for the Tripwire API. Every response is parsed with its Zod
 * schema at this boundary; components receive validated data or an ApiError.
 * Requests go to same-origin /api, which Next.js rewrites to the API service.
 */
import type { z } from "zod";

import type { AlertParams } from "@/lib/alert-filters";
import { authorizedFetch } from "@/lib/auth/fetch";
import {
  alertsResponseSchema,
  benchmarksResponseSchema,
  caseItemSchema,
  caseListResponseSchema,
  healthSchema,
  investigationResponseSchema,
  meSchema,
  type CaseCreateRequest,
  type CaseReviewRequest,
  type CaseStatus,
  type InvestigationRequest,
} from "@/lib/api-schemas";

export type RateLimit = { window: "hour" | "day"; limit: number; retryAfterSeconds: number };

export type ApiErrorKind = "http" | "network" | "invalid_response" | "aborted";

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status: number | null;
  /** The API's fixed `detail` string, when the API sent one. */
  readonly detail: string | null;
  /** Set on a 429: which allowance ran out and when a slot comes back. */
  readonly rateLimit: RateLimit | null;

  constructor(
    kind: ApiErrorKind,
    message: string,
    status: number | null,
    detail: string | null,
    rateLimit: RateLimit | null = null,
  ) {
    super(message);
    this.rateLimit = rateLimit;
    this.name = "ApiError";
    this.kind = kind;
    this.status = status;
    this.detail = detail;
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

type RequestOptions = {
  method?: "GET" | "POST";
  body?: unknown;
  signal?: AbortSignal;
};

const API_BASE = "/api";

function parseRateLimit(payload: object): RateLimit | null {
  const { window, limit, retry_after_seconds: retry } = payload as Record<string, unknown>;
  if (
    (window === "hour" || window === "day") &&
    typeof limit === "number" &&
    typeof retry === "number"
  ) {
    return { window, limit, retryAfterSeconds: retry };
  }
  return null;
}

/** The API's error body: its fixed detail string, and the allowance advice on a 429. */
export async function readErrorBody(
  response: Response,
): Promise<{ detail: string | null; rateLimit: RateLimit | null }> {
  try {
    const payload: unknown = await response.json();
    if (payload && typeof payload === "object" && "detail" in payload) {
      const { detail } = payload as { detail: unknown };
      const rateLimit = response.status === 429 ? parseRateLimit(payload) : null;
      if (typeof detail === "string") return { detail, rateLimit };
      // FastAPI 422 bodies carry a list of field errors.
      if (Array.isArray(detail)) return { detail: "request failed validation", rateLimit: null };
    }
  } catch {
    // Non-JSON error bodies (for example a proxy error page) carry no detail.
  }
  return { detail: null, rateLimit: null };
}

export async function apiRequest<S extends z.ZodType>(
  path: string,
  schema: S,
  { method = "GET", body, signal }: RequestOptions = {},
): Promise<z.output<S>> {
  let response: Response;
  try {
    response = await authorizedFetch(`${API_BASE}${path}`, {
      method,
      signal,
      headers: body === undefined ? undefined : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
    });
  } catch (error) {
    if (signal?.aborted) throw new ApiError("aborted", "request cancelled", null, null);
    throw new ApiError(
      "network",
      error instanceof Error ? error.message : "network request failed",
      null,
      null,
    );
  }

  if (!response.ok) {
    const { detail, rateLimit } = await readErrorBody(response);
    throw new ApiError(
      "http",
      detail ?? `HTTP ${response.status}`,
      response.status,
      detail,
      rateLimit,
    );
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new ApiError("invalid_response", "response was not JSON", response.status, null);
  }
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    throw new ApiError(
      "invalid_response",
      `response did not match the ${path} contract`,
      response.status,
      null,
    );
  }
  return parsed.data;
}

function query(params: Record<string, string | number | readonly string[] | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;
    if (typeof value === "object") {
      for (const item of value) search.append(key, item);
    } else {
      search.set(key, String(value));
    }
  }
  const text = search.toString();
  return text ? `?${text}` : "";
}

export const api = {
  me: (signal?: AbortSignal) => apiRequest("/me", meSchema, { signal }),

  health: (signal?: AbortSignal) => apiRequest("/health", healthSchema, { signal }),

  alerts: (params: AlertParams, signal?: AbortSignal) =>
    apiRequest(
      `/alerts${query({
        limit: params.limit,
        offset: params.offset,
        route: params.routes && params.routes.length > 0 ? params.routes : undefined,
        min_score: params.minScore,
        max_score: params.maxScore,
        date_from: params.dateFrom,
        date_to: params.dateTo,
        q: params.text,
      })}`,
      alertsResponseSchema,
      { signal },
    ),

  benchmarks: (signal?: AbortSignal) =>
    apiRequest("/benchmarks", benchmarksResponseSchema, { signal }),

  investigate: (request: InvestigationRequest, signal?: AbortSignal) =>
    apiRequest("/investigations", investigationResponseSchema, {
      method: "POST",
      body: request,
      signal,
    }),

  cases: (params: { status?: CaseStatus; limit: number; offset: number }, signal?: AbortSignal) =>
    apiRequest(`/cases${query(params)}`, caseListResponseSchema, { signal }),

  case: (caseId: string, signal?: AbortSignal) =>
    apiRequest(`/cases/${encodeURIComponent(caseId)}`, caseItemSchema, { signal }),

  openCase: (request: CaseCreateRequest) =>
    apiRequest("/cases", caseItemSchema, { method: "POST", body: request }),

  reviewCase: (caseId: string, request: CaseReviewRequest) =>
    apiRequest(`/cases/${encodeURIComponent(caseId)}/review`, caseItemSchema, {
      method: "POST",
      body: request,
    }),
};

/** One sentence an analyst can act on, for any error thrown by the client. */
export function describeApiError(error: unknown): string {
  if (!isApiError(error)) return "The request failed for an unexpected reason.";
  switch (error.kind) {
    case "network":
      return "The API could not be reached. Check that the Tripwire API is running.";
    case "aborted":
      return "The request was cancelled.";
    case "invalid_response":
      return "The API returned data that does not match the agreed contract, so it was not shown.";
    case "http":
      return describeHttpError(error.status, error.detail, error.rateLimit);
  }
}

/** "23 minutes", "1 hour 5 minutes": a wait a person can act on. */
export function formatWait(seconds: number): string {
  const total = Math.max(1, Math.ceil(seconds / 60));
  if (total < 60) return `${total} minute${total === 1 ? "" : "s"}`;
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  const hourText = `${hours} hour${hours === 1 ? "" : "s"}`;
  return minutes === 0 ? hourText : `${hourText} ${minutes} minute${minutes === 1 ? "" : "s"}`;
}

function describeHttpError(
  status: number | null,
  detail: string | null,
  rateLimit: RateLimit | null,
): string {
  if (status === 429) {
    if (!rateLimit) return "The investigation limit was reached. Try again later.";
    const per = rateLimit.window === "hour" ? "hour" : "day";
    return `You have used all ${rateLimit.limit} investigations allowed per ${per}. You can start another in ${formatWait(rateLimit.retryAfterSeconds)}.`;
  }
  if (status === 401) return "Your session has ended. Sign in again to continue.";
  if (status === 403) return "Your account does not have access to this.";
  switch (detail) {
    case "transaction not scored":
      return "This transaction is not in the scored replay cohort.";
    case "transaction not found in graph":
      return "This transaction is scored but is not in the loaded graph. Load a graph that contains it, or pick another alert.";
    case "graph unavailable":
      return "FalkorDB is unavailable, so no graph evidence could be retrieved.";
    case "graph query timed out":
      return "A graph query exceeded the server timeout. Try fewer hops, a shorter window, or a lower result limit.";
    case "score artifact unavailable":
      return "The score artifact is missing on the API host.";
    case "decision threshold unavailable":
      return "The decision threshold artifact is missing on the API host.";
    case "evidence validation failed":
      return "The report cited records the queries did not return, so it was rejected.";
    case "case store unavailable":
      return "The case store is unavailable.";
    case "case not found":
      return "That case does not exist.";
    case "transaction already has an active case":
      return "This transaction already has an open or confirmed case.";
    case "case already reviewed":
      return "This case already has a final decision, which cannot be changed.";
  }
  if (status === 409) return detail ?? "The case is not in a state that allows this action.";
  if (status === 422) return "The API rejected the request parameters.";
  if (status === 404) return detail ?? "Not found.";
  if (status !== null && status >= 500 && status !== 503)
    return `The API failed with ${status}${detail ? `: ${detail}` : ""}.`;
  return detail ?? `The API responded with ${status ?? "an error"}.`;
}
