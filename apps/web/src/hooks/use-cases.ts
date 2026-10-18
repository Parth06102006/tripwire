"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/api-client";
import type { CaseCreateRequest, CaseItem, CaseReviewRequest, CaseStatus } from "@/lib/api-schemas";
import { queryKeys } from "@/lib/query-client";

const STATUSES: CaseStatus[] = ["suspected", "under_review", "confirmed", "dismissed"];

export type CaseCounts = Record<CaseStatus, number>;

export function useCaseCounts() {
  return useQuery({
    queryKey: queryKeys.caseCounts,
    queryFn: async ({ signal }): Promise<CaseCounts> => {
      const pages = await Promise.all(
        STATUSES.map((status) => api.cases({ status, limit: 1, offset: 0 }, signal)),
      );
      return Object.fromEntries(
        STATUSES.map((status, i) => [status, pages[i]?.total ?? 0]),
      ) as CaseCounts;
    },
  });
}

// GET /api/cases has no transaction filter, so the case for a transaction is
// found by paging. The scan is bounded; `complete` says whether it covered
// every case.
const CASE_PAGE = 100;
const MAX_CASE_PAGES = 10;

export type TransactionCases = {
  /** The suspected, under-review or confirmed case, if one exists. */
  active: CaseItem | null;
  /** Dismissed cases for the same transaction, newest first. */
  dismissed: CaseItem[];
  complete: boolean;
};

export function useTransactionCases(transactionId: string) {
  return useQuery({
    queryKey: queryKeys.caseForTransaction(transactionId),
    queryFn: async ({ signal }): Promise<TransactionCases> => {
      const matches: CaseItem[] = [];
      let complete = false;
      for (let page = 0; page < MAX_CASE_PAGES; page += 1) {
        const result = await api.cases({ limit: CASE_PAGE, offset: page * CASE_PAGE }, signal);
        matches.push(...result.items.filter((item) => item.transaction_id === transactionId));
        if (result.offset + result.items.length >= result.total) {
          complete = true;
          break;
        }
      }
      return {
        active: matches.find((item) => item.status !== "dismissed") ?? null,
        dismissed: matches.filter((item) => item.status === "dismissed"),
        complete,
      };
    },
    staleTime: 0,
  });
}

function useCaseInvalidation() {
  const client = useQueryClient();
  return (item: CaseItem) => {
    client.setQueryData<TransactionCases>(
      queryKeys.caseForTransaction(item.transaction_id),
      (previous) => ({
        active: item.status === "dismissed" ? null : item,
        dismissed:
          item.status === "dismissed"
            ? [item, ...(previous?.dismissed ?? []).filter((c) => c.case_id !== item.case_id)]
            : (previous?.dismissed ?? []),
        complete: previous?.complete ?? false,
      }),
    );
    // Read the persisted state back rather than trusting the local update.
    return client.invalidateQueries({ queryKey: queryKeys.cases });
  };
}

export function useOpenCase() {
  const sync = useCaseInvalidation();
  return useMutation({
    mutationFn: (request: CaseCreateRequest) => api.openCase(request),
    onSuccess: sync,
  });
}

export function useReviewCase() {
  const sync = useCaseInvalidation();
  return useMutation({
    mutationFn: ({ caseId, request }: { caseId: string; request: CaseReviewRequest }) =>
      api.reviewCase(caseId, request),
    onSuccess: sync,
  });
}

export function useRefreshCases() {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: queryKeys.cases });
}
