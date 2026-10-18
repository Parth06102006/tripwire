"use client";

import { useQuery } from "@tanstack/react-query";

/**
 * The visitor's sign-in state, read from the web app's own session (Better
 * Auth), not from the API. The API can run with its token check off while
 * people still sign in here, so only this can say who is signed in.
 *
 *  - `signed-out`: show Sign in and Sign up. Also the answer while loading and
 *    when the sign-in service cannot be reached, so the page never shows a
 *    workbench link to someone who cannot use it.
 *  - `signed-in`: the session exists; `user` holds its name and email.
 *  - `off`: sign-in is switched off on this server (the auth routes answer
 *    404), so the workbench is open to everyone.
 */
export type AuthStatus = "signed-out" | "signed-in" | "off";

export type SessionUser = { name: string | null; email: string | null };

export type AuthSession = { status: AuthStatus; user: SessionUser | null };

export const AUTH_SESSION_KEY = ["auth-session"] as const;

function readUser(body: unknown): SessionUser | null {
  if (!body || typeof body !== "object" || !("user" in body)) return null;
  const user = (body as { user: unknown }).user;
  if (!user || typeof user !== "object") return null;
  const { name, email } = user as { name?: unknown; email?: unknown };
  return {
    name: typeof name === "string" && name.trim() ? name : null,
    email: typeof email === "string" && email.trim() ? email : null,
  };
}

async function readSession(signal: AbortSignal): Promise<AuthSession> {
  try {
    const response = await fetch("/api/auth/get-session", {
      credentials: "same-origin",
      cache: "no-store",
      signal,
    });
    if (response.status === 404) return { status: "off", user: null };
    if (!response.ok) return { status: "signed-out", user: null };
    const user = readUser(await response.json().catch(() => null));
    return user ? { status: "signed-in", user } : { status: "signed-out", user: null };
  } catch {
    return { status: "signed-out", user: null };
  }
}

const SIGNED_OUT: AuthSession = { status: "signed-out", user: null };

export function useAuthSession(): AuthSession & { loading: boolean } {
  const { data, isPending } = useQuery({
    queryKey: AUTH_SESSION_KEY,
    queryFn: ({ signal }) => readSession(signal),
    staleTime: 60_000,
    retry: false,
  });
  return { ...(data ?? SIGNED_OUT), loading: isPending };
}

export function useAuthStatus(): AuthStatus {
  return useAuthSession().status;
}
