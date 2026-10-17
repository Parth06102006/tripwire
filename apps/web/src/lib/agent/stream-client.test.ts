import { afterEach, describe, expect, it, vi } from "vitest";

import { request } from "@/test/fixtures";

import { parseFrame, streamInvestigation, type StreamEvent } from "./stream-client";

afterEach(() => {
  vi.unstubAllGlobals();
});

function streamOf(chunks: string[], status = 200): Response {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder();
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
  return new Response(body, { status, headers: { "content-type": "text/event-stream" } });
}

const stepFrame = 'event: agent_step\ndata: {"phase":"round_started","round":1,"tool_calls":0}\n\n';
const errorFrame = 'event: error\ndata: {"status":504,"detail":"graph query timed out"}\n\n';

describe("parseFrame", () => {
  it("validates a known event and ignores unknown ones", () => {
    expect(parseFrame(stepFrame.trim())).toEqual({
      type: "agent_step",
      data: { phase: "round_started", round: 1, tool_calls: 0 },
    });
    expect(parseFrame("event: heartbeat\ndata: {}")).toBeNull();
  });

  it("rejects an event that breaks the contract", () => {
    expect(() => parseFrame('event: agent_step\ndata: {"phase":"dreaming","round":1}')).toThrow(
      /broke the contract/,
    );
  });
});

describe("streamInvestigation", () => {
  it("yields events in order even when frames are split across chunks", async () => {
    const whole = stepFrame + errorFrame;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => streamOf([whole.slice(0, 17), whole.slice(17, 70), whole.slice(70)])),
    );
    const events: StreamEvent[] = [];
    await streamInvestigation(request, {
      signal: new AbortController().signal,
      onEvent: (event) => events.push(event),
    });
    expect(events.map((event) => event.type)).toEqual(["agent_step", "error"]);
  });

  it("surfaces a refusal before the stream as an HTTP error with its detail", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ detail: "transaction not scored" }), { status: 404 }),
      ),
    );
    await expect(
      streamInvestigation(request, {
        signal: new AbortController().signal,
        onEvent: () => undefined,
      }),
    ).rejects.toMatchObject({ kind: "http", status: 404, detail: "transaction not scored" });
  });
});
