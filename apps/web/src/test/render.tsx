import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import type { ReactElement } from "react";
import { vi } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";

export function renderWithClient(ui: ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <TooltipProvider>{ui}</TooltipProvider>
    </QueryClientProvider>,
  );
}

type Route = (
  url: URL,
  init: RequestInit | undefined,
) => { status?: number; body: unknown } | undefined;

/** Stub fetch with a router; unmatched requests fail loudly. Returns the call log. */
export function stubApi(route: Route) {
  const calls: { method: string; path: string; body: unknown }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string, init?: RequestInit) => {
      const url = new URL(input, "http://localhost");
      // The sign-in token request is not an API call under test: answer it as
      // "sign-in is off" and keep it out of the log.
      if (url.pathname === "/api/auth/token") return new Response("{}", { status: 404 });
      const body = init?.body ? (JSON.parse(String(init.body)) as unknown) : undefined;
      calls.push({ method: init?.method ?? "GET", path: url.pathname + url.search, body });
      const result = route(url, init);
      if (!result) return new Response(JSON.stringify({ detail: "unrouted" }), { status: 599 });
      return new Response(JSON.stringify(result.body), {
        status: result.status ?? 200,
        headers: { "content-type": "application/json" },
      });
    }),
  );
  return calls;
}
