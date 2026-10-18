import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

/**
 * First gate: send visitors without a session cookie to the sign-in page
 * before any workbench screen renders. This only looks for the cookie, so it
 * is a fast redirect, not the security boundary. The boundary is the check in
 * the workbench layout and the API's own token verification.
 */
export function proxy(request: NextRequest) {
  if ((process.env.AUTH_MODE ?? "oauth").toLowerCase() === "off") return NextResponse.next();
  if (getSessionCookie(request)) return NextResponse.next();
  const login = new URL("/login", request.url);
  login.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/overview/:path*", "/investigation/:path*", "/performance/:path*"],
};
