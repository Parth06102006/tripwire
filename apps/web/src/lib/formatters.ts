/**
 * Display formatting. Amounts always render with their own currency; nothing
 * here converts between currencies or rounds away a value's sign.
 */

// AMLworld currency names mapped to ISO codes for compact display. Unknown
// names are shown exactly as the API returned them.
const CURRENCY_CODES: Record<string, string> = {
  "US Dollar": "USD",
  Euro: "EUR",
  Yuan: "CNY",
  Yen: "JPY",
  "UK Pound": "GBP",
  Rupee: "INR",
  Ruble: "RUB",
  "Canadian Dollar": "CAD",
  "Australian Dollar": "AUD",
  "Swiss Franc": "CHF",
  "Mexican Peso": "MXN",
  "Brazil Real": "BRL",
  Shekel: "ILS",
  "Saudi Riyal": "SAR",
  Bitcoin: "BTC",
};

export function currencyCode(name: string | null | undefined): string | null {
  if (!name) return null;
  return CURRENCY_CODES[name] ?? name;
}

const amountFormat = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const compactAmountFormat = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

export function formatAmount(
  amount: number | null | undefined,
  currency: string | null | undefined,
  { compact = false }: { compact?: boolean } = {},
): string {
  if (amount === null || amount === undefined) return "Amount not returned";
  const value =
    compact && Math.abs(amount) >= 10_000
      ? compactAmountFormat.format(amount)
      : amountFormat.format(amount);
  const code = currencyCode(currency);
  return code ? `${value} ${code}` : value;
}

const integerFormat = new Intl.NumberFormat("en-US");
export function formatInteger(value: number): string {
  return integerFormat.format(value);
}

export function formatPercent(value: number, digits = 1): string {
  return `${(value * 100).toFixed(digits)}%`;
}

export function formatScore(value: number): string {
  return value.toFixed(4);
}

export function formatMs(value: number): string {
  if (value >= 1000) return `${(value / 1000).toFixed(2)} s`;
  if (value >= 100) return `${value.toFixed(0)} ms`;
  if (value >= 10) return `${value.toFixed(1)} ms`;
  return `${value.toFixed(2)} ms`;
}

export function formatWindow(seconds: number): string {
  if (seconds % 86_400 === 0) {
    const days = seconds / 86_400;
    return days === 1 ? "24 hours" : `${days} days`;
  }
  if (seconds % 3_600 === 0) return `${seconds / 3_600} hours`;
  return `${formatInteger(seconds)} s`;
}

/** Source timestamps are minute-resolution strings without a zone; show them as given. */
export function formatSourceTimestamp(value: string): string {
  return value.length > 16 ? value.slice(0, 16) : value;
}

const clockFormat = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});
export function formatClock(epochMs: number): string {
  return clockFormat.format(new Date(epochMs));
}

const dateTimeFormat = new Intl.DateTimeFormat("en-GB", {
  year: "numeric",
  month: "short",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});
export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : dateTimeFormat.format(date);
}

export function formatUsd(value: number): string {
  if (value === 0) return "$0";
  if (Math.abs(value) < 0.01) return `$${value.toExponential(2)}`;
  return `$${value.toFixed(2)}`;
}

/** Account keys are `{bank}::{account}`; split for display without guessing. */
export function splitAccountKey(key: string): { bank: string | null; account: string } {
  const index = key.indexOf("::");
  if (index === -1) return { bank: null, account: key };
  return { bank: key.slice(0, index), account: key.slice(index + 2) };
}
