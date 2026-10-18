import type { ModelRoute } from "@/lib/api-schemas";

/** Query for one page of the alert queue; filters are applied by the API. */
export type AlertParams = {
  limit: number;
  offset: number;
  routes?: readonly ModelRoute[];
  minScore?: number;
  maxScore?: number;
  /** Inclusive days, YYYY-MM-DD, compared with the queued timestamp. */
  dateFrom?: string;
  dateTo?: string;
  /** Substring of the transaction ID. */
  text?: string;
};

export type AlertFilterParams = Omit<AlertParams, "limit" | "offset">;

/** What the filter bar edits: raw field text, validated by resolveFilters. */
export type FilterDraft = {
  routes: ModelRoute[];
  minScore: string;
  maxScore: string;
  dateFrom: string;
  dateTo: string;
  text: string;
};

export const ROUTE_ORDER: readonly ModelRoute[] = [
  "flagged_for_review",
  "blocked_by_rule",
  "standard_path",
];

export const EMPTY_DRAFT: FilterDraft = {
  routes: [],
  minScore: "",
  maxScore: "",
  dateFrom: "",
  dateTo: "",
  text: "",
};

export const DEFAULT_DRAFT: FilterDraft = {
  ...EMPTY_DRAFT,
  routes: ["flagged_for_review"],
};

function parseScore(raw: string): number | "invalid" | undefined {
  const trimmed = raw.trim();
  if (trimmed === "") return undefined;
  const value = Number(trimmed);
  return Number.isFinite(value) && value >= 0 && value <= 1 ? value : "invalid";
}

/**
 * Turn the draft into API parameters. A group that is not valid is left out
 * of the request and reported, so the queue never shows results for a filter
 * the analyst did not mean.
 */
export function resolveFilters(draft: FilterDraft): {
  params: AlertFilterParams;
  problems: { score: string | null; date: string | null };
} {
  const params: AlertFilterParams = {};
  const problems: { score: string | null; date: string | null } = { score: null, date: null };

  if (draft.routes.length > 0) params.routes = ROUTE_ORDER.filter((r) => draft.routes.includes(r));

  const min = parseScore(draft.minScore);
  const max = parseScore(draft.maxScore);
  if (min === "invalid" || max === "invalid") {
    problems.score = "Scores run from 0 to 1.";
  } else if (min !== undefined && max !== undefined && min > max) {
    problems.score = "The minimum score is above the maximum.";
  } else {
    if (min !== undefined) params.minScore = min;
    if (max !== undefined) params.maxScore = max;
  }

  if (draft.dateFrom && draft.dateTo && draft.dateFrom > draft.dateTo) {
    problems.date = "The start date is after the end date.";
  } else {
    if (draft.dateFrom) params.dateFrom = draft.dateFrom;
    if (draft.dateTo) params.dateTo = draft.dateTo;
  }

  const text = draft.text.trim();
  if (text) params.text = text;

  return { params, problems };
}

/** How many filter groups are narrowing the queue. */
export function activeFilterCount(params: AlertFilterParams): number {
  return [
    (params.routes?.length ?? 0) > 0,
    params.minScore !== undefined || params.maxScore !== undefined,
    params.dateFrom !== undefined || params.dateTo !== undefined,
    params.text !== undefined,
  ].filter(Boolean).length;
}
