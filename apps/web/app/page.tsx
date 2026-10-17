"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import type { Route } from "next";
import { useMemo } from "react";
import GraphPreview from "./components/graph/graph-preview";
import { StatusBadge, type Tone } from "./components/ui/badge";
import { Card, CardHeader } from "./components/ui/card";
import { LinkButton } from "./components/ui/controls";
import { KpiCard, type KpiState } from "./components/ui/kpi-card";
import { PageHeader } from "./components/ui/page-header";
import {
  ApiError,
  alertsQuery,
  casesQuery,
  fetchReviewQueueSummary,
  healthQuery,
  type CaseStatus,
} from "./lib/api";
import { formatCount, formatRelative } from "./lib/format";
import { useRunLog } from "./lib/run-log";

function message(error: unknown): string {
  return error instanceof ApiError ? error.detail : "Request failed.";
}

const STATUS_LABEL: Record<CaseStatus, { label: string; tone: Tone }> = {
  suspected: { label: "Suspected", tone: "warning" },
  under_review: { label: "Under review", tone: "warning" },
  confirmed: { label: "Confirmed", tone: "critical" },
  dismissed: { label: "Dismissed", tone: "neutral" },
};

interface ActivityItem {
  key: string;
  at: string;
  text: string;
  href: string;
}

export default function OverviewPage() {
  const summary = useQuery({ queryKey: ["review-queue-summary"] as const, queryFn: fetchReviewQueueSummary });
  const suspected = useQuery(casesQuery("suspected", 25));
  const underReview = useQuery(casesQuery("under_review", 25));
  const recentCases = useQuery(casesQuery(null, 25));
  const topAlert = useQuery(alertsQuery(1, 0));
  const health = useQuery({ ...healthQuery, refetchInterval: 60_000 });
  const runs = useRunLog();

  const activeCaseTotal =
    suspected.data && underReview.data ? suspected.data.total + underReview.data.total : null;
  const openCases = useMemo(
    () =>
      [...(suspected.data?.items ?? []), ...(underReview.data?.items ?? [])].sort((a, b) =>
        b.updated_at.localeCompare(a.updated_at),
      ),
    [suspected.data, underReview.data],
  );

  const activity = useMemo<ActivityItem[]>(() => {
    const fromCases = (recentCases.data?.items ?? []).flatMap((item) =>
      item.history.map((entry) => ({
        key: `case-${entry.review_id}`,
        at: entry.timestamp,
        text: `Case ${item.case_id} ${entry.action === "open" ? "opened" : entry.action === "enrich" ? "enriched" : entry.action === "confirm" ? "confirmed" : "dismissed"} by ${entry.reviewer_id}`,
        href: `/cases?case=${encodeURIComponent(item.case_id)}`,
      })),
    );
    const fromRuns = runs.map((run) => ({
      key: `run-${run.id}`,
      at: run.at,
      text:
        run.status === "failed"
          ? `Investigation of ${run.transactionId} failed`
          : `Investigation of ${run.transactionId} completed${run.decision ? ` (${run.decision})` : ""}`,
      href: `/simulation?transaction_id=${encodeURIComponent(run.transactionId)}`,
    }));
    return [...fromCases, ...fromRuns].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 8);
  }, [recentCases.data, runs]);

  const failures = runs.filter((run) => run.status === "failed" || run.llmStatus === "fallback");

  const previewTransaction =
    openCases[0]?.transaction_id ?? topAlert.data?.items[0]?.transaction_id ?? null;
  const previewSource = openCases[0]
    ? `Newest open case ${openCases[0].case_id}`
    : topAlert.data?.items[0]
      ? "Top-ranked alert"
      : null;

  const alertsKpi: KpiState = summary.isPending
    ? { kind: "loading" }
    : summary.isError
      ? { kind: "error", message: message(summary.error) }
      : { kind: "ready", value: formatCount(summary.data.reviewCount) };
  const casesKpi: KpiState =
    suspected.isError || underReview.isError
      ? { kind: "error", message: message(suspected.error ?? underReview.error) }
      : activeCaseTotal === null
        ? { kind: "loading" }
        : { kind: "ready", value: formatCount(activeCaseTotal) };

  const healthKpi: KpiState = health.isPending
    ? { kind: "loading" }
    : health.isError
      ? { kind: "error", message: message(health.error) }
      : { kind: "ready", value: health.data.falkordb === "available" ? "Healthy" : health.data.falkordb === "unavailable" ? "Degraded" : "Partial" };

  return (
    <>
      <PageHeader
        title="Overview"
        description="Where investigation work stands right now: alerts awaiting review, active cases and service state."
        actions={<LinkButton variant="primary" href="/simulation">New investigation</LinkButton>}
      />

      <section aria-label="Key figures" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Alerts for review"
          state={alertsKpi}
          note={summary.data ? `of ${formatCount(summary.data.total)} scored. Alerts have no separate open or closed status.` : undefined}
          href="/alerts"
        />
        <KpiCard
          label="Active cases"
          state={casesKpi}
          note={
            suspected.data && underReview.data
              ? `${suspected.data.total} suspected, ${underReview.data.total} under review`
              : undefined
          }
          href="/cases"
        />
        <KpiCard
          label="Investigations this session"
          state={{ kind: "ready", value: formatCount(runs.length) }}
          note="Counted in this browser. The API keeps no run history."
          href="/simulation"
        />
        <KpiCard
          label="Service health"
          state={healthKpi}
          note={
            health.data
              ? `API up · FalkorDB ${health.data.falkordb.replace("_", " ")} · LLM ${(health.data.llm ?? "not_configured").replace("_", " ")}`
              : undefined
          }
          href="/system"
        />
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card aria-label="Recent investigation activity">
          <CardHeader title="Recent investigation activity" description="Case history and investigations from this session." />
          {recentCases.isPending ? (
            <div role="status" aria-label="Loading activity" className="skeleton h-24 w-full" />
          ) : activity.length === 0 ? (
            <p className="text-xs text-dim">
              {recentCases.isError
                ? `Case history unavailable: ${message(recentCases.error)}`
                : "No recorded activity yet."}
            </p>
          ) : (
            <ul className="flex flex-col">
              {activity.map((item) => (
                <li key={item.key} className="border-b border-line last:border-0">
                  <Link
                    href={item.href as Route}
                    className="selectable flex items-baseline justify-between gap-3 rounded px-1 py-2 text-xs hover:bg-hover"
                  >
                    <span className="text-ink">{item.text}</span>
                    <span className="shrink-0 text-dim">{formatRelative(item.at)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {recentCases.isError && activity.length > 0 ? (
            <p className="mt-2 text-[11px] text-warning">Case history unavailable: {message(recentCases.error)}</p>
          ) : null}
        </Card>

        {previewTransaction ? (
          <GraphPreview
            key={previewTransaction}
            transactionId={previewTransaction}
            autoLoad
            title={`Graph preview${previewSource ? `: ${previewSource.toLowerCase()}` : ""}`}
          />
        ) : (
          <Card aria-label="Graph preview">
            <CardHeader title="Graph preview" />
            <p className="text-xs text-dim">
              {topAlert.isError ? `Alert queue unavailable: ${message(topAlert.error)}` : topAlert.isPending ? "Loading." : "Nothing to preview yet."}
            </p>
          </Card>
        )}

        <Card aria-label="Cases requiring review">
          <CardHeader
            title="Cases requiring review"
            description="Suspected or under review, newest first."
            actions={<LinkButton href="/cases">All cases</LinkButton>}
          />
          {suspected.isPending || underReview.isPending ? (
            <div role="status" aria-label="Loading cases" className="skeleton h-24 w-full" />
          ) : suspected.isError || underReview.isError ? (
            <p role="alert" className="text-xs text-critical">
              Cases unavailable: {message(suspected.error ?? underReview.error)}
            </p>
          ) : openCases.length === 0 ? (
            <p className="text-xs text-dim">No cases are waiting for review.</p>
          ) : (
            <ul>
              {openCases.slice(0, 5).map((item) => (
                <li key={item.case_id} className="border-b border-line last:border-0">
                  <Link
                    href={`/cases?case=${encodeURIComponent(item.case_id)}` as Route}
                    className="selectable flex items-center justify-between gap-3 rounded px-1 py-2 text-xs hover:bg-hover"
                  >
                    <span className="min-w-0">
                      <span className="block font-mono text-ink">{item.case_id}</span>
                      <span className="block truncate font-mono text-dim">{item.transaction_id}</span>
                    </span>
                    <span className="flex shrink-0 flex-col items-end gap-1">
                      <StatusBadge tone={STATUS_LABEL[item.status].tone}>{STATUS_LABEL[item.status].label}</StatusBadge>
                      <span className="text-dim">{formatRelative(item.updated_at)}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card aria-label="Recent execution failures">
          <CardHeader
            title="Recent execution failures"
            description="Failed investigations and LLM fallbacks from this session."
            actions={<LinkButton href="/system">Diagnostics</LinkButton>}
          />
          {failures.length === 0 ? (
            <p className="text-xs text-dim">
              No failures in this session. The API does not store run history, so earlier failures
              cannot be listed.
            </p>
          ) : (
            <ul>
              {failures.slice(0, 5).map((run) => (
                <li key={run.id} className="border-b border-line last:border-0">
                  <Link
                    href={`/simulation?transaction_id=${encodeURIComponent(run.transactionId)}` as Route}
                    className="selectable flex items-center justify-between gap-3 rounded px-1 py-2 text-xs hover:bg-hover"
                  >
                    <span className="min-w-0">
                      <span className="block font-mono text-ink">{run.transactionId}</span>
                      <span className="block text-dim">
                        {run.status === "failed"
                          ? (run.error ?? "Failed")
                          : `LLM fell back to deterministic report${run.llmFallbackReason ? ` (${run.llmFallbackReason})` : ""}`}
                      </span>
                    </span>
                    <span className="flex shrink-0 flex-col items-end gap-1">
                      <StatusBadge tone={run.status === "failed" ? "critical" : "warning"}>
                        {run.status === "failed" ? "Failed" : "Fallback"}
                      </StatusBadge>
                      <span className="text-dim">{formatRelative(run.at)}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
