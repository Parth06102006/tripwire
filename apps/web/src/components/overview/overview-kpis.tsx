"use client";

import type { ReactNode } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { useAlerts } from "@/hooks/use-alerts";
import { useCaseCounts } from "@/hooks/use-cases";
import { formatInteger } from "@/lib/formatters";

function Kpi({
  label,
  value,
  detail,
  pending,
  failed,
}: {
  label: string;
  value: ReactNode;
  detail: ReactNode;
  pending: boolean;
  failed: boolean;
}) {
  return (
    <div className="min-w-0 rounded-lg border border-border bg-surface px-3 py-2.5 sm:px-4 sm:py-3">
      <p className="truncate text-xs text-fg-secondary">{label}</p>
      {pending ? (
        <Skeleton className="mt-1.5 h-7 w-24" />
      ) : (
        <p className="mt-0.5 text-lg font-semibold tracking-tight text-fg sm:text-xl">
          {failed ? <span className="text-base text-fg-muted">Unavailable</span> : value}
        </p>
      )}
      <p className="mt-0.5 hidden text-2xs text-fg-muted sm:block">{detail}</p>
    </div>
  );
}

export function OverviewKpis() {
  // Shares the queue's first page in the cache, so this costs no extra request.
  const alerts = useAlerts({ limit: 50, offset: 0 });
  const cases = useCaseCounts();
  const counts = cases.data;

  return (
    <div className="grid grid-cols-3 gap-2 sm:gap-3">
      <Kpi
        label="Scored transactions"
        value={alerts.data ? formatInteger(alerts.data.scored_total ?? alerts.data.total) : null}
        detail="Replay cohort, ranked by model score"
        pending={alerts.isPending}
        failed={alerts.isError}
      />
      <Kpi
        label="Open cases"
        value={counts ? formatInteger(counts.suspected + counts.under_review) : null}
        detail="Waiting for an analyst decision"
        pending={cases.isPending}
        failed={cases.isError}
      />
      <Kpi
        label="Analyst decisions"
        value={counts ? formatInteger(counts.confirmed + counts.dismissed) : null}
        detail={
          counts
            ? `${formatInteger(counts.confirmed)} confirmed, ${formatInteger(counts.dismissed)} dismissed`
            : "Confirmed and dismissed cases"
        }
        pending={cases.isPending}
        failed={cases.isError}
      />
    </div>
  );
}
