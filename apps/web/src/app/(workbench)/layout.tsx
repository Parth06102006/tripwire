import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { authMode, getAuth } from "@/lib/auth/server";

/**
 * Every workbench screen needs a valid session. The cookie check in proxy.ts
 * is a quick redirect; this one asks Better Auth to validate the session
 * against its store, so a revoked or expired session cannot render a screen.
 */
export default async function WorkbenchLayout({ children }: { children: ReactNode }) {
  // First, so the screens render per request and never at build time: the
  // build has no sign-in configuration to read.
  const requestHeaders = await headers();
  if (authMode() !== "off") {
    const session = await getAuth().api.getSession({ headers: requestHeaders });
    if (!session) redirect("/login");
  }
  return <AppShell>{children}</AppShell>;
}
