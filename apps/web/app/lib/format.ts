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

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatRelative(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const seconds = Math.round((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return `${Math.round(hours / 24)} d ago`;
}

export function shortId(value: string, keep = 14): string {
  return value.length <= keep ? value : `${value.slice(0, keep - 1)}…`;
}
