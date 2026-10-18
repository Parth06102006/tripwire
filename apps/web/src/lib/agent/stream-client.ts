/**
 * Client for POST /api/investigations/stream (server-sent events over a POST,
 * so it reads the response body rather than using EventSource). Every frame
 * is validated with its schema before it reaches the UI.
 */
import type { z } from "zod";

import { ApiError } from "@/lib/api-client";
import {
  investigationResponseSchema,
  streamAgentStepSchema,
  streamErrorSchema,
  streamStartedSchema,
  streamToolFinishedSchema,
  streamToolStartedSchema,
  type InvestigationRequest,
} from "@/lib/api-schemas";

const EVENT_SCHEMAS = {
  started: streamStartedSchema,
  tool_started: streamToolStartedSchema,
  tool_completed: streamToolFinishedSchema,
  tool_failed: streamToolFinishedSchema,
  agent_step: streamAgentStepSchema,
  investigation_completed: investigationResponseSchema,
  error: streamErrorSchema,
} as const;

type EventSchemas = typeof EVENT_SCHEMAS;
export type StreamEventType = keyof EventSchemas;
export type StreamEvent = {
  [K in StreamEventType]: { type: K; data: z.output<EventSchemas[K]> };
}[StreamEventType];

function isEventType(value: string): value is StreamEventType {
  return value in EVENT_SCHEMAS;
}

/** Parse one SSE frame. Unknown event names are ignored, as SSE intends. */
export function parseFrame(frame: string): StreamEvent | null {
  let name = "";
  const data: string[] = [];
  for (const line of frame.split("\n")) {
    if (line.startsWith("event:")) name = line.slice(6).trim();
    else if (line.startsWith("data:")) data.push(line.slice(5).trimStart());
  }
  if (!isEventType(name) || data.length === 0) return null;
  let payload: unknown;
  try {
    payload = JSON.parse(data.join("\n"));
  } catch {
    throw new ApiError("invalid_response", `stream event ${name} was not JSON`, 200, null);
  }
  const parsed = EVENT_SCHEMAS[name].safeParse(payload);
  if (!parsed.success) {
    throw new ApiError("invalid_response", `stream event ${name} broke the contract`, 200, null);
  }
  return { type: name, data: parsed.data } as StreamEvent;
}

async function readDetail(response: Response): Promise<string | null> {
  try {
    const payload: unknown = await response.json();
    if (payload && typeof payload === "object" && "detail" in payload) {
      const { detail } = payload as { detail: unknown };
      if (typeof detail === "string") return detail;
    }
  } catch {
    // No JSON detail.
  }
  return null;
}

/** Stream one investigation, calling `onEvent` for each validated event in order. */
export async function streamInvestigation(
  request: InvestigationRequest,
  { signal, onEvent }: { signal: AbortSignal; onEvent: (event: StreamEvent) => void },
): Promise<void> {
  let response: Response;
  try {
    response = await fetch("/api/investigations/stream", {
      method: "POST",
      headers: { "content-type": "application/json", accept: "text/event-stream" },
      body: JSON.stringify(request),
      signal,
      cache: "no-store",
    });
  } catch (error) {
    if (signal.aborted) throw new ApiError("aborted", "request cancelled", null, null);
    throw new ApiError(
      "network",
      error instanceof Error ? error.message : "network error",
      null,
      null,
    );
  }
  if (!response.ok || !response.body) {
    const detail = await readDetail(response);
    throw new ApiError("http", detail ?? `HTTP ${response.status}`, response.status, detail);
  }

  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += value.replaceAll("\r\n", "\n");
      let boundary = buffer.indexOf("\n\n");
      while (boundary !== -1) {
        const event = parseFrame(buffer.slice(0, boundary));
        buffer = buffer.slice(boundary + 2);
        if (event) onEvent(event);
        boundary = buffer.indexOf("\n\n");
      }
    }
  } catch (error) {
    if (signal.aborted) throw new ApiError("aborted", "request cancelled", null, null);
    throw error;
  }
  if (buffer.trim()) {
    const event = parseFrame(buffer);
    if (event) onEvent(event);
  }
}
