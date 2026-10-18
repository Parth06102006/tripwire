/**
 * Where to go after signing in. Only a path on this site is allowed: anything
 * else (another host, a protocol-relative URL, a backslash trick) falls back
 * to the overview, so the sign-in page cannot be used as an open redirect.
 */
export const DEFAULT_AFTER_LOGIN = "/overview";

export function safeNext(raw: string | string[] | undefined | null): string {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value || !value.startsWith("/")) return DEFAULT_AFTER_LOGIN;
  if (value.startsWith("//") || value.includes("\\")) return DEFAULT_AFTER_LOGIN;
  // Never bounce back into the sign-in page or the auth routes themselves.
  if (value.startsWith("/login") || value.startsWith("/api/")) return DEFAULT_AFTER_LOGIN;
  return value;
}
