import "server-only";

import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { getMigrations } from "better-auth/db/migration";
import { nextCookies } from "better-auth/next-js";
import { jwt } from "better-auth/plugins/jwt";

import { isEmailAllowed, readAuthConfig, type AuthConfig } from "./config";

/** How long a browser session lasts, and how often its expiry is pushed back. */
const SESSION_DAYS = 7;
const SESSION_REFRESH_SECONDS = 24 * 60 * 60;
/** Lifetime of the token the API verifies. Short: the browser re-requests it. */
const TOKEN_LIFETIME = "15m";

function createAuth(config: AuthConfig) {
  mkdirSync(dirname(resolve(config.databasePath)), { recursive: true });
  const database = new DatabaseSync(resolve(config.databasePath));
  // WAL lets sessions be read while another request writes one.
  database.exec("PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;");

  const refuse = () => {
    throw new APIError("FORBIDDEN", {
      message: "This account is not on the access list. Ask an administrator to add it.",
    });
  };

  const auth = betterAuth({
    baseURL: config.baseURL,
    secret: config.secret,
    trustedOrigins: [config.baseURL],
    database,
    socialProviders: {
      ...(config.google ? { google: config.google } : {}),
      ...(config.github ? { github: config.github } : {}),
    },
    // Dev mode only. The same access list applies to it.
    emailAndPassword: { enabled: config.mode === "dev", autoSignIn: true },
    account: {
      // The same person signing in with Google and then GitHub is one user.
      accountLinking: { enabled: true, trustedProviders: ["google", "github"] },
    },
    session: {
      expiresIn: SESSION_DAYS * 24 * 60 * 60,
      updateAge: SESSION_REFRESH_SECONDS,
    },
    advanced: { useSecureCookies: config.baseURL.startsWith("https://") },
    databaseHooks: {
      user: {
        create: {
          // No account is created for an address that is not allowed.
          before: async (user) => {
            if (!isEmailAllowed(user.email, config.allowList)) refuse();
            if (config.mode !== "dev" && !user.emailVerified) {
              throw new APIError("FORBIDDEN", {
                message: "The provider did not verify this email.",
              });
            }
          },
        },
      },
      session: {
        create: {
          // Checked again on every sign-in, so removing someone from the list
          // locks them out the next time their session or token is renewed.
          before: async (session, context) => {
            const user = await context?.context.internalAdapter.findUserById(session.userId);
            if (!user || !isEmailAllowed(user.email, config.allowList)) refuse();
          },
        },
      },
    },
    plugins: [
      jwt({
        jwt: {
          // The API checks both against its own settings.
          issuer: config.baseURL,
          audience: config.baseURL,
          expirationTime: TOKEN_LIFETIME,
          // Only what the API needs; never the rest of the user record.
          definePayload: ({ user }) => ({ email: user.email, name: user.name }),
        },
      }),
      // Last, as Better Auth requires, so cookies set in server actions stick.
      nextCookies(),
    ],
  });
  return auth;
}

export type Auth = ReturnType<typeof createAuth>;

type State = { config: AuthConfig; auth: Auth | null; ready: Promise<void> | null };

const globalForAuth = globalThis as unknown as { __tripwireAuth?: State };

function state(): State {
  // Cached on globalThis so route handlers, layouts and instrumentation share
  // one instance, including across hot reloads in development.
  globalForAuth.__tripwireAuth ??= { config: readAuthConfig(), auth: null, ready: null };
  return globalForAuth.__tripwireAuth;
}

export function authMode(): AuthConfig["mode"] {
  return state().config.mode;
}

export function authConfig(): AuthConfig {
  return state().config;
}

/** The Better Auth instance, created on first use. Throws when sign-in is off. */
export function getAuth(): Auth {
  const current = state();
  if (current.config.mode === "off") throw new Error("Sign-in is switched off (AUTH_MODE=off)");
  current.auth ??= createAuth(current.config);
  return current.auth;
}

/** Creates the user, session and key tables on first start. Idempotent. */
export function ensureAuthSchema(): Promise<void> {
  const current = state();
  if (current.config.mode === "off") return Promise.resolve();
  current.ready ??= (async () => {
    const auth = getAuth();
    const { runMigrations } = await getMigrations(auth.options);
    await runMigrations();
  })();
  return current.ready;
}
