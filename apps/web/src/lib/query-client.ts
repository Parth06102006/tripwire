import { QueryClient } from "@tanstack/react-query";

import type { AlertParams } from "@/lib/alert-filters";
import { isApiError } from "@/lib/api-client";

/** Retry reads only when a retry can help: network failures and 503s. */
function shouldRetry(failureCount: number, error: unknown): boolean {
  if (failureCount >= 2) return false;
  if (!isApiError(error)) return false;
  return error.kind === "network" || error.status === 503;
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: shouldRetry,
        refetchOnWindowFocus: false,
      },
      mutations: { retry: false },
    },
  });
}

export const queryKeys = {
  health: ["health"] as const,
  alerts: (params: AlertParams) => ["alerts", params] as const,
  benchmarks: ["benchmarks"] as const,
  cases: ["cases"] as const,
  caseCounts: ["cases", "counts"] as const,
  caseForTransaction: (transactionId: string) => ["cases", "transaction", transactionId] as const,
};
