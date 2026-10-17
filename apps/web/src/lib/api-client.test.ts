import { afterEach, describe, expect, it, vi } from "vitest";

import { investigation } from "@/test/fixtures";

import { api, ApiError, describeApiError } from "./api-client";

function respond(status: number, body: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(JSON.stringify(body), {
          status,
          headers: { "content-type": "application/json" },
        }),
    ),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("api client", () => {
  it("returns validated data and strips fields outside the contract", async () => {
    respond(200, { ...investigation(), target_is_laundering: true });
    const result = await api.investigate({
      transaction_id: "tx-a",
      max_hops: 2,
      time_window_seconds: 86_400,
      result_limit: 50,
      use_llm: false,
      act: false,
    });
    expect(result.outcome).toBe("evidence_found");
    expect(result).not.toHaveProperty("target_is_laundering");
  });

  it("rejects a response that breaks the contract", async () => {
    respond(200, { status: "ok", falkordb: "sideways", version: "1" });
    await expect(api.health()).rejects.toMatchObject({ kind: "invalid_response" });
  });

  it("carries the API's fixed detail string on HTTP errors", async () => {
    respond(404, { detail: "transaction not found in graph" });
    const error = await api.case("missing").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      kind: "http",
      status: 404,
      detail: "transaction not found in graph",
    });
    expect(describeApiError(error)).toMatch(/not in the loaded graph/);
  });

  it("reports an unreachable API as a network error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Promise.reject(new TypeError("fetch failed"))),
    );
    const error = await api.health().catch((e: unknown) => e);
    expect(error).toMatchObject({ kind: "network" });
    expect(describeApiError(error)).toMatch(/could not be reached/);
  });
});
