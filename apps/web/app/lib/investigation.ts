"use client";

import { useQuery } from "@tanstack/react-query";
import {
  ApiError,
  postInvestigation,
  type InvestigationRequest,
  type InvestigationResponse,
} from "./api";
import { recordRun } from "./run-log";

export const DEFAULT_REQUEST: { max_hops: number; time_window_seconds: number; result_limit: number } = {
  max_hops: 2,
  time_window_seconds: 86400,
  result_limit: 50,
};

/** Default bounded, deterministic, read-only request. Shared so caches line up. */
export function baseRequest(transactionId: string): InvestigationRequest {
  return { transaction_id: transactionId, ...DEFAULT_REQUEST, use_llm: false, act: false };
}

async function runAndLog(request: InvestigationRequest): Promise<InvestigationResponse> {
  const started = performance.now();
  const base = {
    id: crypto.randomUUID(),
    at: new Date().toISOString(),
    transactionId: request.transaction_id,
    useLlm: request.use_llm === true,
  };
  try {
    const response = await postInvestigation(request);
    recordRun({
      ...base,
      status: "completed",
      durationMs: performance.now() - started,
      investigationId: response.investigation_id,
      decision: response.decision,
      outcome: response.outcome,
      llmStatus: response.report?.llm?.status,
      llmFallbackReason: response.report?.llm?.fallback_reason,
      toolTrace: response.tool_trace,
    });
    return response;
  } catch (error) {
    recordRun({
      ...base,
      status: "failed",
      durationMs: performance.now() - started,
      httpStatus: error instanceof ApiError ? error.status : undefined,
      error: error instanceof ApiError ? error.detail : "Unexpected client error.",
    });
    throw error;
  }
}

/**
 * One investigation per (request, nonce). Results are cached so a graph
 * preview and the full workspace reuse the same response. Bump `nonce` to rerun.
 * The request is a computation, not a mutation, unless `act` is set; `act`
 * requests are never refetched automatically.
 */
export function useInvestigation(request: InvestigationRequest | null, nonce = 0) {
  return useQuery({
    queryKey: ["investigation", request, nonce] as const,
    queryFn: () => runAndLog(request as InvestigationRequest),
    enabled: request !== null,
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: 30 * 60_000,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
  });
}

export function investigationErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 404) return `Not found: ${error.detail}`;
    if (error.status === 503) return `A required service is unavailable. ${error.detail}`;
    return error.detail;
  }
  return "Something went wrong while running the investigation.";
}
