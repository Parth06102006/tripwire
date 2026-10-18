"use client";

import { Check, FolderPlus, Gavel, RotateCw, X } from "lucide-react";
import { memo } from "react";

import { OpenCaseDialog, ReviewCaseDialog } from "@/components/investigation/case-forms";
import { CaseStatusBadge } from "@/components/shared/status-badge";
import { ErrorState, Mono } from "@/components/shared/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useTransactionCases } from "@/hooks/use-cases";
import { describeApiError } from "@/lib/api-client";
import type { CaseActionResult, CaseItem } from "@/lib/api-schemas";
import { formatDateTime, formatScore } from "@/lib/formatters";
import { DENIAL_LABEL } from "@/lib/investigation/outcomes";

const HISTORY_LABEL: Record<CaseItem["history"][number]["action"], string> = {
  open: "Opened",
  enrich: "Evidence attached",
  confirm: "Confirmed",
  dismiss: "Dismissed",
};

function CaseHistory({ item }: { item: CaseItem }) {
  return (
    <ol className="mt-3 space-y-2 border-l border-border pl-3">
      {item.history.map((entry) => (
        <li key={entry.review_id} className="text-xs">
          <p className="text-fg">
            {HISTORY_LABEL[entry.action]} by <Mono>{entry.reviewer_id}</Mono>
          </p>
          <p className="text-[11px] text-fg-muted">{formatDateTime(entry.timestamp)}</p>
          {entry.pattern_type ? (
            <p className="text-fg-secondary">Pattern: {entry.pattern_type}</p>
          ) : null}
          {entry.notes ? (
            <p className="mt-0.5 whitespace-pre-wrap text-fg-secondary">{entry.notes}</p>
          ) : null}
        </li>
      ))}
    </ol>
  );
}

function GateResult({ action }: { action: CaseActionResult }) {
  const executed = action.status === "executed";
  return (
    <div
      className={
        executed
          ? "rounded-md border border-warning/35 bg-warning/[0.06] p-3 text-xs"
          : "rounded-md border border-border bg-surface-sunken p-3 text-xs"
      }
    >
      <p className="font-medium text-fg">
        {executed
          ? action.proposed_action === "enrich_case"
            ? "The action gate attached this evidence to the case"
            : "The action gate opened a case"
          : action.status === "denied"
            ? "The action gate denied the proposal"
            : "No case action was proposed"}
      </p>
      <p className="mt-1 text-fg-secondary">
        {action.status === "denied" && action.denial_code
          ? DENIAL_LABEL[action.denial_code]
          : action.reason}
      </p>
      <p className="mt-1 text-[11px] text-fg-muted">
        Proposed by {action.proposed_by}; {action.evidence_refs.length} evidence references,{" "}
        {action.tool_run_ids.length} tool runs checked.
      </p>
    </div>
  );
}

export const CasePanel = memo(function CasePanel({
  transactionId,
  latestAction,
  canRunGate,
  gateRunning,
  onRunGate,
}: {
  transactionId: string;
  latestAction: CaseActionResult | null;
  canRunGate: boolean;
  gateRunning: boolean;
  onRunGate: () => void;
}) {
  const cases = useTransactionCases(transactionId);

  return (
    <div className="space-y-4 p-4">
      <div>
        <h3 className="text-sm font-semibold">Case</h3>
        <p className="mt-0.5 text-[11px] text-fg-muted">
          Read from the case store. Only an analyst confirm or dismiss changes a case status; no
          action here moves or blocks money.
        </p>
      </div>

      {cases.isPending ? (
        <div className="space-y-2">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : cases.isError ? (
        <ErrorState
          title="Cases could not be loaded"
          message={describeApiError(cases.error)}
          action={
            <Button size="sm" onClick={() => cases.refetch()}>
              <RotateCw /> Try again
            </Button>
          }
        />
      ) : cases.data.active ? (
        <ActiveCase item={cases.data.active} />
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-fg-secondary">
            No open or confirmed case exists for this transaction.
            {cases.data.complete ? "" : " Only the 1,000 most recently updated cases were checked."}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="primary"
              size="sm"
              disabled={!canRunGate || gateRunning}
              onClick={onRunGate}
            >
              <Gavel /> {gateRunning ? "Running the action gate" : "Propose case through the gate"}
            </Button>
            <OpenCaseDialog
              transactionId={transactionId}
              trigger={
                <Button size="sm">
                  <FolderPlus /> Open case manually
                </Button>
              }
            />
          </div>
          <p className="text-[11px] text-fg-muted">
            The gate re-runs this investigation with the case action enabled. Policy proposes, and
            deterministic checks decide whether a case opens.
          </p>
        </div>
      )}

      {latestAction ? <GateResult action={latestAction} /> : null}

      {cases.data && cases.data.active && cases.data.active.status !== "confirmed" && canRunGate ? (
        <Button size="sm" disabled={gateRunning} onClick={onRunGate}>
          <Gavel /> {gateRunning ? "Running the action gate" : "Attach evidence through the gate"}
        </Button>
      ) : null}

      {cases.data && cases.data.dismissed.length > 0 ? (
        <div>
          <p className="text-xs font-medium text-fg-secondary">Dismissed earlier</p>
          <ul className="mt-1 space-y-1">
            {cases.data.dismissed.map((item) => (
              <li key={item.case_id} className="flex items-center justify-between gap-2 text-xs">
                <Mono className="text-fg-secondary">{item.case_id}</Mono>
                <span className="text-[11px] text-fg-muted">{formatDateTime(item.updated_at)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
});

function ActiveCase({ item }: { item: CaseItem }) {
  const open = item.status === "suspected" || item.status === "under_review";
  return (
    <div data-testid="active-case">
      <div className="flex flex-wrap items-center gap-2">
        <CaseStatusBadge status={item.status} />
        <Mono className="text-xs text-fg-secondary">{item.case_id}</Mono>
      </div>
      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs">
        <dt className="text-fg-muted">Opened by</dt>
        <dd>
          <Mono>{item.opened_by}</Mono>
        </dd>
        <dt className="text-fg-muted">Score at open</dt>
        <dd>{formatScore(item.risk_score)}</dd>
        <dt className="text-fg-muted">Updated</dt>
        <dd>{formatDateTime(item.updated_at)}</dd>
        <dt className="text-fg-muted">Attached evidence</dt>
        <dd>
          {item.evidence.length === 0 ? (
            "None"
          ) : (
            <span className="flex flex-wrap gap-1">
              {item.evidence.map((entry) => (
                <Badge key={entry.evidence_id} tone="verified">
                  {entry.evidence_refs.length} refs from {entry.investigation_id}
                </Badge>
              ))}
            </span>
          )}
        </dd>
      </dl>
      <CaseHistory item={item} />
      {open ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <ReviewCaseDialog
            caseId={item.case_id}
            action="confirm"
            trigger={
              <Button variant="danger" size="sm">
                <Check /> Confirm
              </Button>
            }
          />
          <ReviewCaseDialog
            caseId={item.case_id}
            action="dismiss"
            trigger={
              <Button size="sm">
                <X /> Dismiss
              </Button>
            }
          />
        </div>
      ) : (
        <p className="mt-3 text-[11px] text-fg-muted">
          This decision is final and kept in the audit history.
        </p>
      )}
    </div>
  );
}
