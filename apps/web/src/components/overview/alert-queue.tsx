"use client";

import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from "@tanstack/react-table";
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  Eye,
  Filter,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { AlertFilterBar } from "@/components/overview/alert-filter-bar";
import { investigationHref, TransactionLookup } from "@/components/overview/transaction-lookup";
import { RouteBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import { EmptyState, ErrorState, Mono } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useAlerts } from "@/hooks/use-alerts";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import {
  activeFilterCount,
  DEFAULT_DRAFT,
  EMPTY_DRAFT,
  resolveFilters,
  type FilterDraft,
} from "@/lib/alert-filters";
import { describeApiError } from "@/lib/api-client";
import type { AlertItem } from "@/lib/api-schemas";
import { cn } from "@/lib/cn";
import { formatInteger, formatScore, formatSourceTimestamp } from "@/lib/formatters";

type Row = AlertItem & { rank: number };

const PAGE_SIZES = [25, 50, 100, 200] as const;
const column = createColumnHelper<Row>();

function buildColumns(onSelectAlert?: (alert: AlertItem) => void, selectedAlertId?: string | null) {
  return [
    column.accessor("rank", {
      header: "Rank",
      cell: (info) => <span className="text-fg-muted">{formatInteger(info.getValue())}</span>,
    }),
    column.accessor("transaction_id", {
      header: "Transaction",
      cell: (info) => (
        <span className="flex items-center gap-2">
          <Link
            href={investigationHref(info.getValue())}
            className="rounded-sm text-fg underline-offset-2 hover:text-accent hover:underline"
            onClick={(event) => event.stopPropagation()}
          >
            <Mono>{info.getValue()}</Mono>
          </Link>
          {info.row.original.graph_status === "missing" ? (
            <Badge
              tone="review"
              title="This transaction is not in the loaded graph, so the agent cannot investigate it."
            >
              Not in graph
            </Badge>
          ) : null}
        </span>
      ),
    }),
    column.accessor("timestamp", {
      header: "Timestamp",
      cell: (info) => (
        <span className="text-fg-secondary">{formatSourceTimestamp(info.getValue())}</span>
      ),
    }),
    column.accessor("score", {
      header: "Score",
      cell: (info) => {
        const score = info.getValue();
        const isCritical = score >= 0.85 || info.row.original.route === "blocked_by_rule";
        return (
          <span className="flex items-center gap-2.5">
            <span
              className={cn(
                "w-14 font-mono font-medium",
                isCritical ? "text-critical" : score >= 0.5 ? "text-warning" : "text-fg",
              )}
            >
              {formatScore(score)}
            </span>
            <span
              className="hidden h-1.5 w-16 overflow-hidden rounded-full bg-surface-elevated sm:block"
              aria-hidden
            >
              <span
                className={cn(
                  "block h-full transition-all",
                  isCritical ? "bg-critical" : score >= 0.5 ? "bg-warning" : "bg-fg-muted",
                )}
                style={{ width: `${Math.max(2, score * 100)}%` }}
              />
            </span>
          </span>
        );
      },
    }),
    column.accessor("route", {
      header: "Route",
      cell: (info) => <RouteBadge route={info.getValue()} />,
    }),
    column.display({
      id: "inspect",
      header: "Inspect",
      cell: (info) => (
        <button
          type="button"
          title="Inspect alert in side panel"
          aria-label={`Inspect ${info.row.original.transaction_id}`}
          onClick={(event) => {
            event.stopPropagation();
            onSelectAlert?.(info.row.original);
          }}
          className={cn(
            "inline-flex size-6 items-center justify-center rounded text-fg-muted transition-colors hover:bg-surface-elevated hover:text-accent",
            selectedAlertId === info.row.original.transaction_id && "bg-accent-soft text-accent",
          )}
        >
          <Eye className="size-3.5" aria-hidden />
        </button>
      ),
    }),
  ];
}

function SortIcon({ direction }: { direction: false | "asc" | "desc" }) {
  if (direction === "asc") return <ArrowUp className="size-3" aria-hidden />;
  if (direction === "desc") return <ArrowDown className="size-3" aria-hidden />;
  return <ChevronsUpDown className="size-3 opacity-50" aria-hidden />;
}

export function AlertQueue({
  className,
  selectedAlertId,
  onSelectAlert,
  initialDraft = DEFAULT_DRAFT,
}: {
  className?: string;
  selectedAlertId?: string | null;
  onSelectAlert?: (alert: AlertItem | null) => void;
  initialDraft?: FilterDraft;
}) {
  const router = useRouter();
  const [pageSize, setPageSize] = useState<number>(50);
  const [page, setPage] = useState(0);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [draft, setDraft] = useState<FilterDraft>(initialDraft);
  const text = useDebouncedValue(draft.text, 250);

  const { params: filters, problems } = resolveFilters({ ...draft, text });
  const activeCount = activeFilterCount(filters);

  const alerts = useAlerts({ limit: pageSize, offset: page * pageSize, ...filters });
  const rows = useMemo<Row[]>(
    () =>
      (alerts.data?.items ?? []).map((item, index) => ({
        ...item,
        rank: (alerts.data?.offset ?? 0) + index + 1,
      })),
    [alerts.data],
  );

  const columns = useMemo(
    () => buildColumns(onSelectAlert, selectedAlertId),
    [onSelectAlert, selectedAlertId],
  );

  // TanStack Table returns new function references by design; the React
  // Compiler lint flags that, and it is safe here because nothing memoizes them.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const total = alerts.data?.total ?? 0;
  const scored = alerts.data?.scored_total ?? total;
  const lastPage = Math.max(0, Math.ceil(total / pageSize) - 1);
  const visible = table.getRowModel().rows;
  const firstShown = total === 0 ? 0 : page * pageSize + 1;
  const lastShown = Math.min(total, (page + 1) * pageSize);

  const changeFilters = (next: FilterDraft) => {
    setDraft(next);
    setPage(0);
  };

  const applyPreset = (preset: "all" | "critical" | "review" | "blocked") => {
    switch (preset) {
      case "all":
        changeFilters(EMPTY_DRAFT);
        break;
      case "critical":
        changeFilters({ ...EMPTY_DRAFT, minScore: "0.85" });
        break;
      case "review":
        changeFilters({ ...EMPTY_DRAFT, routes: ["flagged_for_review"] });
        break;
      case "blocked":
        changeFilters({ ...EMPTY_DRAFT, routes: ["blocked_by_rule"] });
        break;
    }
  };

  return (
    <section
      aria-labelledby="queue-heading"
      className={cn(
        "flex min-h-0 min-w-0 flex-col rounded-lg border border-border bg-surface",
        className,
      )}
    >
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div>
          <h2 id="queue-heading" className="text-sm font-semibold text-fg">
            Alert queue
          </h2>
          <p className="text-xs text-fg-muted">
            {alerts.data
              ? activeCount > 0
                ? `${formatInteger(total)} of ${formatInteger(scored)} scored transactions match, highest score first`
                : `Rows ${formatInteger(firstShown)} to ${formatInteger(lastShown)} of ${formatInteger(total)}, highest score first`
              : "Highest score first"}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Quick preset chips */}
          <div
            className="hidden items-center gap-1 sm:flex"
            role="group"
            aria-label="Quick presets"
          >
            <button
              type="button"
              onClick={() => applyPreset("review")}
              className={cn(
                "rounded px-2 py-1 text-2xs font-medium transition-colors",
                draft.routes.length === 1 && draft.routes[0] === "flagged_for_review"
                  ? "bg-warning/20 text-warning"
                  : "text-fg-muted hover:text-warning",
              )}
            >
              Review
            </button>
            <button
              type="button"
              onClick={() => applyPreset("critical")}
              className={cn(
                "rounded px-2 py-1 text-2xs font-medium transition-colors",
                draft.minScore === "0.85"
                  ? "bg-critical/20 text-critical"
                  : "text-fg-muted hover:text-critical",
              )}
            >
              Score 0.85+
            </button>
            <button
              type="button"
              onClick={() => applyPreset("blocked")}
              className={cn(
                "rounded px-2 py-1 text-2xs font-medium transition-colors",
                draft.routes.length === 1 && draft.routes[0] === "blocked_by_rule"
                  ? "bg-critical/20 text-critical"
                  : "text-fg-muted hover:text-critical",
              )}
            >
              Rule block
            </button>
            <button
              type="button"
              onClick={() => applyPreset("all")}
              className={cn(
                "rounded px-2 py-1 text-2xs font-medium transition-colors",
                activeCount === 0 ? "bg-surface-elevated text-fg" : "text-fg-muted hover:text-fg",
              )}
            >
              All
            </button>
          </div>
          <TransactionLookup />
        </div>
      </header>

      <AlertFilterBar
        draft={draft}
        onChange={changeFilters}
        counts={alerts.data?.route_counts}
        problems={problems}
        activeCount={activeCount}
        onClear={() => changeFilters(EMPTY_DRAFT)}
      />

      {alerts.isError ? (
        <div className="min-h-0 flex-1 overflow-auto p-4">
          <ErrorState
            title="The alert queue could not be loaded"
            message={describeApiError(alerts.error)}
            action={
              <Button size="sm" onClick={() => alerts.refetch()}>
                Try again
              </Button>
            }
          />
        </div>
      ) : (
        <div className="min-h-0 flex-1 scrollbar-thin overflow-auto">
          <table className="w-full min-w-[640px] text-sm" aria-busy={alerts.isFetching}>
            <thead>
              {table.getHeaderGroups().map((group) => (
                <tr key={group.id} className="text-left">
                  {group.headers.map((header) => {
                    const sorted = header.column.getIsSorted();
                    return (
                      <th
                        key={header.id}
                        scope="col"
                        aria-sort={
                          sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : "none"
                        }
                        className="sticky top-0 z-10 bg-surface px-4 py-2 text-xs font-medium text-fg-muted shadow-[inset_0_-1px_0_var(--border)]"
                      >
                        {header.isPlaceholder ? null : (
                          <button
                            type="button"
                            onClick={header.column.getToggleSortingHandler()}
                            className="inline-flex items-center gap-1 rounded-sm hover:text-fg"
                          >
                            {flexRender(header.column.columnDef.header, header.getContext())}
                            {header.column.getCanSort() ? <SortIcon direction={sorted} /> : null}
                          </button>
                        )}
                      </th>
                    );
                  })}
                </tr>
              ))}
            </thead>
            <tbody className={cn(alerts.isPlaceholderData && "opacity-60 transition-opacity")}>
              {alerts.isPending
                ? Array.from({ length: 10 }, (_, i) => (
                    <tr key={i} className="border-b border-border/60">
                      {columns.map((_, j) => (
                        <td key={j} className="px-4 py-2.5">
                          <Skeleton className="h-4 w-full max-w-32" />
                        </td>
                      ))}
                    </tr>
                  ))
                : visible.map((row) => {
                    const isSelected = selectedAlertId === row.original.transaction_id;
                    return (
                      <tr
                        key={row.id}
                        onClick={() => router.push(investigationHref(row.original.transaction_id))}
                        className={cn(
                          "cursor-pointer border-b border-border/60 transition-colors last:border-b-0 hover:bg-surface-elevated",
                          isSelected && "bg-surface-elevated ring-1 ring-accent/40 ring-inset",
                        )}
                      >
                        {row.getVisibleCells().map((cell) => (
                          <td key={cell.id} className="px-4 py-2">
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
            </tbody>
          </table>
          {!alerts.isPending && visible.length === 0 ? (
            <EmptyState
              icon={Filter}
              title={activeCount > 0 ? "No alerts match these filters" : "No scored alerts"}
              action={
                activeCount > 0 ? (
                  <Button size="sm" onClick={() => changeFilters(EMPTY_DRAFT)}>
                    Clear filters
                  </Button>
                ) : undefined
              }
            >
              {activeCount > 0
                ? "Widen the score or date range, or choose more routes."
                : "The score artifact returned no rows."}
            </EmptyState>
          ) : null}
        </div>
      )}

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-2.5">
        <label className="flex items-center gap-2 text-xs text-fg-secondary">
          Rows per page
          <Select
            value={pageSize}
            onChange={(event) => {
              setPageSize(Number(event.target.value));
              setPage(0);
            }}
            className="h-7 w-20 text-xs"
          >
            {PAGE_SIZES.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </Select>
        </label>
        <div className="flex items-center gap-1.5">
          <span className="mr-2 text-xs text-fg-muted">
            Page {formatInteger(page + 1)} of {formatInteger(lastPage + 1)}
          </span>
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label="Previous page"
            disabled={page === 0 || alerts.isFetching}
            onClick={() => setPage((value) => Math.max(0, value - 1))}
          >
            <ChevronLeft />
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label="Next page"
            disabled={page >= lastPage || alerts.isFetching}
            onClick={() => setPage((value) => Math.min(lastPage, value + 1))}
          >
            <ChevronRight />
          </Button>
        </div>
      </footer>
    </section>
  );
}
