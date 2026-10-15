"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ApiError, alertsQuery } from "../lib/api";
import { formatScore } from "../lib/format";
import { DecisionBadge, EmptyPanel, ErrorPanel, LoadingPanel } from "../components/status";

const PAGE_SIZE = 25;

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.detail;
  return "Something went wrong while loading alerts.";
}

export default function AlertsPage() {
  const [page, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const query = useQuery(alertsQuery(PAGE_SIZE, page * PAGE_SIZE));

  const total = query.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const selected = query.data?.items.find(
    (item) => item.transaction_id === selectedId,
  );

  return (
    <main className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Alerts</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#9693A8]">
          Ranked replay queue. Scores and decisions come from the API; selecting
          a row reveals investigation details.
        </p>
      </header>

      <div aria-live="polite" className="sr-only">
        {query.isPending
          ? "Loading alerts."
          : query.isError
            ? "Alerts failed to load."
            : `Showing page ${page + 1} of ${pageCount}, ${total} alerts total.`}
      </div>

      {query.isPending ? (
        <LoadingPanel
          title="Loading alerts"
          message="Fetching the ranked queue from the API."
          label="Alerts loading"
        />
      ) : query.isError ? (
        <ErrorPanel
          title="Alerts unavailable"
          message={errorMessage(query.error)}
          label="Alerts error"
          onRetry={() => query.refetch()}
        />
      ) : query.data.items.length === 0 ? (
        <EmptyPanel
          title="No alerts in queue"
          message="The API returned an empty ranked queue."
          label="Alerts empty"
        />
      ) : (
        <section aria-label="Alert queue" className="flex flex-col gap-4">
          <div className="overflow-x-auto rounded-lg border border-[#292936] bg-[#12121A]">
            <table className="w-full min-w-[640px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-[#292936] text-xs text-[#9693A8]">
                  <th scope="col" className="px-4 py-3 font-medium">
                    Timestamp
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Transaction
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Score
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Decision
                  </th>
                </tr>
              </thead>
              <tbody>
                {query.data.items.map((item) => {
                  const selected = item.transaction_id === selectedId;
                  return (
                    <tr
                      key={item.transaction_id}
                      className={`border-b border-[#292936] transition-colors last:border-0 hover:bg-[#191923] ${
                        selected ? "bg-[#191923]" : ""
                      }`}
                    >
                      <td className="px-4 py-3 font-mono text-xs text-[#9693A8]">
                        {item.timestamp}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedId(selected ? null : item.transaction_id)
                          }
                          aria-pressed={selected}
                          aria-label={`Select alert ${item.transaction_id}`}
                          className="rounded font-mono text-xs text-[#B68CFF] underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-[#B68CFF]"
                        >
                          {item.transaction_id}
                        </button>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">
                        {formatScore(item.score)}
                      </td>
                      <td className="px-4 py-3">
                        <DecisionBadge decision={item.decision} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {selected ? (
            <div className="flex flex-col gap-2 rounded-lg border border-[#B68CFF]/40 bg-[#12121A] p-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="font-mono text-xs text-[#9693A8]">
                Selected{" "}
                <span className="text-[#F2F0F8]">{selected.transaction_id}</span>{" "}
                · score {formatScore(selected.score)} · {selected.decision}
              </p>
              <Link
                href={`/investigations?transaction_id=${encodeURIComponent(selected.transaction_id)}`}
                className="inline-flex items-center justify-center rounded-md bg-[#B68CFF] px-4 py-2 text-sm font-semibold text-[#0B0B10] transition-colors hover:bg-[#C7A9FF] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#B68CFF]"
              >
                Investigate
              </Link>
            </div>
          ) : null}

          <nav
            aria-label="Alert pages"
            className="flex items-center justify-between gap-4"
          >
            <p className="font-mono text-xs text-[#9693A8]">
              Page {page + 1} of {pageCount} · {total} total
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page === 0}
                onClick={() => {
                  setPage((value) => Math.max(0, value - 1));
                  setSelectedId(null);
                }}
                className="rounded-md border border-[#292936] bg-[#191923] px-4 py-2 text-sm font-medium transition-colors hover:border-[#B68CFF] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-[#B68CFF]"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={page + 1 >= pageCount}
                onClick={() => {
                  setPage((value) => value + 1);
                  setSelectedId(null);
                }}
                className="rounded-md border border-[#292936] bg-[#191923] px-4 py-2 text-sm font-medium transition-colors hover:border-[#B68CFF] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-[#B68CFF]"
              >
                Next
              </button>
            </div>
          </nav>
        </section>
      )}
    </main>
  );
}
