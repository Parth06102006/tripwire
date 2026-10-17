import { describe, expect, it } from "vitest";

import type { StreamEvent } from "@/lib/agent/stream-client";
import type { InvestigationResponse, StreamToolFinished } from "@/lib/api-schemas";
import { investigation, request, trace, tx } from "@/test/fixtures";

import { batchNodeIds, initialReviewState, reviewReducer, type ReviewState } from "./session";

const started: StreamEvent = {
  type: "started",
  data: {
    transaction_id: "tx-a",
    risk_score: 0.9,
    decision: "review",
    route: "flagged_for_review",
    review_threshold: 0.5,
    block_threshold: 0.99,
    policy_version: "v2",
    max_hops: 2,
    time_window_seconds: 86_400,
    result_limit: 50,
    agent: "llm",
    llm_provider: "gemini",
    llm_model: "m",
  },
};

function toolStarted(callId: string): StreamEvent {
  return {
    type: "tool_started",
    data: {
      call_id: callId,
      tool: "trace_funds",
      origin: "model",
      transport: "mcp",
      arguments: { max_hops: 2 },
      purpose: "Follow tx-a onward.",
    },
  };
}

function toolCompleted(callId: string, finished: Partial<StreamToolFinished> = {}): StreamEvent {
  return {
    type: "tool_completed",
    data: {
      call_id: callId,
      entry: trace({ tool_run_id: `run-${callId}` }),
      statements: [
        { cypher: "MATCH (n) RETURN n", parameters: { id: "tx-a" }, rows: 1, duration_ms: 2 },
      ],
      evidence: {
        transactions: [tx("tx-a", "1::A", "2::B")],
        accounts: [{ account_key: "1::A" }, { account_key: "2::B" }],
        paths: [],
      },
      ...finished,
    },
  };
}

function play(...events: StreamEvent[]): ReviewState {
  let state = reviewReducer(initialReviewState, { type: "requested", run: 1, request, at: 0 });
  for (const event of events) state = reviewReducer(state, { type: "event", run: 1, event });
  return state;
}

describe("reviewReducer", () => {
  it("grows the graph one tool result at a time, keeping earlier positions", () => {
    const first = play(started, toolStarted("c1"), toolCompleted("c1"));
    expect(first.graph.nodes.size).toBe(3);
    const firstPositions = new Map(first.positions);

    const second = reviewReducer(first, {
      type: "event",
      run: 1,
      event: toolCompleted("c2", {
        evidence: {
          transactions: [tx("tx-b", "2::B", "3::C")],
          accounts: [{ account_key: "3::C" }],
          paths: [],
        },
      }),
    });
    expect(second.graph.nodes.size).toBe(5);
    expect(second.graph.latestSeq).toBe(2);
    for (const [id, point] of firstPositions) expect(second.positions.get(id)).toEqual(point);
  });

  it("attaches each result, its Cypher and what it added to its tool item", () => {
    const state = play(started, toolStarted("c1"), toolCompleted("c1"));
    const tool = state.items.find((item) => item.kind === "tool");
    expect(tool?.kind === "tool" && tool.result?.statements[0]?.cypher).toBe("MATCH (n) RETURN n");
    expect(tool?.kind === "tool" && tool.added).toEqual({ transactions: 1, accounts: 2, paths: 0 });
    expect(tool?.kind === "tool" && batchNodeIds(state, tool.batchSeq).sort()).toEqual([
      "account:1::A",
      "account:2::B",
      "tx:tx-a",
    ]);
  });

  it("shows a running tool until its result arrives, and a failed tool adds nothing", () => {
    const running = play(started, toolStarted("c1"));
    const pending = running.items.find((item) => item.kind === "tool");
    expect(pending?.kind === "tool" && pending.result).toBeNull();

    const failed = reviewReducer(running, {
      type: "event",
      run: 1,
      event: {
        type: "tool_failed",
        data: {
          call_id: "c1",
          entry: trace({ status: "error", outcome: "inconclusive" }),
          statements: [],
          evidence: null,
        },
      },
    });
    expect(failed.graph.nodes.size).toBe(0);
  });

  it("tracks agent rounds and the report draft from agent steps", () => {
    const state = play(
      started,
      { type: "agent_step", data: { phase: "round_started", round: 1, tool_calls: 0 } },
      { type: "agent_step", data: { phase: "round_finished", round: 1, tool_calls: 2 } },
      { type: "agent_step", data: { phase: "report_started", round: 2, tool_calls: 0 } },
    );
    const round = state.items.find((item) => item.kind === "round");
    expect(round?.kind === "round" && round.done && round.toolCalls).toBe(2);
    const drafting = state.items.find((item) => item.kind === "drafting");
    expect(drafting?.kind === "drafting" && drafting.done).toBe(false);
  });

  it("ends with the verdict and reconciles evidence the stream did not carry", () => {
    const response: InvestigationResponse = investigation();
    const state = play(started, { type: "investigation_completed", data: response });
    expect(state.latest).toBe(response);
    expect(state.runs[0]?.status).toBe("completed");
    expect(state.items.at(-1)?.kind).toBe("verdict");
    expect(state.graph.nodes.has("tx:tx-b")).toBe(true);
  });

  it("records an error event and ignores events after the run stops", () => {
    const errored = play(started, {
      type: "error",
      data: { status: 404, detail: "transaction not found in graph" },
    });
    const error = errored.items.at(-1);
    expect(error?.kind === "error" && error.message).toMatch(/not in the loaded graph/);
    expect(errored.runs[0]?.status).toBe("failed");

    const stopped = reviewReducer(play(started), { type: "stopped", run: 1 });
    const after = reviewReducer(stopped, { type: "event", run: 1, event: toolStarted("late") });
    expect(after).toBe(stopped);
  });
});
