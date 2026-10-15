"use client";

import { useQuery } from "@tanstack/react-query";
import { ApiError, healthQuery } from "../lib/api";
import { ErrorPanel, LoadingPanel } from "../components/status";

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.detail;
  return "Something went wrong while checking service health.";
}

export default function SystemPage() {
  const query = useQuery(healthQuery);

  return (
    <main className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">System</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#9693A8]">
          API and FalkorDB health from the configured local replay services.
        </p>
      </header>
      {query.isPending ? (
        <LoadingPanel
          title="Checking services"
          message="Reading API and graph status."
          label="System status loading"
        />
      ) : query.isError ? (
        <ErrorPanel
          title="Service status unavailable"
          message={errorMessage(query.error)}
          label="System status error"
          onRetry={() => query.refetch()}
        />
      ) : (
        <section
          aria-label="System status"
          className="grid gap-4 rounded-lg border border-[#292936] bg-[#12121A] p-4 sm:grid-cols-3"
        >
          <div>
            <p className="text-xs text-[#9693A8]">API</p>
            <p className="mt-1 font-mono text-sm">{query.data.status}</p>
          </div>
          <div>
            <p className="text-xs text-[#9693A8]">FalkorDB</p>
            <p className="mt-1 font-mono text-sm">{query.data.falkordb}</p>
          </div>
          <div>
            <p className="text-xs text-[#9693A8]">API version</p>
            <p className="mt-1 font-mono text-sm">{query.data.version}</p>
          </div>
        </section>
      )}
    </main>
  );
}
