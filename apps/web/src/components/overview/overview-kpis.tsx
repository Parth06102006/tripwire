"use client";

import { Activity, Database, FolderCheck, ShieldAlert } from "lucide-react";
import type { ReactNode } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { useAlerts } from "@/hooks/use-alerts";
import { useCaseCounts } from "@/hooks/use-cases";
import { useHealth } from "@/hooks/use-health";
import { formatInteger } from "@/lib/formatters";

function TelemetryCard({
  icon: Icon,
  label,
  value,
  subvalue,
  children,
  pending,
  failed,
}: {
  icon: typeof Activity;
  label: string;
  value: ReactNode;
  subvalue?: ReactNode;
  children?: ReactNode;
  pending: boolean;
  failed: boolean;
}) {
  return (
    <div className="relative flex flex-col justify-between overflow-hidden rounded-lg border border-border bg-surface p-3.5 sm:p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-fg-secondary">{label}</span>
        <Icon className="size-4 text-fg-muted" aria-hidden />
      </div>

      <div className="mt-2 min-w-0">
        {pending ? (
          <Skeleton className="h-7 w-28" />
        ) : failed ? (
          <p className="text-sm text-fg-muted">Unavailable</p>
        ) : (
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-bold tracking-tight text-fg sm:text-2xl">{value}</span>
            {subvalue ? <span className="text-xs text-fg-muted">{subvalue}</span> : null}
          </div>
        )}
      </div>

      {children ? <div className="mt-2.5">{children}</div> : null}
    </div>
  );
}

export function OverviewKpis() {
  const alerts = useAlerts({ limit: 50, offset: 0 });
  const cases = useCaseCounts();
  const health = useHealth();

  const counts = cases.data;
  const alertData = alerts.data;
  const routeCounts = alertData?.route_counts;
  const scoredTotal = alertData?.scored_total ?? alertData?.total ?? 0;

  const blockedCount = routeCounts?.blocked_by_rule ?? 0;
  const reviewCount = routeCounts?.flagged_for_review ?? 0;
  const standardCount = routeCounts?.standard_path ?? 0;
  const routeTotal = blockedCount + reviewCount + standardCount || 1;

  const blockedPct = ((blockedCount / routeTotal) * 100).toFixed(1);
  const reviewPct = ((reviewCount / routeTotal) * 100).toFixed(1);

  const falkorStatus = health.data?.falkordb ?? "unknown";
  const isGraphAvailable = falkorStatus === "available";

  return (
    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
      <TelemetryCard
        icon={Activity}
        label="Scored transactions"
        value={alertData ? formatInteger(scoredTotal) : null}
        subvalue="events"
        pending={alerts.isPending}
        failed={alerts.isError}
      >
        <p className="truncate text-2xs text-fg-muted">
          Synthetic replay cohort, ranked by model risk score
        </p>
      </TelemetryCard>

      <TelemetryCard
        icon={ShieldAlert}
        label="Risk triage"
        value={
          alertData ? (
            <span className="text-warning">{formatInteger(blockedCount + reviewCount)}</span>
          ) : null
        }
        subvalue="priority alerts"
        pending={alerts.isPending}
        failed={alerts.isError}
      >
        <div className="space-y-1.5">
          <div
            className="flex h-1.5 w-full overflow-hidden rounded-full bg-surface-sunken"
            aria-hidden
          >
            <div
              className="bg-critical transition-all"
              style={{ width: `${Math.max(2, (blockedCount / routeTotal) * 100)}%` }}
              title={`Blocked: ${blockedCount} (${blockedPct}%)`}
            />
            <div
              className="bg-warning transition-all"
              style={{ width: `${Math.max(2, (reviewCount / routeTotal) * 100)}%` }}
              title={`Review: ${reviewCount} (${reviewPct}%)`}
            />
            <div
              className="bg-fg-muted/40 transition-all"
              style={{ width: `${Math.max(2, (standardCount / routeTotal) * 100)}%` }}
              title={`Standard: ${standardCount}`}
            />
          </div>
          <div className="flex items-center justify-between text-2xs text-fg-muted">
            <span className="inline-flex items-center gap-1">
              <span className="size-1.5 rounded-full bg-critical" />
              Rule: {formatInteger(blockedCount)}
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="size-1.5 rounded-full bg-warning" />
              Review: {formatInteger(reviewCount)}
            </span>
          </div>
        </div>
      </TelemetryCard>

      <TelemetryCard
        icon={FolderCheck}
        label="Case decisions"
        value={counts ? formatInteger(counts.confirmed + counts.dismissed) : null}
        subvalue={`of ${counts ? formatInteger(counts.suspected + counts.under_review + counts.confirmed + counts.dismissed) : 0}`}
        pending={cases.isPending}
        failed={cases.isError}
      >
        <div className="flex items-center justify-between text-2xs text-fg-muted">
          <span>
            {counts
              ? `${formatInteger(counts.suspected + counts.under_review)} pending`
              : "Loading"}
          </span>
          <span className="text-safe">
            {counts ? `${formatInteger(counts.confirmed)} confirmed` : ""}
          </span>
        </div>
      </TelemetryCard>

      <TelemetryCard
        icon={Database}
        label="Graph engine"
        value={
          health.isPending ? null : (
            <span className={isGraphAvailable ? "text-safe" : "text-critical"}>
              {isGraphAvailable ? "FalkorDB Online" : "Disconnected"}
            </span>
          )
        }
        pending={health.isPending}
        failed={health.isError}
      >
        <div className="flex items-center justify-between text-2xs text-fg-muted">
          <span>{health.data?.version ? `API v${health.data.version}` : "Tripwire engine"}</span>
          <span className="font-mono">
            {health.data?.llm === "configured" ? "Agent active" : "Deterministic"}
          </span>
        </div>
      </TelemetryCard>
    </div>
  );
}
