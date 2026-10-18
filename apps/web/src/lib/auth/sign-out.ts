"use client";

import { authClient } from "@/lib/auth/client";
import { clearApiToken } from "@/lib/auth/token";

/**
 * End the session and leave with a full page load, so no cached screen or
 * query data from the signed-in user survives. Used by the workbench account
 * menu and the landing header.
 */
export async function signOutAndLeave(to: string): Promise<void> {
  clearApiToken();
  try {
    await authClient.signOut();
  } finally {
    window.location.href = to;
  }
}
