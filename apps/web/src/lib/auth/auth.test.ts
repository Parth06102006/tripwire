import { afterEach, describe, expect, it, vi } from "vitest";

import { describeApiError, ApiError, formatWait } from "@/lib/api-client";

import { AuthConfigError, isEmailAllowed, parseAllowList, readAuthConfig } from "./config";
import { safeNext } from "./next";
import { clearApiToken, getApiToken } from "./token";

describe("access list", () => {
  const list = parseAllowList("Ana@Example.com, @corp.example ;  bob@other.org");

  it("parses addresses and domains, ignoring case and separators", () => {
    expect(list).toEqual(["ana@example.com", "@corp.example", "bob@other.org"]);
  });

  it("allows a listed address in any case", () => {
    expect(isEmailAllowed("ANA@example.com", list)).toBe(true);
  });

  it("allows anyone at a listed domain", () => {
    expect(isEmailAllowed("someone@corp.example", list)).toBe(true);
  });

  it.each([
    ["an address that is not listed", "eve@example.com"],
    ["a look-alike domain", "x@notcorp.example"],
    ["a subdomain of a listed domain", "x@sub.corp.example"],
    ["a domain used as a local part", "corp.example@evil.test"],
    ["a missing email", null],
    ["text without an at sign", "ana"],
    ["an empty string", ""],
  ])("refuses %s", (_name, email) => {
    expect(isEmailAllowed(email, list)).toBe(false);
  });

  it("allows nobody when the list is empty, so forgetting it fails closed", () => {
    expect(isEmailAllowed("ana@example.com", [])).toBe(false);
  });

  describe("an open demo (*)", () => {
    const open = parseAllowList("*");

    it("allows any address", () => {
      expect(open).toEqual(["*"]);
      expect(isEmailAllowed("anyone@anywhere.test", open)).toBe(true);
    });

    it("still needs a real address", () => {
      expect(isEmailAllowed("", open)).toBe(false);
      expect(isEmailAllowed(null, open)).toBe(false);
      expect(isEmailAllowed("not-an-email", open)).toBe(false);
    });

    it("does not treat a star inside an address as a wildcard", () => {
      expect(isEmailAllowed("a@b.test", parseAllowList("*@b.test"))).toBe(false);
    });
  });
});

describe("readAuthConfig", () => {
  const secret = "x".repeat(32);
  const google = { GOOGLE_CLIENT_ID: "id", GOOGLE_CLIENT_SECRET: "secret" };
  const base = { NODE_ENV: "development", BETTER_AUTH_SECRET: secret, ...google };

  it("defaults to oauth and enables only providers that have both values", () => {
    const config = readAuthConfig({ ...base, GITHUB_CLIENT_ID: "id" } as NodeJS.ProcessEnv);
    expect(config.mode).toBe("oauth");
    expect(config.google).toEqual({ clientId: "id", clientSecret: "secret" });
    expect(config.github).toBeNull();
  });

  it("requires a long secret", () => {
    expect(() =>
      readAuthConfig({ ...base, BETTER_AUTH_SECRET: "short" } as NodeJS.ProcessEnv),
    ).toThrow(AuthConfigError);
  });

  it("requires at least one provider in oauth mode", () => {
    expect(() =>
      readAuthConfig({ NODE_ENV: "development", BETTER_AUTH_SECRET: secret } as NodeJS.ProcessEnv),
    ).toThrow(/GOOGLE_CLIENT_ID/);
  });

  it("refuses an unknown mode", () => {
    expect(() => readAuthConfig({ ...base, AUTH_MODE: "none" } as NodeJS.ProcessEnv)).toThrow(
      /AUTH_MODE/,
    );
  });

  it.each(["dev", "off"])("refuses %s mode in production", (mode) => {
    expect(() =>
      readAuthConfig({
        ...base,
        NODE_ENV: "production",
        AUTH_MODE: mode,
        BETTER_AUTH_URL: "https://x.example",
      } as NodeJS.ProcessEnv),
    ).toThrow(/local development/);
  });

  it("allows a relaxed mode in production only with the explicit override", () => {
    const config = readAuthConfig({
      NODE_ENV: "production",
      AUTH_MODE: "off",
      AUTH_ALLOW_INSECURE_MODE: "i-understand",
    } as NodeJS.ProcessEnv);
    expect(config.mode).toBe("off");
  });

  it("requires https for the base URL in production", () => {
    expect(() =>
      readAuthConfig({
        ...base,
        NODE_ENV: "production",
        BETTER_AUTH_URL: "http://x.example",
      } as NodeJS.ProcessEnv),
    ).toThrow(/https/);
  });

  it("does not require https for the local development modes", () => {
    const config = readAuthConfig({
      ...base,
      NODE_ENV: "production",
      AUTH_MODE: "dev",
      AUTH_ALLOW_INSECURE_MODE: "i-understand",
      BETTER_AUTH_URL: "http://localhost:3101",
    } as NodeJS.ProcessEnv);
    expect(config.baseURL).toBe("http://localhost:3101");
  });

  it("needs no secret or provider when sign-in is off", () => {
    expect(() =>
      readAuthConfig({ NODE_ENV: "development", AUTH_MODE: "off" } as NodeJS.ProcessEnv),
    ).not.toThrow();
  });
});

describe("safeNext", () => {
  it.each([
    ["/investigation/tx-1", "/investigation/tx-1"],
    ["/overview?route=blocked_by_rule", "/overview?route=blocked_by_rule"],
  ])("keeps the local path %s", (input, expected) => {
    expect(safeNext(input)).toBe(expected);
  });

  it.each([
    ["another host", "https://evil.example"],
    ["a protocol-relative URL", "//evil.example"],
    ["a backslash trick", "/\\evil.example"],
    ["the sign-in page itself", "/login?next=/login"],
    ["the auth routes", "/api/auth/sign-out"],
    ["nothing", undefined],
    ["an empty value", ""],
  ])("falls back to the overview for %s", (_name, input) => {
    expect(safeNext(input)).toBe("/overview");
  });

  it("uses the first value when the parameter is repeated", () => {
    expect(safeNext(["/performance", "https://evil.example"])).toBe("/performance");
  });
});

/** A token that expires `seconds` from `now`; only the middle part is read. */
function tokenExpiring(now: number, seconds: number): string {
  const payload = btoa(JSON.stringify({ exp: Math.floor(now / 1000) + seconds }));
  return `h.${payload.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")}.s`;
}

describe("getApiToken", () => {
  afterEach(() => {
    clearApiToken();
    vi.unstubAllGlobals();
  });

  it("fetches once, then reuses the token until shortly before it expires", async () => {
    const now = 1_800_000_000_000;
    const token = tokenExpiring(now, 900);
    const fetcher = vi.fn(async () => Response.json({ token }));
    vi.stubGlobal("fetch", fetcher);

    expect(await getApiToken(now)).toBe(token);
    expect(await getApiToken(now + 60_000)).toBe(token);
    expect(fetcher).toHaveBeenCalledTimes(1);

    // Within a minute of expiry it is renewed.
    await getApiToken(now + 900_000 - 30_000);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("shares one request between simultaneous callers", async () => {
    const now = Date.now();
    const fetcher = vi.fn(async () => Response.json({ token: tokenExpiring(now, 900) }));
    vi.stubGlobal("fetch", fetcher);
    await Promise.all([getApiToken(now), getApiToken(now), getApiToken(now)]);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it.each([401, 404])("returns null on a %s, so no header is sent", async (status) => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("{}", { status })),
    );
    expect(await getApiToken()).toBeNull();
  });

  it("returns null when the sign-in service cannot be reached", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Promise.reject(new TypeError("offline"))),
    );
    expect(await getApiToken()).toBeNull();
  });
});

describe("limit wording", () => {
  it("formats waits a person can act on", () => {
    expect(formatWait(30)).toBe("1 minute");
    expect(formatWait(23 * 60)).toBe("23 minutes");
    expect(formatWait(60 * 60)).toBe("1 hour");
    expect(formatWait(65 * 60)).toBe("1 hour 5 minutes");
    expect(formatWait(3 * 3600 + 120)).toBe("3 hours 2 minutes");
  });

  it("says which allowance ran out and when to come back", () => {
    const error = new ApiError("http", "x", 429, "investigation limit reached: 10 per hour", {
      window: "hour",
      limit: 10,
      retryAfterSeconds: 23 * 60,
    });
    expect(describeApiError(error)).toBe(
      "You have used all 10 investigations allowed per hour. You can start another in 23 minutes.",
    );
  });

  it("still explains a 429 without advice", () => {
    expect(describeApiError(new ApiError("http", "x", 429, null))).toMatch(/limit/);
  });

  it("explains an ended session", () => {
    expect(describeApiError(new ApiError("http", "x", 401, "authentication required"))).toMatch(
      /Sign in again/,
    );
  });
});
