/**
 * State of an agent review session for one transaction: the transcript the
 * chat pane renders and the graph the canvas renders, both derived from the
 * same stream events so they cannot disagree.
 *
 * Every transcript item and every graph element comes from an event the API
 * sent. Each evidence batch is laid out once, when it arrives, keeping every
 * earlier position, so the graph grows without jumping.
 */
import { ApiError, describeApiError, type ApiErrorKind, type RateLimit } from "@/lib/api-client";
import type {
  InvestigationRequest,
  InvestigationResponse,
  StreamStarted,
  StreamToolFinished,
  StreamToolStarted,
} from "@/lib/api-schemas";
import type { StreamEvent } from "@/lib/agent/stream-client";
import { layoutGraph, type Point } from "@/lib/graph/layout";
import {
  accountNodeId,
  buildInvestigationGraph,
  emptyGraph,
  pathId,
  transactionNodeId,
  type EvidenceBatch,
  type InvestigationGraph,
} from "@/lib/graph/model";

type ItemBase = { key: string; run: number };

export type ToolItem = ItemBase & {
  kind: "tool";
  call: StreamToolStarted;
  result: StreamToolFinished | null;
  /** Batch holding this call's evidence, when it returned any. */
  batchSeq: number | null;
  /** Elements this call added to the graph (not already shown). */
  added: { transactions: number; accounts: number; paths: number } | null;
};

export type TranscriptItem =
  | (ItemBase & { kind: "request"; request: InvestigationRequest; at: number })
  | (ItemBase & { kind: "routing"; started: StreamStarted })
  | (ItemBase & { kind: "round"; round: number; done: boolean; toolCalls: number })
  | (ItemBase & { kind: "drafting"; done: boolean })
  | ToolItem
  | (ItemBase & { kind: "verdict"; response: InvestigationResponse })
  | (ItemBase & {
      kind: "error";
      message: string;
      status: number | null;
      detail: string | null;
    })
  | (ItemBase & { kind: "stopped" });

export type RunStatus = "streaming" | "completed" | "failed" | "stopped";
export type ReviewRun = { seq: number; status: RunStatus; request: InvestigationRequest };

export type ReviewState = {
  items: TranscriptItem[];
  runs: ReviewRun[];
  batches: EvidenceBatch[];
  graph: InvestigationGraph;
  positions: Map<string, Point>;
  latest: InvestigationResponse | null;
};

export type ClientFailure = {
  kind: ApiErrorKind;
  message: string;
  status: number | null;
  detail: string | null;
  /** Set on a 429, so the transcript can say when to try again. */
  rateLimit?: RateLimit | null;
};

export type ReviewAction =
  | { type: "requested"; run: number; request: InvestigationRequest; at: number }
  | { type: "event"; run: number; event: StreamEvent }
  | { type: "failed"; run: number; failure: ClientFailure }
  | { type: "stopped"; run: number };

export const initialReviewState: ReviewState = {
  items: [],
  runs: [],
  batches: [],
  graph: emptyGraph(),
  positions: new Map(),
  latest: null,
};

function runOf(state: ReviewState, run: number): ReviewRun | undefined {
  return state.runs.find((item) => item.seq === run);
}

function setRunStatus(state: ReviewState, run: number, status: RunStatus): ReviewRun[] {
  return state.runs.map((item) => (item.seq === run ? { ...item, status } : item));
}

function countKinds(graph: InvestigationGraph): { transactions: number; accounts: number } {
  let transactions = 0;
  let accounts = 0;
  for (const node of graph.nodes.values()) {
    if (node.kind === "transaction") transactions += 1;
    else accounts += 1;
  }
  return { transactions, accounts };
}

/** Append a batch, rebuild the graph and place only the new nodes. */
function withBatch(
  state: ReviewState,
  batch: Omit<EvidenceBatch, "seq">,
): { state: ReviewState; seq: number; added: ToolItem["added"] } {
  const seq = state.batches.length + 1;
  const batches = [...state.batches, { ...batch, seq }];
  const graph = buildInvestigationGraph(batches);
  const before = countKinds(state.graph);
  const after = countKinds(graph);
  return {
    seq,
    added: {
      transactions: after.transactions - before.transactions,
      accounts: after.accounts - before.accounts,
      paths: graph.paths.length - state.graph.paths.length,
    },
    state: { ...state, batches, graph, positions: layoutGraph(graph, state.positions) },
  };
}

/** Whether a response holds anything the streamed batches did not. */
function addsEvidence(graph: InvestigationGraph, response: InvestigationResponse): boolean {
  const { evidence } = response;
  if (evidence.transactions.some((tx) => !graph.nodes.has(transactionNodeId(tx.transaction_id))))
    return true;
  const known = new Set(graph.paths.map((entry) => entry.id));
  return evidence.paths.some((path) => !known.has(pathId(path)));
}

function failureItem(run: number, failure: ClientFailure, key: string): TranscriptItem {
  return {
    kind: "error",
    key,
    run,
    status: failure.status,
    detail: failure.detail,
    message: describeApiError(
      new ApiError(
        failure.kind,
        failure.message,
        failure.status,
        failure.detail,
        failure.rateLimit ?? null,
      ),
    ),
  };
}

function applyEvent(state: ReviewState, run: number, event: StreamEvent): ReviewState {
  const request = runOf(state, run)?.request;
  if (!request) return state;

  switch (event.type) {
    case "started":
      return {
        ...state,
        items: [
          ...state.items,
          { kind: "routing", key: `${run}:routing`, run, started: event.data },
        ],
      };

    case "tool_started":
      return {
        ...state,
        items: [
          ...state.items,
          {
            kind: "tool",
            key: `${run}:${event.data.call_id}`,
            run,
            call: event.data,
            result: null,
            batchSeq: null,
            added: null,
          },
        ],
      };

    case "tool_completed":
    case "tool_failed": {
      const key = `${run}:${event.data.call_id}`;
      let next = state;
      let batchSeq: number | null = null;
      let added: ToolItem["added"] = null;
      if (event.type === "tool_completed" && event.data.evidence) {
        const merged = withBatch(state, {
          ...event.data.evidence,
          anchorTransactionId: request.transaction_id,
        });
        next = merged.state;
        batchSeq = merged.seq;
        added = merged.added;
      }
      return {
        ...next,
        items: next.items.map((item) =>
          item.kind === "tool" && item.key === key
            ? { ...item, result: event.data, batchSeq, added }
            : item,
        ),
      };
    }

    case "agent_step": {
      const { phase, round, tool_calls } = event.data;
      if (phase === "round_started") {
        return {
          ...state,
          items: [
            ...state.items,
            { kind: "round", key: `${run}:round:${round}`, run, round, done: false, toolCalls: 0 },
          ],
        };
      }
      if (phase === "round_finished") {
        return {
          ...state,
          items: state.items.map((item) =>
            item.kind === "round" && item.run === run && item.round === round
              ? { ...item, done: true, toolCalls: tool_calls }
              : item,
          ),
        };
      }
      if (phase === "report_started") {
        return {
          ...state,
          items: [...state.items, { kind: "drafting", key: `${run}:drafting`, run, done: false }],
        };
      }
      return {
        ...state,
        items: state.items.map((item) =>
          item.kind === "drafting" && item.run === run ? { ...item, done: true } : item,
        ),
      };
    }

    case "investigation_completed": {
      const response = event.data;
      // The final evidence is the authority; it normally adds nothing new.
      const next = addsEvidence(state.graph, response)
        ? withBatch(state, { ...response.evidence, anchorTransactionId: response.transaction_id })
            .state
        : state;
      return {
        ...next,
        latest: response,
        runs: setRunStatus(next, run, "completed"),
        items: [...next.items, { kind: "verdict", key: `${run}:verdict`, run, response }],
      };
    }

    case "error":
      return {
        ...state,
        runs: setRunStatus(state, run, "failed"),
        items: [
          ...state.items,
          failureItem(
            run,
            {
              kind: "http",
              message: event.data.detail,
              status: event.data.status,
              detail: event.data.detail,
            },
            `${run}:error`,
          ),
        ],
      };
  }
}

export function reviewReducer(state: ReviewState, action: ReviewAction): ReviewState {
  switch (action.type) {
    case "requested":
      return {
        ...state,
        runs: [...state.runs, { seq: action.run, status: "streaming", request: action.request }],
        items: [
          ...state.items,
          {
            kind: "request",
            key: `${action.run}:request`,
            run: action.run,
            request: action.request,
            at: action.at,
          },
        ],
      };
    case "event": {
      // Events of a stopped or finished run are ignored.
      if (runOf(state, action.run)?.status !== "streaming") return state;
      return applyEvent(state, action.run, action.event);
    }
    case "failed":
      if (runOf(state, action.run)?.status !== "streaming") return state;
      return {
        ...state,
        runs: setRunStatus(state, action.run, "failed"),
        items: [...state.items, failureItem(action.run, action.failure, `${action.run}:failed`)],
      };
    case "stopped":
      if (runOf(state, action.run)?.status !== "streaming") return state;
      return {
        ...state,
        runs: setRunStatus(state, action.run, "stopped"),
        items: [...state.items, { kind: "stopped", key: `${action.run}:stopped`, run: action.run }],
      };
  }
}

export function isStreaming(state: ReviewState): boolean {
  return state.runs.some((run) => run.status === "streaming");
}

/** Node IDs a tool call returned, for highlighting its contribution. */
export function batchNodeIds(state: ReviewState, seq: number | null): string[] {
  if (seq === null) return [];
  const batch = state.batches.find((item) => item.seq === seq);
  if (!batch) return [];
  const ids = new Set<string>();
  for (const tx of batch.transactions) ids.add(transactionNodeId(tx.transaction_id));
  for (const account of batch.accounts) ids.add(accountNodeId(account.account_key));
  return [...ids];
}
