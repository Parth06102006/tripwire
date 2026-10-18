/** Runs once when the server starts: create the sign-in tables before the first request. */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { ensureAuthSchema } = await import("@/lib/auth/server");
  await ensureAuthSchema();
}
