"use client";

import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-client";

/** The signed-in user and their remaining investigations. */
export function useMe() {
  return useQuery({
    queryKey: queryKeys.me,
    queryFn: ({ signal }) => api.me(signal),
    staleTime: 30_000,
    // A 401 sends the visitor to sign in; retrying only delays that.
    retry: false,
  });
}
