/**
 * Sign-in configuration, read from the environment at runtime.
 *
 * Three modes:
 *  - `oauth` (default): Google and GitHub sign-in. Every screen except the
 *    landing page needs a session.
 *  - `dev`: adds an email and password form, so the full flow can be tried
 *    without OAuth credentials. Refused in production.
 *  - `off`: no sign-in at all, for local work against an API that also runs
 *    with TRACEAML_AUTH_MODE=off. Refused in production.
 *
 * Nothing here is read at build time, so one image serves any deployment.
 */

export type AuthMode = "oauth" | "dev" | "off";

export type AuthConfig = {
  mode: AuthMode;
  baseURL: string;
  secret: string;
  databasePath: string;
  allowList: string[];
  google: { clientId: string; clientSecret: string } | null;
  github: { clientId: string; clientSecret: string } | null;
};

const MIN_SECRET_LENGTH = 32;

export class AuthConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthConfigError";
  }
}

function read(env: NodeJS.ProcessEnv, name: string): string | undefined {
  const value = env[name]?.trim();
  return value ? value : undefined;
}

function provider(env: NodeJS.ProcessEnv, prefix: "GOOGLE" | "GITHUB") {
  const clientId = read(env, `${prefix}_CLIENT_ID`);
  const clientSecret = read(env, `${prefix}_CLIENT_SECRET`);
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

/** Split a comma or whitespace separated list: emails, or `@domain` entries. */
export function parseAllowList(raw: string | undefined): string[] {
  return (raw ?? "")
    .split(/[\s,;]+/)
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

export function readAuthConfig(env: NodeJS.ProcessEnv = process.env): AuthConfig {
  const rawMode = (read(env, "AUTH_MODE") ?? "oauth").toLowerCase();
  if (rawMode !== "oauth" && rawMode !== "dev" && rawMode !== "off") {
    throw new AuthConfigError(`AUTH_MODE must be oauth, dev or off, not "${rawMode}"`);
  }
  const mode: AuthMode = rawMode;
  const production = env.NODE_ENV === "production";

  // A relaxed mode must never be reachable by mistake in a real deployment.
  if (production && mode !== "oauth" && read(env, "AUTH_ALLOW_INSECURE_MODE") !== "i-understand") {
    throw new AuthConfigError(
      `AUTH_MODE=${mode} is for local development. Use oauth in production.`,
    );
  }

  const baseURL = read(env, "BETTER_AUTH_URL") ?? "http://localhost:3000";
  const secret = read(env, "BETTER_AUTH_SECRET") ?? "";
  const google = provider(env, "GOOGLE");
  const github = provider(env, "GITHUB");

  if (mode !== "off") {
    if (secret.length < MIN_SECRET_LENGTH) {
      throw new AuthConfigError(
        `BETTER_AUTH_SECRET must be at least ${MIN_SECRET_LENGTH} characters (generate one with: openssl rand -base64 32)`,
      );
    }
    if (mode === "oauth" && !google && !github) {
      throw new AuthConfigError(
        "Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET, or GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET, to enable sign-in",
      );
    }
    if (production && mode === "oauth" && !baseURL.startsWith("https://")) {
      throw new AuthConfigError("BETTER_AUTH_URL must be an https URL in production");
    }
  }

  return {
    mode,
    baseURL: baseURL.replace(/\/+$/, ""),
    secret,
    databasePath: read(env, "AUTH_DB_PATH") ?? "data/auth/auth.db",
    allowList: parseAllowList(read(env, "AUTH_ALLOWED_EMAILS")),
    google,
    github,
  };
}

/** The list entry that lets any person with a verified email sign in: a public demo. */
export const ALLOW_ANYONE = "*";

/**
 * Whether an email may sign in. Entries are full addresses, `@domain`, or `*`
 * for anyone (a public demo). An empty list allows nobody: forgetting to set
 * it fails closed, and opening the app up takes an explicit `*`.
 */
export function isEmailAllowed(email: string | null | undefined, allowList: string[]): boolean {
  const address = email?.trim().toLowerCase();
  if (!address || !address.includes("@")) return false;
  const domain = address.slice(address.lastIndexOf("@"));
  return allowList.some(
    (entry) =>
      entry === ALLOW_ANYONE || (entry.startsWith("@") ? entry === domain : entry === address),
  );
}
