"use client";

import { Search, X } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ROUTE_ORDER, type FilterDraft } from "@/lib/alert-filters";
import type { ModelRoute, RouteCounts } from "@/lib/api-schemas";
import { cn } from "@/lib/cn";
import { formatInteger } from "@/lib/formatters";

const ROUTE_CHIP: Record<ModelRoute, { label: string; dot: string }> = {
  blocked_by_rule: { label: "Blocked by rule", dot: "bg-critical" },
  flagged_for_review: { label: "Flagged for review", dot: "bg-warning" },
  standard_path: { label: "Standard path", dot: "bg-fg-muted" },
};

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-2xs text-fg-muted">{label}</span>
      {children}
    </div>
  );
}

export function AlertFilterBar({
  draft,
  onChange,
  counts,
  problems,
  activeCount,
  onClear,
}: {
  draft: FilterDraft;
  onChange: (next: FilterDraft) => void;
  /** Matches per route under the other filters, when the API reports them. */
  counts: RouteCounts | null | undefined;
  problems: { score: string | null; date: string | null };
  activeCount: number;
  onClear: () => void;
}) {
  const set = <K extends keyof FilterDraft>(key: K, value: FilterDraft[K]) =>
    onChange({ ...draft, [key]: value });

  const toggleRoute = (route: ModelRoute) =>
    set(
      "routes",
      draft.routes.includes(route)
        ? draft.routes.filter((value) => value !== route)
        : [...draft.routes, route],
    );

  return (
    <div className="space-y-2 border-b border-border px-4 py-2.5" role="search">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="relative w-full sm:w-56">
          <Search
            className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-fg-muted"
            aria-hidden
          />
          <Input
            aria-label="Transaction ID contains"
            placeholder="Transaction ID contains"
            value={draft.text}
            onChange={(event) => set("text", event.target.value)}
            className="h-7 pl-8 font-mono text-xs"
          />
        </div>

        <div role="group" aria-label="Route" className="flex flex-wrap items-center gap-1.5">
          {ROUTE_ORDER.map((route) => {
            const chip = ROUTE_CHIP[route];
            const pressed = draft.routes.includes(route);
            const count = counts?.[route];
            return (
              <button
                key={route}
                type="button"
                aria-pressed={pressed}
                onClick={() => toggleRoute(route)}
                className={cn(
                  "inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs transition-colors",
                  pressed
                    ? "border-accent bg-accent-soft text-fg"
                    : "border-border-strong text-fg-secondary hover:border-fg-muted hover:text-fg",
                )}
              >
                <span className={cn("size-1.5 rounded-full", chip.dot)} aria-hidden />
                {chip.label}
                {count !== undefined ? (
                  <span className="font-mono text-2xs text-fg-muted">{formatInteger(count)}</span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <Field label="Score">
          <Input
            aria-label="Minimum score"
            aria-invalid={problems.score ? true : undefined}
            inputMode="decimal"
            placeholder="0"
            value={draft.minScore}
            onChange={(event) => set("minScore", event.target.value)}
            className="h-7 w-16 text-xs"
          />
          <span className="text-2xs text-fg-muted">to</span>
          <Input
            aria-label="Maximum score"
            aria-invalid={problems.score ? true : undefined}
            inputMode="decimal"
            placeholder="1"
            value={draft.maxScore}
            onChange={(event) => set("maxScore", event.target.value)}
            className="h-7 w-16 text-xs"
          />
        </Field>
        <Field label="Date">
          <Input
            type="date"
            aria-label="From date"
            aria-invalid={problems.date ? true : undefined}
            value={draft.dateFrom}
            onChange={(event) => set("dateFrom", event.target.value)}
            className="h-7 w-32 text-xs"
          />
          <span className="text-2xs text-fg-muted">to</span>
          <Input
            type="date"
            aria-label="To date"
            aria-invalid={problems.date ? true : undefined}
            value={draft.dateTo}
            onChange={(event) => set("dateTo", event.target.value)}
            className="h-7 w-32 text-xs"
          />
        </Field>

        {activeCount > 0 ? (
          <Button size="sm" variant="ghost" onClick={onClear} className="ml-auto">
            <X aria-hidden />
            Clear {activeCount === 1 ? "filter" : `${activeCount} filters`}
          </Button>
        ) : null}

        {problems.score || problems.date ? (
          <p role="alert" className="text-2xs text-critical">
            {problems.score ?? problems.date} That filter is not applied.
          </p>
        ) : null}
      </div>
    </div>
  );
}
