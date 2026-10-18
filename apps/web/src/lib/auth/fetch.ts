import { clearApiToken, getApiToken } from "@/lib/auth/token";

/** Where an unauthenticated visitor is sent. */
export const LOGIN_PATH = "/login";

function goToLogin(): void {
  if (typeof window === "undefined") return;
  const next = window.location.pathname + window.location.search;
  // A full page load, not a client route change: it also drops cached query data.
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  window.location.href = `${LOGIN_PATH}?next=${encodeURIComponent(next)}`;
}

/**
 * `fetch` for the API: adds the signed-in user's token.
 *
 * A 401 means the token was missing or stale, so it is renewed and the request
 * is sent once more. A second 401 means there is no session: the visitor goes
 * to the sign-in page. With sign-in switched off no token exists, nothing is
 * added, and the API answers normally.
 */
export async function authorizedFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const send = async (): Promise<Response> => {
    const token = await getApiToken();
    const headers = new Headers(init.headers);
    if (token) headers.set("authorization", `Bearer ${token}`);
    return fetch(input, { ...init, headers });
  };

  let response = await send();
  if (response.status === 401) {
    clearApiToken();
    response = await send();
    if (response.status === 401) goToLogin();
  }
  return response;
}
