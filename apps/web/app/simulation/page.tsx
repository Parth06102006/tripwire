"use client";

import { useQuery } from "@tanstack/react-query";
import { Play } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import EntityPanel from "../components/graph/entity-panel";
import EvidenceTable from "../components/graph/evidence-table";
import ExecutionRail from "../components/graph/execution-rail";
import GraphWorkspace from "../components/graph/graph-workspace";
import RiskPanel from "../components/graph/risk-panel";
import { Card } from "../components/ui/card";
import { Button, Field, TextInput } from "../components/ui/controls";
import { Disclosure } from "../components/ui/motion";
import { PageHeader } from "../components/ui/page-header";
import { EmptyState, ErrorState, LoadingState } from "../components/ui/states";
import { healthQuery, type InvestigationRequest } from "../lib/api";
import { buildGraphModel, selectedTransactionId, type Selection } from "../lib/graph-model";
import { DEFAULT_REQUEST, baseRequest, investigationErrorMessage, useInvestigation } from "../lib/investigation";
import { STAGE_NOTE, deriveStages, type RunPhase } from "../lib/stages";

function SimulationWorkspace() {
  const params = useSearchParams();
  const router = useRouter();
  const preset = params.get("transaction_id")?.trim() ?? "";

  const [form, setForm] = useState({
    transactionId: preset,
    maxHops: DEFAULT_REQUEST.max_hops,
    window: DEFAULT_REQUEST.time_window_seconds,
    limit: DEFAULT_REQUEST.result_limit,
    useLlm: false,
    act: false,
  });
  const [request, setRequest] = useState<InvestigationRequest | null>(
    preset ? baseRequest(preset) : null,
  );
  const [nonce, setNonce] = useState(0);
  const [selection, setSelection] = useState<Selection>(null);

  const health = useQuery(healthQuery);
  const query = useInvestigation(request, nonce);
  const result = query.data;

  // A deep link that changes after mount (browser navigation) re-runs once.
  const lastPreset = useRef(preset);
  useEffect(() => {
    if (preset && preset !== lastPreset.current) {
      lastPreset.current = preset;
      setForm((previous) => ({ ...previous, transactionId: preset }));
      setRequest(baseRequest(preset));
      setSelection(null);
    }
  }, [preset]);

  const model = useMemo(
    () => (result ? buildGraphModel(result.evidence, result.transaction_id) : null),
    [result],
  );

  const phase: RunPhase =
    request === null
      ? { phase: "idle" }
      : query.isError
        ? { phase: "error", error: query.error }
        : result
          ? { phase: "success", result, request }
          : { phase: "loading" };
  const stages = deriveStages(phase);

  const llmUnavailable = health.data?.llm !== "configured";

  const submit = () => {
    const next: InvestigationRequest = {
      transaction_id: form.transactionId.trim(),
      max_hops: form.maxHops,
      time_window_seconds: form.window,
      result_limit: form.limit,
      use_llm: form.useLlm,
      act: form.act,
    };
    setSelection(null);
    setRequest(next);
    setNonce((value) => value + 1);
    router.replace(`/simulation?transaction_id=${encodeURIComponent(next.transaction_id)}`, {
      scroll: false,
    });
  };

  const txId = model ? selectedTransactionId(model, selection) : null;

  return (
    <>
      <PageHeader
        title="Simulation"
        description="Run a bounded graph investigation and follow it from alert to outcome. Everything shown comes from the API response."
      />

      <Card aria-label="Investigation request">
        <form
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[2fr_repeat(3,1fr)_auto]"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <Field label="Transaction ID" hint="Must be scored and present in the graph.">
            <TextInput
              required
              value={form.transactionId}
              onChange={(event) => setForm({ ...form, transactionId: event.target.value })}
              placeholder="Transaction identifier"
              className="font-mono"
            />
          </Field>
          <Field label="Max hops" hint="1 to 3">
            <TextInput
              type="number"
              min={1}
              max={3}
              value={form.maxHops}
              onChange={(event) => setForm({ ...form, maxHops: Number(event.target.value) })}
            />
          </Field>
          <Field label="Time window (s)" hint="1 to 2592000">
            <TextInput
              type="number"
              min={1}
              max={2592000}
              value={form.window}
              onChange={(event) => setForm({ ...form, window: Number(event.target.value) })}
            />
          </Field>
          <Field label="Result limit" hint="1 to 100">
            <TextInput
              type="number"
              min={1}
              max={100}
              value={form.limit}
              onChange={(event) => setForm({ ...form, limit: Number(event.target.value) })}
            />
          </Field>
          <div className="flex items-end">
            <Button
              type="submit"
              variant="primary"
              disabled={query.isFetching || form.transactionId.trim() === ""}
              className="w-full lg:w-auto"
            >
              <Play aria-hidden="true" className="h-3.5 w-3.5" />
              {query.isFetching ? "Running" : "Investigate"}
            </Button>
          </div>
        </form>
        <div className="mt-4">
          <Disclosure title="Advanced options">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex items-start gap-2 text-xs text-dim">
                <input
                  type="checkbox"
                  className="mt-0.5 accent-[var(--accent)]"
                  checked={form.useLlm && !llmUnavailable}
                  disabled={llmUnavailable}
                  onChange={(event) => setForm({ ...form, useLlm: event.target.checked })}
                />
                <span>
                  <span className="font-medium text-ink">Use LLM report agent</span>
                  <br />
                  {llmUnavailable
                    ? "Not configured on the API, so the deterministic report is used."
                    : "Narrative is verified against retrieved evidence; any failure falls back to the deterministic report."}
                </span>
              </label>
              <label className="flex items-start gap-2 text-xs text-dim">
                <input
                  type="checkbox"
                  className="mt-0.5 accent-[var(--accent)]"
                  checked={form.act}
                  onChange={(event) => setForm({ ...form, act: event.target.checked })}
                />
                <span>
                  <span className="font-medium text-ink">Allow case action</span>
                  <br />
                  Lets the deterministic action gate open or enrich a suspected case. This writes to the
                  case store. It never changes the score or decision.
                </span>
              </label>
            </div>
          </Disclosure>
        </div>
      </Card>

      <ExecutionRail stages={stages} note={STAGE_NOTE[phase.phase]} />

      <div aria-live="polite" className="sr-only">
        {query.isFetching
          ? "Investigation running."
          : query.isError
            ? "Investigation failed."
            : result
              ? `Investigation complete for ${result.transaction_id}.`
              : ""}
      </div>

      {request === null ? (
        <EmptyState
          label="Simulation empty"
          title="No investigation yet"
          message="Enter a transaction ID above, or open one from the alert queue or a case."
        />
      ) : query.isError ? (
        <ErrorState
          label="Investigation error"
          title="Investigation failed"
          message={investigationErrorMessage(query.error)}
          onRetry={() => setNonce((value) => value + 1)}
        />
      ) : !result || !model ? (
        <LoadingState label="Running investigation" lines={4} />
      ) : (
        <>
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
            <div className="min-w-0">
              {result.evidence.transactions.length === 0 ? (
                <EmptyState
                  label="No graph evidence"
                  title="No graph evidence returned"
                  message="The bounded queries matched nothing for this transaction. An empty result is not proof that nothing exists outside the query scope."
                />
              ) : (
                <GraphWorkspace
                  model={model}
                  anchorTransactionId={result.transaction_id}
                  selection={selection}
                  onSelect={setSelection}
                />
              )}
            </div>
            <div className="flex min-w-0 flex-col gap-4">
              <RiskPanel result={result} />
              <Card aria-label="Selected entity" aria-live="polite">
                <div key={JSON.stringify(selection)} className="fade-up">
                  <EntityPanel model={model} result={result} selection={selection} onSelect={setSelection} />
                </div>
              </Card>
            </div>
          </div>
          <EvidenceTable
            evidence={result.evidence}
            selection={selection}
            selectedTransactionId={txId}
            onSelect={setSelection}
          />
        </>
      )}
    </>
  );
}

export default function SimulationPage() {
  return (
    <Suspense fallback={<PageHeader title="Simulation" description="Loading workspace." />}>
      <SimulationWorkspace />
    </Suspense>
  );
}
