"use client";

import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-client";

export function useBenchmarks() {
  return useQuery({
    queryKey: queryKeys.benchmarks,
    queryFn: ({ signal }) => api.benchmarks(signal),
    staleTime: 5 * 60_000,
  });
}
