"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";

import type { AlertParams } from "@/lib/alert-filters";
import { api } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-client";

export function useAlerts(params: AlertParams) {
  return useQuery({
    queryKey: queryKeys.alerts(params),
    queryFn: ({ signal }) => api.alerts(params, signal),
    placeholderData: keepPreviousData,
  });
}
