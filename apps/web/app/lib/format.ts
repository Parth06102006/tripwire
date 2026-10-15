/** Small presentational formatters. Inputs are API-returned values only. */

export function formatScore(score: number): string {
  if (!Number.isFinite(score)) return "—";
  return score.toFixed(4);
}

export function formatPercent(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return `${(value * 100).toFixed(2)}%`;
}

export function formatCount(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return Math.round(value).toLocaleString("en-US");
}

export function formatAmount(
  amount: number | null,
  currency: string | null,
): string {
  if (amount === null || !Number.isFinite(amount)) return "—";
  const formatted = amount.toLocaleString("en-US", { maximumFractionDigits: 2 });
  return currency ? `${formatted} ${currency}` : formatted;
}

export function formatDurationMs(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return `${value.toFixed(1)} ms`;
}
