"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import {
  ApiError,
  postInvestigation,
  type InvestigationRequest,
  type InvestigationResponse,
} from "../lib/api";
import {
  formatAmount,
  formatDurationMs,
  formatScore,
} from "../lib/format";
import { DecisionBadge, EmptyPanel, ErrorPanel, LoadingPanel } from "../components/status";
import EvidenceGraph, { type SelectedElement } from "../components/evidence-graph";

const DEFAULTS: InvestigationRequest = {
  transaction_id: "",
  max_hops: 2,
  time_window_seconds: 86400,
  result_limit: 50,
};

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 404) return "That transaction ID is unknown to the graph.";
    if (error.status === 503) return "Graph or scoring service unavailable. Retry shortly.";
    return error.detail;
  }
  return "Something went wrong while running the investigation.";
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs text-[#9693A8]">
      <span className="font-medium">{label}</span>
      {children}
      <span className="text-[11px]">{hint}</span>
    </label>
  );
}

const inputClassName =
  "rounded-md border border-[#292936] bg-[#191923] px-3 py-2 font-mono text-sm text-[#F2F0F8] focus-visible:outline-2 focus-visible:outline-[#B68CFF]";

function InvestigationWorkspace() {
  const searchParams = useSearchParams();
  const preset = searchParams.get("transaction_id")?.trim() || null;
  const [form, setForm] = useState<InvestigationRequest>(() =>
    preset ? { ...DEFAULTS, transaction_id: preset } : DEFAULTS,
  );
  const [selection, setSelection] = useState<SelectedElement | null>(null);
  const mutation = useMutation({
    mutationFn: postInvestigation,
  });
  const autoRan = useRef(false);

  useEffect(() => {
    if (autoRan.current || !preset) return;
    autoRan.current = true;
    mutation.mutate({ ...DEFAULTS, transaction_id: preset });
    // Deep-linked auto-run fires once; later edits are user-driven.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset]);

  const result: InvestigationResponse | undefined = mutation.data ?? undefined;

  const set = <K extends keyof InvestigationRequest>(key: K, value: InvestigationRequest[K]) => {
    setForm((previous) => ({ ...previous, [key]: value }));
  };

  const selectedTransaction = result?.evidence.transactions.find(
    (tx) => selection?.kind === "transaction" && tx.transaction_id === selection.id,
  );
  const relatedTransfers = result?.evidence.transactions.filter(
    (tx) =>
      selection?.kind === "account" &&
      (tx.source_account_key === selection.id ||
        tx.destination_account_key === selection.id),
  );

  return (
    <main className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Investigations</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#9693A8]">
          Run a bounded graph investigation. Paths, records, and the report
          below come from the backend response — nothing is drawn from local
          guesses.
        </p>
      </header>

      <form
        aria-label="Investigation request"
        className="grid gap-4 rounded-lg border border-[#292936] bg-[#12121A] p-4 sm:grid-cols-2 lg:grid-cols-5"
        onSubmit={(event) => {
          event.preventDefault();
          setSelection(null);
          mutation.mutate(form);
        }}
      >
        <Field label="Transaction ID" hint="Required. Must exist in the graph.">
          <input
            required
            value={form.transaction_id}
            onChange={(event) => set("transaction_id", event.target.value)}
            placeholder="tx_…"
            className={inputClassName}
          />
        </Field>
        <Field label="Max hops" hint="Integer 1–3.">
          <input
            type="number"
            min={1}
            max={3}
            step={1}
            value={form.max_hops}
            onChange={(event) => set("max_hops", Number(event.target.value))}
            className={inputClassName}
          />
        </Field>
        <Field label="Time window (s)" hint="Integer 1–2592000.">
          <input
            type="number"
            min={1}
            max={2592000}
            step={1}
            value={form.time_window_seconds}
            onChange={(event) => set("time_window_seconds", Number(event.target.value))}
            className={inputClassName}
          />
        </Field>
        <Field label="Result limit" hint="Integer 1–100.">
          <input
            type="number"
            min={1}
            max={100}
            step={1}
            value={form.result_limit}
            onChange={(event) => set("result_limit", Number(event.target.value))}
            className={inputClassName}
          />
        </Field>
        <div className="flex items-end">
          <button
            type="submit"
            disabled={mutation.isPending || form.transaction_id.trim().length === 0}
            className="w-full rounded-md bg-[#B68CFF] px-4 py-2 text-sm font-semibold text-[#0B0B10] transition-colors hover:bg-[#C7A9FF] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#B68CFF] sm:w-auto"
          >
            {mutation.isPending ? "Running…" : "Investigate"}
          </button>
        </div>
      </form>

      <div aria-live="polite" className="sr-only">
        {mutation.isPending
          ? "Investigation running."
          : mutation.isError
            ? "Investigation failed."
            : result
              ? `Investigation complete for ${result.transaction_id}.`
              : "No investigation run yet."}
      </div>

      {mutation.isPending ? (
        <LoadingPanel
          title="Running investigation"
          message="Querying bounded graph evidence from the backend."
          label="Investigation loading"
        />
      ) : mutation.isError ? (
        <ErrorPanel
          title="Investigation failed"
          message={errorMessage(mutation.error)}
          label="Investigation error"
          onRetry={() => mutation.mutate(form)}
        />
      ) : !result ? (
        <EmptyPanel
          title="No investigation selected"
          message="Enter a transaction ID above, or open one from the alert queue."
          label="Investigations empty"
        />
      ) : (
        <div className="flex flex-col gap-6">
          <section
            aria-label="Decision summary"
            className="grid gap-4 rounded-lg border border-[#292936] bg-[#12121A] p-4 sm:grid-cols-2 lg:grid-cols-4"
          >
            <div>
              <p className="text-xs text-[#9693A8]">Transaction</p>
              <p className="mt-1 font-mono text-sm">{result.transaction_id}</p>
            </div>
            <div>
              <p className="text-xs text-[#9693A8]">Risk score (model output)</p>
              <p className="mt-1 font-mono text-sm">{formatScore(result.risk_score)}</p>
            </div>
            <div>
              <p className="text-xs text-[#9693A8]">Policy decision</p>
              <p className="mt-1">
                <DecisionBadge decision={result.decision} />
              </p>
            </div>
            <div>
              <p className="text-xs text-[#9693A8]">Query time (measured)</p>
              <p className="mt-1 font-mono text-sm">
                {formatDurationMs(result.evidence.query_duration_ms)}
              </p>
            </div>
          </section>

          {result.report ? (
            <section
              aria-label="Deterministic report"
              className="rounded-lg border border-[#292936] bg-[#12121A] p-4"
            >
              <h2 className="text-sm font-semibold">Report (deterministic)</h2>
              <p className="mt-2 text-sm leading-6">{result.report.hypothesis}</p>
              <dl className="mt-3 grid gap-2 font-mono text-xs text-[#9693A8] sm:grid-cols-3">
                <div>
                  <dt>Supporting transfers</dt>
                  <dd className="mt-1 text-[#F2F0F8]">
                    {result.report.supporting_transaction_ids.length === 0
                      ? "none"
                      : result.report.supporting_transaction_ids.join(", ")}
                  </dd>
                </div>
                <div>
                  <dt>Recommendation</dt>
                  <dd className="mt-1 text-[#F2F0F8]">{result.report.recommendation}</dd>
                </div>
                <div>
                  <dt>Validation</dt>
                  <dd className="mt-1 text-[#F2F0F8]">{result.report.validation}</dd>
                </div>
              </dl>
            </section>
          ) : null}

          <section aria-label="Evidence graph" className="flex flex-col gap-4">
            <div className="flex flex-col gap-6 lg:flex-row">
              <div className="min-w-0 flex-1">
                {result.evidence.transactions.length === 0 ? (
                  <EmptyPanel
                    title="No graph evidence returned"
                    message="The bounded queries matched nothing for this transaction. An empty result is not proof that nothing exists outside the query scope."
                    label="Evidence empty"
                  />
                ) : (
                  <EvidenceGraph
                    evidence={result.evidence}
                    resetKey={result.investigation_id}
                    onSelect={setSelection}
                  />
                )}
              </div>
              <aside
                aria-label="Selection inspector"
                aria-live="polite"
                className="w-full shrink-0 rounded-lg border border-[#292936] bg-[#12121A] p-4 lg:w-80"
              >
                <h2 className="text-sm font-semibold">Inspector</h2>
                {!selection ? (
                  <p className="mt-2 text-xs leading-5 text-[#9693A8]">
                    Select a node on the canvas to inspect its returned record.
                  </p>
                ) : selectedTransaction ? (
                  <dl className="mt-2 space-y-2 font-mono text-xs">
                    <div>
                      <dt className="text-[#9693A8]">transaction</dt>
                      <dd>{selectedTransaction.transaction_id}</dd>
                    </div>
                    <div>
                      <dt className="text-[#9693A8]">timestamp</dt>
                      <dd>{selectedTransaction.timestamp}</dd>
                    </div>
                    <div>
                      <dt className="text-[#9693A8]">sender</dt>
                      <dd className="break-all">{selectedTransaction.source_account_key}</dd>
                    </div>
                    <div>
                      <dt className="text-[#9693A8]">receiver</dt>
                      <dd className="break-all">{selectedTransaction.destination_account_key}</dd>
                    </div>
                    <div>
                      <dt className="text-[#9693A8]">paid</dt>
                      <dd>
                        {formatAmount(
                          selectedTransaction.amount_paid,
                          selectedTransaction.payment_currency,
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[#9693A8]">received</dt>
                      <dd>
                        {formatAmount(
                          selectedTransaction.amount_received,
                          selectedTransaction.receiving_currency,
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[#9693A8]">format</dt>
                      <dd>{selectedTransaction.payment_format ?? "—"}</dd>
                    </div>
                  </dl>
                ) : (
                  <div className="mt-2 space-y-2 font-mono text-xs">
                    <p className="break-all">{selection.id}</p>
                    <p className="text-[#9693A8]">
                      {relatedTransfers?.length ?? 0} returned transfers involve
                      this account.
                    </p>
                    <ul className="space-y-1">
                      {relatedTransfers?.slice(0, 20).map((tx) => (
                        <li key={tx.transaction_id} className="break-all">
                          {tx.transaction_id}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </aside>
            </div>

            {result.evidence.paths.length > 0 ? (
              <div className="rounded-lg border border-[#292936] bg-[#12121A] p-4">
                <h2 className="text-sm font-semibold">Returned paths</h2>
                <ol className="mt-2 space-y-2">
                  {result.evidence.paths.map((path, index) => (
                    <li key={`${path.direction}-${index}`} className="font-mono text-xs leading-5">
                      <span className="text-[#F4B860]">
                        [{path.direction} · depth {path.depth}]
                      </span>{" "}
                      <span className="break-all text-[#9693A8]">
                        {path.account_keys.join(" → ")}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            ) : null}

            {result.evidence.transactions.length > 0 ? (
              <div className="overflow-x-auto rounded-lg border border-[#292936] bg-[#12121A]">
                <table className="w-full min-w-[720px] border-collapse text-left text-sm">
                  <caption className="px-4 py-3 text-left text-xs text-[#9693A8]">
                    Every transfer record returned by the executed queries (text
                    equivalent of the canvas).
                  </caption>
                  <thead>
                    <tr className="border-b border-[#292936] text-xs text-[#9693A8]">
                      <th scope="col" className="px-4 py-3 font-medium">
                        Transaction
                      </th>
                      <th scope="col" className="px-4 py-3 font-medium">
                        Timestamp
                      </th>
                      <th scope="col" className="px-4 py-3 font-medium">
                        Sender → receiver
                      </th>
                      <th scope="col" className="px-4 py-3 font-medium">
                        Paid
                      </th>
                      <th scope="col" className="px-4 py-3 font-medium">
                        Received
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.evidence.transactions.map((tx) => (
                      <tr
                        key={tx.transaction_id}
                        className="border-b border-[#292936] last:border-0"
                      >
                        <td className="px-4 py-3 font-mono text-xs">
                          {tx.transaction_id}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-[#9693A8]">
                          {tx.timestamp}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs">
                          <span className="break-all">
                            {tx.source_account_key} → {tx.destination_account_key}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs">
                          {formatAmount(tx.amount_paid, tx.payment_currency)}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs">
                          {formatAmount(tx.amount_received, tx.receiving_currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </section>
        </div>
      )}
    </main>
  );
}

export default function InvestigationsPage() {
  return (
    <Suspense
      fallback={
        <main className="flex flex-col gap-6">
          <header>
            <h1 className="text-2xl font-semibold tracking-tight">Investigations</h1>
          </header>
        </main>
      }
    >
      <InvestigationWorkspace />
    </Suspense>
  );
}
