"use client";

import { TriangleAlert } from "lucide-react";

import { CapacityPanel } from "@/components/performance/capacity-panel";
import { CostPanel } from "@/components/performance/cost-panel";
import { DetectionBenchmarks } from "@/components/performance/detection-benchmarks";
import { LatencyPanel } from "@/components/performance/latency-panel";
import { EmptyState, ErrorState, Mono } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useBenchmarks } from "@/hooks/use-benchmarks";
import { describeApiError } from "@/lib/api-client";
import type { PerformanceSummary } from "@/lib/api-schemas";

function Provenance({ performance }: { performance: PerformanceSummary }) {
  const caveat = /not idle|upper bound|contaminat/i.test(performance.execution_mode);
  return (
    <section
      className="rounded-lg border border-border bg-surface p-4"
      aria-labelledby="provenance-heading"
    >
      <h2 id="provenance-heading" className="text-sm font-semibold">
        Recorded run, measured {performance.measured_on}
      </h2>
      <dl className="mt-2 grid gap-x-6 gap-y-1.5 text-xs sm:grid-cols-[9rem_1fr]">
        <dt className="text-fg-muted">Dataset</dt>
        <dd>{performance.dataset_label}</dd>
        <dt className="text-fg-muted">Graph scope</dt>
        <dd>{performance.graph_scope}</dd>
        <dt className="text-fg-muted">Hardware</dt>
        <dd>{performance.hardware}</dd>
        {performance.run_id ? (
          <>
            <dt className="text-fg-muted">Run</dt>
            <dd>
              <Mono>{performance.run_id}</Mono>
              {performance.git_commit ? (
                <>
                  {" "}
                  at commit <Mono>{performance.git_commit.slice(0, 10)}</Mono>
                </>
              ) : null}
            </dd>
          </>
        ) : null}
        <dt className="text-fg-muted">Execution</dt>
        <dd className={caveat ? "flex gap-1.5 text-warning" : undefined}>
          {caveat ? (
            <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-label="Caveat" />
          ) : null}
          {performance.execution_mode}
        </dd>
      </dl>
      <p className="mt-3 text-[11px] text-fg-muted">
        These figures are read from the benchmark artifact the API serves. They describe that run on
        a synthetic dataset, not live traffic.
      </p>
    </section>
  );
}

export function PerformanceView() {
  const benchmarks = useBenchmarks();

  if (benchmarks.isPending) {
    return (
      <div className="space-y-4" aria-busy>
        <Skeleton className="h-36 w-full" />
        <Skeleton className="h-80 w-full" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }
  if (benchmarks.isError) {
    return (
      <ErrorState
        title="Benchmarks could not be loaded"
        message={describeApiError(benchmarks.error)}
        action={
          <Button size="sm" onClick={() => benchmarks.refetch()}>
            Try again
          </Button>
        }
      />
    );
  }

  const { models, performance } = benchmarks.data;
  return (
    <div className="space-y-4">
      {performance ? <Provenance performance={performance} /> : null}
      {Object.keys(models).length > 0 ? (
        <DetectionBenchmarks models={models} />
      ) : (
        <EmptyState icon={TriangleAlert} title="No model metrics were served" />
      )}
      {performance ? (
        <>
          <LatencyPanel performance={performance} />
          <CapacityPanel performance={performance} />
          <CostPanel performance={performance} />
        </>
      ) : (
        <EmptyState icon={TriangleAlert} title="No performance snapshot is configured">
          Set TRACEAML_PERFORMANCE_PATH on the API host to serve latency, capacity and cost.
        </EmptyState>
      )}
    </div>
  );
}
