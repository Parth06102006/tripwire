"use client";

import { useQuery } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { useMemo } from "react";
import { ServiceBadge, type ServiceState } from "../components/ui/badge";
import { Card, CardHeader, Metadata, cx } from "../components/ui/card";
import { Button, LinkButton } from "../components/ui/controls";
import { Disclosure } from "../components/ui/motion";
import { PageHeader } from "../components/ui/page-header";
import { UnavailableState } from "../components/ui/states";
import { API_BASE_URL, ApiError } from "../lib/api";
import { formatDateTime, formatDurationMs } from "../lib/format";
import {
  percentile,
  probeBenchmarkArtifact,
  probeHealth,
  probeScoreArtifact,
  useProbeSamples,
  type ProbeName,
} from "../lib/probe";
import { useRunLog } from "../lib/run-log";

const REFRESH_MS = 30_000;

const PROBE_LABEL: Record<ProbeName, string> = {
  health: "Health endpoint",
  score_artifact: "Alert queue (score artifact)",
  benchmark_artifact: "Benchmarks (run artifact)",
};

function ServiceCard({
  name,
  state,
  children,
}: {
  name: string;
  state: ServiceState;
  children: React.ReactNode;
}) {
  return (
    <Card as="div" aria-label={`${name} status`}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-medium text-ink">{name}</h2>
        <ServiceBadge state={state} />
      </div>
      <div className="mt-3 flex flex-col gap-1 text-xs leading-5 text-dim">{children}</div>
    </Card>
  );
}

function errorText(error: unknown): string {
  return error instanceof ApiError ? error.detail : "Unexpected client error.";
}

export default function SystemPage() {
  const health = useQuery({ queryKey: ["system", "health"], queryFn: probeHealth, refetchInterval: REFRESH_MS, retry: false, staleTime: 0 });
  const score = useQuery({ queryKey: ["system", "score"], queryFn: probeScoreArtifact, refetchInterval: REFRESH_MS, retry: false, staleTime: 0 });
  const bench = useQuery({ queryKey: ["system", "bench"], queryFn: probeBenchmarkArtifact, refetchInterval: REFRESH_MS, retry: false, staleTime: 0 });
  const samples = useProbeSamples();
  const runs = useRunLog();

  const apiState: ServiceState = health.isPending ? "checking" : health.isError ? "failed" : "healthy";
  const graphState: ServiceState = health.isPending
    ? "checking"
    : health.isError
      ? "unknown"
      : health.data.falkordb === "available"
        ? "healthy"
        : health.data.falkordb === "unavailable"
          ? "failed"
          : "not_configured";
  const llmState: ServiceState = health.isPending
    ? "checking"
    : health.isError
      ? "unknown"
      : health.data.llm === "configured"
        ? "configured"
        : "not_configured";
  const artifactProbes = [score, bench];
  const artifactState: ServiceState = artifactProbes.some((probe) => probe.isPending)
    ? "checking"
    : artifactProbes.every((probe) => probe.isError)
      ? "failed"
      : artifactProbes.some((probe) => probe.isError)
        ? "degraded"
        : "healthy";

  const latency = useMemo(() => {
    return (Object.keys(PROBE_LABEL) as ProbeName[]).map((name) => {
      const mine = samples.filter((sample) => sample.name === name);
      const good = mine.filter((sample) => sample.ok).map((sample) => sample.ms);
      return {
        name,
        total: mine.length,
        failed: mine.length - good.length,
        last: mine[0]?.ms ?? null,
        p50: percentile(good, 0.5),
        p95: percentile(good, 0.95),
      };
    });
  }, [samples]);

  const failedRuns = runs.filter((run) => run.status === "failed");
  const fallbackRuns = runs.filter((run) => run.llmStatus === "fallback");
  const failures = useMemo(() => {
    const rows = [
      ...samples
        .filter((sample) => !sample.ok)
        .map((sample) => ({
          key: `probe-${sample.name}-${sample.at}`,
          at: sample.at,
          service: PROBE_LABEL[sample.name],
          summary: sample.detail ?? "Request failed.",
          runId: null as string | null,
          transactionId: null as string | null,
        })),
      ...failedRuns.map((run) => ({
        key: `run-${run.id}`,
        at: run.at,
        service: "Investigation API",
        summary: run.error ?? "Investigation failed.",
        runId: run.id,
        transactionId: run.transactionId,
      })),
      ...fallbackRuns.map((run) => ({
        key: `llm-${run.id}`,
        at: run.at,
        service: "LLM report agent",
        summary: `Fell back to the deterministic report${run.llmFallbackReason ? ` (${run.llmFallbackReason})` : ""}.`,
        runId: run.id,
        transactionId: run.transactionId,
      })),
    ];
    return rows.sort((a, b) => b.at.localeCompare(a.at));
  }, [samples, failedRuns, fallbackRuns]);

  const refreshing = health.isFetching || score.isFetching || bench.isFetching;
  const refresh = () => {
    void health.refetch();
    void score.refetch();
    void bench.refetch();
  };

  return (
    <>
      <PageHeader
        title="System"
        description="Service state from live checks against the API. Nothing here is inferred from past runs."
        actions={
          <Button onClick={refresh} disabled={refreshing}>
            <RefreshCw aria-hidden="true" className={cx("h-3.5 w-3.5", refreshing && "animate-spin")} />
            Run checks
          </Button>
        }
      />

      <section aria-label="Service health" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <ServiceCard name="API" state={apiState}>
          {health.data ? (
            <>
              <span>Version <span className="font-mono text-ink">{health.data.version}</span></span>
              <span>Responded in {formatDurationMs(latency.find((l) => l.name === "health")?.last ?? Number.NaN)}</span>
            </>
          ) : health.isError ? (
            <span className="text-critical">{errorText(health.error)}</span>
          ) : (
            <span>Checking.</span>
          )}
        </ServiceCard>
        <ServiceCard name="Graph service" state={graphState}>
          {health.isError ? (
            <span>Unknown while the API is unreachable.</span>
          ) : health.data ? (
            <span>
              FalkorDB reported <span className="font-mono text-ink">{health.data.falkordb}</span> by the API probe.
            </span>
          ) : (
            <span>Checking.</span>
          )}
        </ServiceCard>
        <ServiceCard name="LLM service" state={llmState}>
          {health.data ? (
            <span>
              {health.data.llm === "configured"
                ? "A provider and key are set. The API does not call the provider for this check, so reachability is unverified."
                : "No provider key set. Reports use the deterministic path."}
            </span>
          ) : health.isError ? (
            <span>Unknown while the API is unreachable.</span>
          ) : (
            <span>Checking.</span>
          )}
        </ServiceCard>
        <ServiceCard name="Artifacts" state={artifactState}>
          {[
            ["Score artifact", score],
            ["Benchmark artifact", bench],
          ].map(([label, probe]) => {
            const q = probe as typeof score;
            return (
              <span key={label as string}>
                {label as string}:{" "}
                <span className={q.isError ? "text-critical" : "text-ink"}>
                  {q.isPending ? "checking" : q.isError ? errorText(q.error) : "readable"}
                </span>
              </span>
            );
          })}
        </ServiceCard>
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card aria-label="Latency">
          <CardHeader
            title="Request latency"
            description="Browser round trips to the API during this session, refreshed every 30 s while this page is open."
          />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-line text-dim">
                  <th scope="col" className="py-2 pr-4 font-medium">Check</th>
                  <th scope="col" className="py-2 pr-4 font-medium">Last</th>
                  <th scope="col" className="py-2 pr-4 font-medium">P50</th>
                  <th scope="col" className="py-2 pr-4 font-medium">P95</th>
                  <th scope="col" className="py-2 font-medium">Samples</th>
                </tr>
              </thead>
              <tbody className="font-mono">
                {latency.map((row) => (
                  <tr key={row.name} className="border-b border-line last:border-0">
                    <td className="py-2 pr-4 font-sans">{PROBE_LABEL[row.name]}</td>
                    <td className="py-2 pr-4">{row.last === null ? "—" : formatDurationMs(row.last)}</td>
                    <td className="py-2 pr-4">{row.p50 === null ? "—" : formatDurationMs(row.p50)}</td>
                    <td className="py-2 pr-4">{row.p95 === null ? "—" : formatDurationMs(row.p95)}</td>
                    <td className="py-2">{row.total - row.failed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-[11px] text-dim">
            Includes network and proxy time. Server-side timings are in Benchmarks under recorded runtime measurements.
          </p>
        </Card>

        <Card aria-label="Failure counts">
          <CardHeader
            title="Errors and failures"
            description="Counted from this browser session only. The API exposes no error metrics."
          />
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Metadata label="Investigations run">{runs.length}</Metadata>
            <Metadata label="Failed">{failedRuns.length}</Metadata>
            <Metadata label="LLM fallbacks">{fallbackRuns.length}</Metadata>
            <Metadata label="Failed checks">{latency.reduce((sum, row) => sum + row.failed, 0)}</Metadata>
          </dl>
          {runs.length === 0 ? (
            <p className="mt-3 text-xs text-dim">No investigations have been run in this session.</p>
          ) : null}
        </Card>
      </div>

      <Card aria-label="Recent failures" padded={false}>
        <div className="p-4 pb-0 sm:px-6 sm:pt-6">
          <CardHeader title="Recent failures and diagnostics" description="Session scoped: failed checks, failed investigations and LLM fallbacks." />
        </div>
        {failures.length === 0 ? (
          <p className="px-6 pb-6 text-xs text-dim">No failures recorded in this session.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-left text-xs">
              <thead>
                <tr className="border-y border-line text-dim">
                  <th scope="col" className="px-4 py-2 font-medium sm:pl-6">Timestamp</th>
                  <th scope="col" className="px-4 py-2 font-medium">Service</th>
                  <th scope="col" className="px-4 py-2 font-medium">Error / summary</th>
                  <th scope="col" className="px-4 py-2 font-medium">Related run</th>
                  <th scope="col" className="px-4 py-2 font-medium sm:pr-6">Action</th>
                </tr>
              </thead>
              <tbody>
                {failures.slice(0, 20).map((row) => (
                  <tr key={row.key} className="border-b border-line last:border-0">
                    <td className="px-4 py-2.5 whitespace-nowrap text-dim sm:pl-6">{formatDateTime(row.at)}</td>
                    <td className="px-4 py-2.5">{row.service}</td>
                    <td className="px-4 py-2.5 text-dim">{row.summary}</td>
                    <td className="px-4 py-2.5 font-mono text-dim">{row.transactionId ?? "—"}</td>
                    <td className="px-4 py-2.5 sm:pr-6">
                      {row.transactionId ? (
                        <LinkButton href={`/simulation?transaction_id=${encodeURIComponent(row.transactionId)}`}>Open</LinkButton>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card aria-label="Diagnostic details">
        <CardHeader title="Tool traces and configuration" />
        <div className="flex flex-col gap-3">
          <Disclosure title="Tool traces from this session" badge={<span className="font-mono text-dim">{runs.filter((r) => r.toolTrace?.length).length}</span>}>
            {runs.filter((run) => run.toolTrace && run.toolTrace.length > 0).length === 0 ? (
              <p className="text-xs text-dim">No tool traces yet. Run an investigation in Simulation.</p>
            ) : (
              <div className="flex flex-col gap-4">
                {runs
                  .filter((run) => run.toolTrace && run.toolTrace.length > 0)
                  .slice(0, 5)
                  .map((run) => (
                    <div key={run.id} className="overflow-x-auto">
                      <p className="mb-1 text-xs text-ink">
                        <span className="font-mono">{run.transactionId}</span>
                        <span className="text-dim"> · {formatDateTime(run.at)} · {run.outcome ?? "outcome not reported"}</span>
                      </p>
                      <table className="w-full min-w-[420px] text-left text-[11px]">
                        <tbody className="font-mono">
                          {run.toolTrace?.map((entry) => (
                            <tr key={entry.tool_run_id} className="border-t border-line">
                              <td className="py-1 pr-2">{entry.tool}</td>
                              <td className="pr-2">{entry.origin}/{entry.transport}</td>
                              <td className="pr-2">{entry.status === "error" ? "error" : entry.outcome}</td>
                              <td className="pr-2">{entry.result_count} results</td>
                              <td>{formatDurationMs(entry.duration_ms)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ))}
              </div>
            )}
          </Disclosure>
          <Disclosure title="Configuration (safe values only)">
            <dl className="grid gap-3 sm:grid-cols-2">
              <Metadata label="API origin">{API_BASE_URL === "" ? "Same origin, proxied from /api" : API_BASE_URL}</Metadata>
              <Metadata label="API version">{health.data?.version ?? "Unavailable"}</Metadata>
              <Metadata label="FalkorDB">{health.data?.falkordb ?? "Unavailable"}</Metadata>
              <Metadata label="LLM provider">{health.data?.llm ?? "Unavailable"}</Metadata>
            </dl>
            <p className="mt-3 text-[11px] text-dim">
              Keys, tokens and environment variables are never read or displayed by this console.
            </p>
          </Disclosure>
        </div>
      </Card>

      <UnavailableState
        label="Server logs unavailable"
        title="Server logs and request metrics are not exposed"
        message="The API has no logs or metrics endpoint, so request counts, server error rates and log streams are not shown. They will appear here once the API provides them."
      />
    </>
  );
}
