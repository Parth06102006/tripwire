import type { Usage } from "@/lib/api-schemas";

/** Whether either rolling window has no investigations left. */
export function isExhausted(usage: Usage | null | undefined): boolean {
  return usage ? usage.hour.remaining === 0 || usage.day.remaining === 0 : false;
}

/** Seconds until the next investigation is allowed; the longer window rules. */
export function secondsUntilNext(usage: Usage | null | undefined): number | null {
  if (!usage) return null;
  const waits = [usage.hour, usage.day]
    .filter((window) => window.remaining === 0 && window.resets_in_seconds !== null)
    .map((window) => window.resets_in_seconds as number);
  return waits.length > 0 ? Math.max(...waits) : null;
}
