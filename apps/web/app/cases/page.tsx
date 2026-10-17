"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Search } from "lucide-react";
import type { Route } from "next";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import GraphPreview from "../components/graph/graph-preview";
import { StatusBadge, type Tone } from "../components/ui/badge";
import { Card, CardHeader, Metadata, cx } from "../components/ui/card";
import { Button, Field, LinkButton, TextInput } from "../components/ui/controls";
import { Modal } from "../components/ui/modal";
import { Disclosure } from "../components/ui/motion";
import { PageHeader } from "../components/ui/page-header";
import { EmptyState, ErrorState, LoadingState } from "../components/ui/states";
import { useAnalystId } from "../lib/analyst";
import {
  ApiError,
  caseQuery,
  casesQuery,
  postCaseReview,
  type CaseEvidenceEntry,
  type CaseItem,
  type CaseStatus,
} from "../lib/api";
import { formatDateTime, formatDurationMs, formatRelative, formatScore } from "../lib/format";

const PAGE_SIZE = 25;

const STATUS_META: Record<CaseStatus, { label: string; tone: Tone }> = {
  suspected: { label: "Suspected", tone: "warning" },
  under_review: { label: "Under review", tone: "warning" },
  confirmed: { label: "Confirmed by analyst", tone: "critical" },
  dismissed: { label: "Dismissed", tone: "neutral" },
};

function CaseStatusBadge({ status }: { status: CaseStatus }) {
  const meta = STATUS_META[status];
  return <StatusBadge tone={meta.tone}>{meta.label}</StatusBadge>;
}

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 404) return "No case with that identifier.";
    return error.detail;
  }
  return "Something went wrong while loading cases.";
}

function ReviewDialog({ item, onClose }: { item: CaseItem; onClose: () => void }) {
  const [action, setAction] = useState<"confirm" | "dismiss">("confirm");
  const [analyst, setAnalyst] = useAnalystId();
  const [pattern, setPattern] = useState("");
  const [notes, setNotes] = useState("");
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: () =>
      postCaseReview(item.case_id, {
        action,
        reviewer_id: analyst.trim(),
        pattern_type: pattern.trim() || null,
        notes: notes.trim() || null,
      }),
    onSuccess: (updated) => {
      queryClient.setQueryData(caseQuery(item.case_id).queryKey, updated);
      void queryClient.invalidateQueries({ queryKey: ["cases"] });
      onClose();
    },
  });

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        mutation.mutate();
      }}
    >
      <fieldset className="flex gap-4 text-xs">
        <legend className="mb-1 font-medium text-ink">Decision</legend>
        {(["confirm", "dismiss"] as const).map((value) => (
          <label key={value} className="flex items-center gap-1.5 text-ink">
            <input
              type="radio"
              name="review-action"
              checked={action === value}
              onChange={() => setAction(value)}
              className="accent-[var(--accent)]"
            />
            {value === "confirm" ? "Confirm as suspicious" : "Dismiss"}
          </label>
        ))}
      </fieldset>
      <p className="rounded-control border border-line p-2 text-xs leading-5 text-dim">
        {action === "confirm"
          ? "Confirming records your explicit determination for this case and promotes it to confirmed memory. The record is append-only and cannot be edited."
          : "Dismissing closes the case. The dismissal and its provenance stay in the history."}
      </p>
      <Field label="Reviewer identifier" hint="Recorded with the decision. Stored in this browser only.">
        <TextInput required maxLength={64} value={analyst} onChange={(event) => setAnalyst(event.target.value)} />
      </Field>
      <Field label="Pattern type (optional)">
        <TextInput maxLength={64} value={pattern} onChange={(event) => setPattern(event.target.value)} />
      </Field>
      <Field label="Notes (optional)">
        <TextInput maxLength={4000} value={notes} onChange={(event) => setNotes(event.target.value)} />
      </Field>
      {mutation.isError ? (
        <p role="alert" className="text-xs text-critical">
          {mutation.error instanceof ApiError ? mutation.error.detail : "The review could not be recorded."}
        </p>
      ) : null}
      <div className="flex justify-end gap-2">
        <Button onClick={onClose}>Cancel</Button>
        <Button
          type="submit"
          variant={action === "confirm" ? "primary" : "danger"}
          disabled={mutation.isPending || analyst.trim() === ""}
        >
          {mutation.isPending ? "Recording" : action === "confirm" ? "Confirm case" : "Dismiss case"}
        </Button>
      </div>
    </form>
  );
}

function EvidenceDetail({ entry }: { entry: CaseEvidenceEntry }) {
  return (
    <div className="flex flex-col gap-3">
      <dl className="grid grid-cols-2 gap-2">
        <Metadata label="Action">{entry.action.replace("_", " ")}</Metadata>
        <Metadata label="Proposed by">{entry.proposed_by}</Metadata>
        <Metadata label="Risk snapshot">{formatScore(entry.risk_score)}</Metadata>
        <Metadata label="Decision snapshot">{entry.decision} ({entry.policy_version})</Metadata>
        <Metadata label="Recorded">{formatDateTime(entry.timestamp)}</Metadata>
        <Metadata label="Investigation">{entry.investigation_id}</Metadata>
      </dl>
      <p className="text-xs leading-5 text-dim">{entry.reason}</p>
      <div>
        <p className="text-xs text-dim">Evidence references</p>
        {entry.evidence_refs.length === 0 ? (
          <p className="text-xs text-dim">None recorded.</p>
        ) : (
          <ul className="mt-1 flex flex-col gap-1">
            {entry.evidence_refs.map((ref) => (
              <li key={ref}>
                <LinkButton variant="ghost" href={`/simulation?transaction_id=${encodeURIComponent(ref)}`} className="font-mono">
                  {ref}
                </LinkButton>
              </li>
            ))}
          </ul>
        )}
      </div>
      <Disclosure title="Tool trace" badge={<span className="font-mono text-dim">{entry.tool_trace.length}</span>}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[380px] text-left text-[11px]">
            <thead>
              <tr className="text-dim">
                <th scope="col" className="pr-2 font-medium">Tool</th>
                <th scope="col" className="pr-2 font-medium">Origin</th>
                <th scope="col" className="pr-2 font-medium">Outcome</th>
                <th scope="col" className="font-medium">Time</th>
              </tr>
            </thead>
            <tbody className="font-mono">
              {entry.tool_trace.map((trace) => (
                <tr key={trace.tool_run_id} className="border-t border-line">
                  <td className="py-1 pr-2">{trace.tool}</td>
                  <td className="pr-2">{trace.origin}/{trace.transport}</td>
                  <td className="pr-2">{trace.status === "error" ? "error" : trace.outcome}</td>
                  <td>{formatDurationMs(trace.duration_ms)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Disclosure>
    </div>
  );
}

function CaseDetail({ caseId, onBack }: { caseId: string; onBack: () => void }) {
  const query = useQuery(caseQuery(caseId));
  const [reviewing, setReviewing] = useState(false);
  const [evidenceId, setEvidenceId] = useState<string | null>(null);

  if (query.isPending) return <LoadingState label="Loading case" lines={5} />;
  if (query.isError) {
    return (
      <ErrorState
        label="Case error"
        title="Case unavailable"
        message={errorMessage(query.error)}
        onRetry={query.error instanceof ApiError && query.error.status === 404 ? undefined : () => query.refetch()}
      />
    );
  }
  const item = query.data;
  const open = item.status === "suspected" || item.status === "under_review";
  const evidence = item.evidence.find((entry) => entry.evidence_id === evidenceId) ?? null;

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="flex min-w-0 flex-col gap-4">
        <Card aria-label="Selected case">
          <div className="mb-3 lg:hidden">
            <Button variant="ghost" onClick={onBack}>
              <ArrowLeft aria-hidden="true" className="h-3.5 w-3.5" />
              All cases
            </Button>
          </div>
          <CardHeader
            title={`Case ${item.case_id}`}
            actions={<CaseStatusBadge status={item.status} />}
          />
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Metadata label="Transaction">{item.transaction_id}</Metadata>
            <Metadata label="Risk estimate at open">{formatScore(item.risk_score)}</Metadata>
            <Metadata label="Opened by">{item.opened_by}</Metadata>
            <Metadata label="Last updated">{formatDateTime(item.updated_at)}</Metadata>
          </dl>
          <p className="mt-4 text-xs leading-5 text-dim">
            {item.status === "confirmed"
              ? "An analyst explicitly confirmed this case. See the review history for who and when."
              : item.status === "dismissed"
                ? "An analyst dismissed this case. The history is preserved."
                : "This case is awaiting an analyst decision. The risk estimate is a model score and is not a fraud determination."}
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <LinkButton variant="primary" href={`/simulation?transaction_id=${encodeURIComponent(item.transaction_id)}`}>
              Open in Simulation
            </LinkButton>
            {open ? (
              <Button onClick={() => setReviewing(true)}>Record decision</Button>
            ) : (
              <span className="text-xs text-dim">Decision recorded; reviews are closed for this case.</span>
            )}
          </div>
        </Card>

        <Card aria-label="Review history">
          <CardHeader title="Review history" description="Append-only record of every action on this case." />
          {item.history.length === 0 ? (
            <p className="text-xs text-dim">No history recorded.</p>
          ) : (
            <ol className="flex flex-col gap-3">
              {item.history.map((entry) => (
                <li key={entry.review_id} className="border-l-2 border-line pl-3">
                  <p className="text-sm text-ink">
                    <span className="capitalize">{entry.action}</span>
                    <span className="text-dim"> by </span>
                    <span className="font-mono text-xs">{entry.reviewer_id}</span>
                  </p>
                  <p className="text-[11px] text-dim">
                    {formatDateTime(entry.timestamp)}
                    {entry.pattern_type ? ` · pattern: ${entry.pattern_type}` : ""}
                  </p>
                  {entry.notes ? <p className="mt-0.5 text-xs leading-5 text-dim">{entry.notes}</p> : null}
                </li>
              ))}
            </ol>
          )}
        </Card>

        <Card aria-label="Case evidence">
          <CardHeader title="Attached evidence" description="Graph evidence references attached by the action gate." />
          {item.evidence.length === 0 ? (
            <p className="text-xs text-dim">No evidence has been attached to this case.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {item.evidence.map((entry) => (
                <li key={entry.evidence_id}>
                  <button
                    type="button"
                    aria-pressed={entry.evidence_id === evidenceId}
                    onClick={() => setEvidenceId(entry.evidence_id === evidenceId ? null : entry.evidence_id)}
                    className={cx(
                      "selectable w-full rounded-control border p-3 text-left text-xs hover:bg-hover",
                      entry.evidence_id === evidenceId ? "border-accent/50 bg-accent-soft" : "border-line",
                    )}
                  >
                    <span className="font-medium text-ink">{entry.action.replace("_", " ")}</span>
                    <span className="text-dim"> by {entry.proposed_by} · {formatDateTime(entry.timestamp)}</span>
                    <span className="mt-0.5 block text-dim">{entry.evidence_refs.length} evidence reference(s)</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="flex min-w-0 flex-col gap-4">
        <GraphPreview transactionId={item.transaction_id} title="Graph preview" />
        <Card aria-label="Evidence detail" className="slide-in" key={evidence?.evidence_id ?? "none"}>
          <CardHeader title="Evidence detail" />
          {evidence ? (
            <EvidenceDetail entry={evidence} />
          ) : (
            <p className="text-xs text-dim">Select attached evidence to inspect its references and tool trace.</p>
          )}
        </Card>
      </div>

      <Modal open={reviewing} title={`Record decision for ${item.case_id}`} onClose={() => setReviewing(false)}>
        <ReviewDialog item={item} onClose={() => setReviewing(false)} />
      </Modal>
    </div>
  );
}

function CasesWorkspace() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const selectedId = params.get("case");
  const statusParam = params.get("status");
  const status: CaseStatus | null =
    statusParam === "suspected" || statusParam === "under_review" || statusParam === "confirmed" || statusParam === "dismissed"
      ? statusParam
      : null;
  const page = Math.max(0, Number(params.get("page") ?? "0") || 0);
  const [search, setSearch] = useState("");

  const list = useQuery(casesQuery(status, PAGE_SIZE, page * PAGE_SIZE));

  const setParams = (updates: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value === null) next.delete(key);
      else next.set(key, value);
    }
    const query = next.toString();
    router.replace((query ? `${pathname}?${query}` : pathname) as Route, { scroll: false });
  };

  const items = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return (list.data?.items ?? []).filter(
      (item) =>
        needle === "" ||
        item.case_id.toLowerCase().includes(needle) ||
        item.transaction_id.toLowerCase().includes(needle),
    );
  }, [list.data, search]);

  const total = list.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      <PageHeader
        title="Cases"
        description="Review workspace. Cases start as suspected; only an explicit analyst confirmation promotes one, and dismissals stay in the record."
      />
      <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        <Card
          padded={false}
          aria-label="Case list"
          className={cx("self-start", selectedId ? "max-lg:hidden" : "slide-in lg:animate-none")}
        >
          <div className="flex flex-col gap-2 p-4">
            <h2 className="text-base font-semibold">Case list</h2>
            <div className="relative">
              <Search aria-hidden="true" className="pointer-events-none absolute top-2 left-2.5 h-3.5 w-3.5 text-dim" />
              <TextInput
                aria-label="Search cases on this page"
                placeholder="Case or transaction ID"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="pl-8 font-mono"
              />
            </div>
            <select
              aria-label="Filter by status"
              value={status ?? "all"}
              onChange={(event) =>
                setParams({ status: event.target.value === "all" ? null : event.target.value, page: null })
              }
              className="rounded-control border border-line-strong bg-raised px-2 py-1.5 text-xs text-ink"
            >
              <option value="all">All statuses</option>
              <option value="suspected">Suspected</option>
              <option value="under_review">Under review</option>
              <option value="confirmed">Confirmed</option>
              <option value="dismissed">Dismissed</option>
            </select>
          </div>
          {list.isPending ? (
            <div className="p-4 pt-0" role="status" aria-label="Loading cases">
              <div className="skeleton h-12 w-full" />
            </div>
          ) : list.isError ? (
            <div className="p-4 pt-0">
              <p role="alert" className="text-xs text-critical">{errorMessage(list.error)}</p>
              <Button className="mt-2" onClick={() => list.refetch()}>Retry</Button>
            </div>
          ) : items.length === 0 ? (
            <p className="p-4 pt-0 text-xs text-dim">
              {list.data.items.length === 0
                ? "No cases yet. Open one from an alert or an investigation."
                : "No cases on this page match the search."}
            </p>
          ) : (
            <ul className="max-h-[70vh] overflow-y-auto border-t border-line">
              {items.map((item) => {
                const isSelected = item.case_id === selectedId;
                return (
                  <li key={item.case_id} className="border-b border-line last:border-0">
                    <button
                      type="button"
                      aria-current={isSelected ? "true" : undefined}
                      onClick={() => setParams({ case: item.case_id })}
                      className={cx(
                        "selectable flex w-full flex-col gap-1 px-4 py-3 text-left hover:bg-hover",
                        isSelected && "bg-accent-soft",
                      )}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="font-mono text-xs text-ink">{item.case_id}</span>
                        <CaseStatusBadge status={item.status} />
                      </span>
                      <span className="truncate font-mono text-[11px] text-dim">{item.transaction_id}</span>
                      <span className="text-[11px] text-dim">Updated {formatRelative(item.updated_at)}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {list.data && total > PAGE_SIZE ? (
            <nav aria-label="Case pages" className="flex items-center justify-between border-t border-line p-3">
              <span className="font-mono text-[11px] text-dim">{page + 1} / {pageCount}</span>
              <div className="flex gap-2">
                <Button disabled={page === 0} onClick={() => setParams({ page: String(page - 1) })}>Previous</Button>
                <Button disabled={page + 1 >= pageCount} onClick={() => setParams({ page: String(page + 1) })}>Next</Button>
              </div>
            </nav>
          ) : null}
        </Card>

        <div className={cx("min-w-0", !selectedId && "max-lg:hidden")}>
          {selectedId ? (
            <div key={selectedId} className="slide-in">
              <CaseDetail caseId={selectedId} onBack={() => setParams({ case: null })} />
            </div>
          ) : (
            <EmptyState
              label="No case selected"
              title="Select a case"
              message="Choose a case from the list to see its summary, review history, attached evidence and graph."
            />
          )}
        </div>
      </div>
    </>
  );
}

export default function CasesPage() {
  return (
    <Suspense fallback={<PageHeader title="Cases" description="Loading cases." />}>
      <CasesWorkspace />
    </Suspense>
  );
}
