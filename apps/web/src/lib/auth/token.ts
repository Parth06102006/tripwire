/**
 * The short-lived token the API verifies.
 *
 * The browser holds a cookie session; the API accepts only a signed token. The
 * web app issues one on request, and it is cached here until shortly before it
 * expires. Concurrent callers share one in-flight request.
 */

/** Renew this long before the token expires, so a request never carries a stale one. */
const RENEW_EARLY_MS = 60_000;

type Cached = { token: string; expiresAt: number };

let cached: Cached | null = null;
let pending: Promise<string | null> | null = null;

function expiryOf(token: string): number {
  try {
    const payload = token.split(".")[1];
    if (!payload) return 0;
    const json = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/"))) as {
      exp?: number;
    };
    return typeof json.exp === "number" ? json.exp * 1000 : 0;
  } catch {
    return 0;
  }
}

async function request(): Promise<string | null> {
  let response: Response;
  try {
    response = await fetch("/api/auth/token", { credentials: "same-origin", cache: "no-store" });
  } catch {
    return null;
  }
  // 401: no session. 404: sign-in is switched off. Either way, send no token
  // and let the API decide.
  if (!response.ok) return null;
  const body = (await response.json().catch(() => null)) as { token?: unknown } | null;
  if (!body || typeof body.token !== "string") return null;
  const expiresAt = expiryOf(body.token);
  cached = expiresAt > 0 ? { token: body.token, expiresAt } : null;
  return body.token;
}

/** A valid token, or null when nobody is signed in. */
export async function getApiToken(now: number = Date.now()): Promise<string | null> {
  if (cached && cached.expiresAt - RENEW_EARLY_MS > now) return cached.token;
  pending ??= request().finally(() => {
    pending = null;
  });
  return pending;
}

/** Forget the cached token, after the API refused it or on sign-out. */
export function clearApiToken(): void {
  cached = null;
}
