"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, ArrowUpDown, RefreshCw, Search } from "lucide-react";
import Link from "next/link";
import type { Route } from "next";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import OpenCaseButton from "../components/cases/open-case-button";
import GraphPreview from "../components/graph/graph-preview";
import { DecisionBadge } from "../components/ui/badge";
import { Card, CardHeader, Metadata, cx } from "../components/ui/card";
import { Button, LinkButton, TextInput } from "../components/ui/controls";
import { KpiCard } from "../components/ui/kpi-card";
import { SplitReveal } from "../components/ui/motion";
import { PageHeader } from "../components/ui/page-header";
import { EmptyState, ErrorState, LoadingState } from "../components/ui/states";
import {
  ApiError,
  alertsQuery,
  casesQuery,
  fetchReviewQueueSummary,
  type AlertItem,
} from "../lib/api";
import { formatCount, formatScore } from "../lib/format";

const PAGE_SIZE = 25;

type SortKey = "rank" | "score" | "time" | "id";

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.detail;
  return "Something went wrong while loading alerts.";
}

function AlertsWorkspace() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const page = Math.max(0, Number(params.get("page") ?? "0") || 0);
  const selectedId = params.get("tx");

  const [search, setSearch] = useState("");
  const [decision, setDecision] = useState<"all" | "review" | "allow">("all");
  const [sort, setSort] = useState<{ key: SortKey; direction: 1 | -1 }>({ key: "rank", direction: 1 });

  const alerts = useQuery(alertsQuery(PAGE_SIZE, page * PAGE_SIZE));
  const summary = useQuery({
    queryKey: ["review-queue-summary"] as const,
    queryFn: fetchReviewQueueSummary,
  });
  const cases = useQuery(casesQuery(null, 100));

  const setParams = (updates: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value === null) next.delete(key);
      else next.set(key, value);
    }
    const query = next.toString();
    router.replace((query ? `${pathname}?${query}` : pathname) as Route, { scroll: false });
  };

  const total = alerts.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const rows = useMemo(() => {
    const items = alerts.data?.items ?? [];
    const needle = search.trim().toLowerCase();
    const ranked = items.map((item, index) => ({ item, rank: page * PAGE_SIZE + index + 1 }));
    const filtered = ranked.filter(
      ({ item }) =>
        (decision === "all" || item.decision === decision) &&
        (needle === "" || item.transaction_id.toLowerCase().includes(needle)),
    );
    return [...filtered].sort((a, b) => {
      const value =
        sort.key === "rank"
          ? a.rank - b.rank
          : sort.key === "score"
            ? a.item.score - b.item.score
            : sort.key === "time"
              ? a.item.timestamp.localeCompare(b.item.timestamp)
              : a.item.transaction_id.localeCompare(b.item.transaction_id);
      return value * sort.direction;
    });
  }, [alerts.data, search, decision, sort, page]);

  const selected: AlertItem | undefined = alerts.data?.items.find((item) => item.transaction_id === selectedId);
  const selectedRank = selected
    ? page * PAGE_SIZE + (alerts.data?.items.indexOf(selected) ?? 0) + 1
    : null;
  const existingCase = cases.data?.items.find((item) => item.transaction_id === selectedId);

  const toggleSort = (key: SortKey) =>
    setSort((previous) =>
      previous.key === key ? { key, direction: previous.direction === 1 ? -1 : 1 } : { key, direction: key === "score" ? -1 : 1 },
    );
  const sortIcon = (key: SortKey) =>
    sort.key !== key ? (
      <ArrowUpDown aria-hidden="true" className="h-3 w-3" />
    ) : sort.direction === 1 ? (
      <ArrowUp aria-hidden="true" className="h-3 w-3 text-accent" />
    ) : (
      <ArrowDown aria-hidden="true" className="h-3 w-3 text-accent" />
    );
  const ariaSort = (key: SortKey) =>
    sort.key !== key ? "none" : sort.direction === 1 ? "ascending" : "descending";

  const filtersActive = search.trim() !== "" || decision !== "all";

  return (
    <>
      <PageHeader
        title="Alerts"
        description="Score-ranked replay queue. Scores come from the model; the allow or review decision comes from deterministic policy."
        actions={
          <Button
            onClick={() => {
              void alerts.refetch();
              void summary.refetch();
            }}
            disabled={alerts.isFetching}
          >
            <RefreshCw aria-hidden="true" className={cx("h-3.5 w-3.5", alerts.isFetching && "animate-spin")} />
            Refresh
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard
          label="Scored transactions"
          state={summary.isPending ? { kind: "loading" } : summary.isError ? { kind: "error", message: errorMessage(summary.error) } : { kind: "ready", value: formatCount(summary.data.total) }}
          note="Entire queue in the score artifact"
        />
        <KpiCard
          label="Review decisions"
          state={summary.isPending ? { kind: "loading" } : summary.isError ? { kind: "error", message: errorMessage(summary.error) } : { kind: "ready", value: formatCount(summary.data.reviewCount) }}
          note="At or above the policy threshold"
        />
        <KpiCard
          label="Allow decisions"
          state={summary.isPending ? { kind: "loading" } : summary.isError ? { kind: "error", message: errorMessage(summary.error) } : { kind: "ready", value: formatCount(summary.data.total - summary.data.reviewCount) }}
          note="Below the policy threshold"
        />
      </div>

      <SplitReveal
        open={selected !== undefined}
        onClose={() => setParams({ tx: null })}
        panelLabel="Alert details"
        width={420}
        panel={
          selected ? (
            <div className="flex flex-col gap-4">
              <div>
                <h2 className="text-base font-semibold">Alert detail</h2>
                <p className="mt-1 font-mono text-xs break-all text-accent">{selected.transaction_id}</p>
              </div>
              <dl className="grid grid-cols-2 gap-3">
                <Metadata label="Risk estimate">{formatScore(selected.score)}</Metadata>
                <div>
                  <dt className="text-xs text-dim">Policy decision</dt>
                  <dd className="mt-0.5">
                    <DecisionBadge decision={selected.decision} />
                  </dd>
                </div>
                <Metadata label="Queue rank">#{selectedRank}</Metadata>
                <Metadata label="Timestamp">{selected.timestamp}</Metadata>
              </dl>
              <p className="text-xs leading-5 text-dim">
                The score is a model estimate and the decision is policy output. Neither is a fraud
                determination.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <LinkButton
                  variant="primary"
                  href={`/simulation?transaction_id=${encodeURIComponent(selected.transaction_id)}`}
                >
                  Investigate
                </LinkButton>
                <OpenCaseButton transactionId={selected.transaction_id} />
              </div>
              {existingCase ? (
                <p className="text-xs text-dim">
                  Existing case:{" "}
                  <Link
                    href={`/cases?case=${encodeURIComponent(existingCase.case_id)}` as Route}
                    className="font-mono text-accent hover:underline"
                  >
                    {existingCase.case_id}
                  </Link>{" "}
                  ({existingCase.status.replace("_", " ")})
                </p>
              ) : cases.isError ? (
                <p className="text-xs text-dim">Case lookup unavailable.</p>
              ) : null}
              <GraphPreview transactionId={selected.transaction_id} title="Connected entities" />
            </div>
          ) : null
        }
      >
        {alerts.isPending ? (
          <LoadingState label="Loading alerts" lines={6} />
        ) : alerts.isError ? (
          <ErrorState
            label="Alerts error"
            title="Alerts unavailable"
            message={errorMessage(alerts.error)}
            onRetry={() => alerts.refetch()}
          />
        ) : alerts.data.items.length === 0 ? (
          <EmptyState label="Alerts empty" title="No alerts in queue" message="The API returned an empty ranked queue." />
        ) : (
          <Card padded={false} aria-label="Alert queue">
            <div className="flex flex-wrap items-end justify-between gap-3 p-4 pb-0 sm:px-6 sm:pt-6">
              <CardHeader
                title="Alert queue"
                description={`Page ${page + 1} of ${pageCount}. Search, decision filter and sorting apply to the ${alerts.data.items.length} rows loaded on this page.`}
              />
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search aria-hidden="true" className="pointer-events-none absolute top-2 left-2.5 h-3.5 w-3.5 text-dim" />
                  <TextInput
                    aria-label="Search transaction ID"
                    placeholder="Search ID"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    className="w-44 pl-8 font-mono"
                  />
                </div>
                <select
                  aria-label="Filter by decision"
                  value={decision}
                  onChange={(event) => setDecision(event.target.value as typeof decision)}
                  className="rounded-control border border-line-strong bg-raised px-2 py-1.5 text-xs text-ink"
                >
                  <option value="all">All decisions</option>
                  <option value="review">Review</option>
                  <option value="allow">Allow</option>
                </select>
                {filtersActive ? (
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setSearch("");
                      setDecision("all");
                    }}
                  >
                    Reset filters
                  </Button>
                ) : null}
              </div>
            </div>
            {rows.length === 0 ? (
              <p className="px-6 pb-6 text-xs text-dim">
                No rows on this page match the filters. This is a filter result, not an error.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-y border-line text-dim">
                      <th scope="col" aria-sort={ariaSort("rank")} className="px-4 py-2 font-medium sm:pl-6">
                        <button type="button" onClick={() => toggleSort("rank")} className="inline-flex items-center gap-1 hover:text-ink">Rank {sortIcon("rank")}</button>
                      </th>
                      <th scope="col" aria-sort={ariaSort("id")} className="px-4 py-2 font-medium">
                        <button type="button" onClick={() => toggleSort("id")} className="inline-flex items-center gap-1 hover:text-ink">Transaction {sortIcon("id")}</button>
                      </th>
                      <th scope="col" aria-sort={ariaSort("score")} className="px-4 py-2 font-medium">
                        <button type="button" onClick={() => toggleSort("score")} className="inline-flex items-center gap-1 hover:text-ink">Risk estimate {sortIcon("score")}</button>
                      </th>
                      <th scope="col" className="px-4 py-2 font-medium">Decision</th>
                      <th scope="col" aria-sort={ariaSort("time")} className="px-4 py-2 font-medium">
                        <button type="button" onClick={() => toggleSort("time")} className="inline-flex items-center gap-1 hover:text-ink">Time {sortIcon("time")}</button>
                      </th>
                      <th scope="col" className="px-4 py-2 font-medium sm:pr-6">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(({ item, rank }) => {
                      const isSelected = item.transaction_id === selectedId;
                      return (
                        <tr
                          key={item.transaction_id}
                          aria-selected={isSelected}
                          className={cx("selectable border-b border-line last:border-0 hover:bg-hover", isSelected && "bg-accent-soft")}
                        >
                          <td className="px-4 py-2.5 font-mono text-dim sm:pl-6">#{rank}</td>
                          <td className="px-4 py-2.5">
                            <button
                              type="button"
                              aria-pressed={isSelected}
                              aria-label={`Open alert ${item.transaction_id}`}
                              onClick={() => setParams({ tx: isSelected ? null : item.transaction_id })}
                              className="rounded font-mono whitespace-nowrap text-accent underline-offset-4 hover:underline"
                            >
                              {item.transaction_id}
                            </button>
                          </td>
                          <td className="px-4 py-2.5 font-mono tabular-nums">{formatScore(item.score)}</td>
                          <td className="px-4 py-2.5"><DecisionBadge decision={item.decision} /></td>
                          <td className="px-4 py-2.5 font-mono whitespace-nowrap text-dim">{item.timestamp}</td>
                          <td className="px-4 py-2.5 sm:pr-6">
                            <LinkButton href={`/simulation?transaction_id=${encodeURIComponent(item.transaction_id)}`}>
                              Investigate
                            </LinkButton>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <nav aria-label="Alert pages" className="flex items-center justify-between gap-4 border-t border-line p-4 sm:px-6">
              <p className="font-mono text-xs text-dim">
                Page {page + 1} of {pageCount} · {formatCount(total)} total
              </p>
              <div className="flex gap-2">
                <Button disabled={page === 0} onClick={() => setParams({ page: String(page - 1), tx: null })}>
                  Previous
                </Button>
                <Button disabled={page + 1 >= pageCount} onClick={() => setParams({ page: String(page + 1), tx: null })}>
                  Next
                </Button>
              </div>
            </nav>
          </Card>
        )}
      </SplitReveal>
    </>
  );
}

export default function AlertsPage() {
  return (
    <Suspense fallback={<PageHeader title="Alerts" description="Loading queue." />}>
      <AlertsWorkspace />
    </Suspense>
  );
}
