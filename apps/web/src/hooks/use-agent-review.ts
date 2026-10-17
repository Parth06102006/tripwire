"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useLayoutEffect, useReducer, useRef, useState } from "react";

import { streamInvestigation, type StreamEvent } from "@/lib/agent/stream-client";
import {
  initialReviewState,
  isStreaming,
  reviewReducer,
  type ReviewState,
} from "@/lib/agent/session";
import { isApiError } from "@/lib/api-client";
import type { InvestigationRequest } from "@/lib/api-schemas";
import { queryKeys } from "@/lib/query-client";

export type ReviewBounds = Omit<InvestigationRequest, "transaction_id" | "act">;

export const DEFAULT_REVIEW_BOUNDS: ReviewBounds = {
  max_hops: 2,
  time_window_seconds: 86_400,
  result_limit: 50,
  use_llm: false,
};

/**
 * Pause after showing each event so the graph visibly grows between tool
 * calls. Events are never invented or reordered; only their display is
 * spaced. The deterministic agent finishes in tens of milliseconds, which
 * would otherwise show as one jump. Reduced motion or "Show all now" skips it.
 */
const DISPLAY_GAP_MS: Partial<Record<StreamEvent["type"], number>> = {
  started: 350,
  tool_started: 300,
  tool_completed: 700,
  tool_failed: 500,
  agent_step: 150,
};

/** `end` marks the close of the HTTP stream; a run still open then ended early. */
type Queued = { run: number; event: StreamEvent } | { run: number; end: true };

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export type AgentReview = {
  state: ReviewState;
  streaming: boolean;
  /** Events received but not yet shown. */
  pending: number;
  start: (bounds: ReviewBounds, options?: { act?: boolean }) => void;
  stop: () => void;
  showAll: () => void;
};

export function useAgentReview(transactionId: string): AgentReview {
  const queryClient = useQueryClient();
  const [state, dispatch] = useReducer(reviewReducer, initialReviewState);
  const [pending, setPending] = useState(0);

  const queue = useRef<Queued[]>([]);
  const readyAt = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const paced = useRef(true);
  const runCounter = useRef(0);
  const inflight = useRef<{ run: number; controller: AbortController } | null>(null);
  // The display timer calls the latest pump through this ref.
  const pumpRef = useRef<() => void>(() => undefined);

  const pump = useCallback(() => {
    timer.current = null;
    while (queue.current.length > 0) {
      const now = performance.now();
      if (paced.current && now < readyAt.current) {
        timer.current = setTimeout(() => pumpRef.current(), readyAt.current - now);
        break;
      }
      const next = queue.current.shift();
      if (!next) break;
      if ("end" in next) {
        // Ignored by the reducer when the run already completed or failed.
        dispatch({
          type: "failed",
          run: next.run,
          failure: {
            kind: "network",
            status: null,
            detail: null,
            message: "the stream ended before the investigation completed",
          },
        });
        continue;
      }
      dispatch({ type: "event", run: next.run, event: next.event });
      if (next.event.type === "investigation_completed") {
        // A gated case action may have written to the case store.
        void queryClient.invalidateQueries({ queryKey: queryKeys.cases });
      }
      readyAt.current =
        performance.now() + (paced.current ? (DISPLAY_GAP_MS[next.event.type] ?? 0) : 0);
    }
    setPending(queue.current.length);
  }, [queryClient]);

  useLayoutEffect(() => {
    pumpRef.current = pump;
  }, [pump]);

  const enqueue = useCallback(
    (item: Queued) => {
      queue.current.push(item);
      setPending(queue.current.length);
      if (timer.current === null) pump();
    },
    [pump],
  );

  const flush = useCallback(() => {
    paced.current = false;
    if (timer.current !== null) clearTimeout(timer.current);
    pump();
  }, [pump]);

  const stop = useCallback(() => {
    const current = inflight.current;
    if (!current) return;
    inflight.current = null;
    current.controller.abort();
    flush();
    dispatch({ type: "stopped", run: current.run });
  }, [flush]);

  const start = useCallback(
    (bounds: ReviewBounds, { act = false }: { act?: boolean } = {}) => {
      stop();
      runCounter.current += 1;
      const run = runCounter.current;
      const controller = new AbortController();
      inflight.current = { run, controller };
      paced.current = !prefersReducedMotion();
      readyAt.current = 0;
      const request: InvestigationRequest = { transaction_id: transactionId, ...bounds, act };
      dispatch({ type: "requested", run, request, at: Date.now() });

      streamInvestigation(request, {
        signal: controller.signal,
        onEvent: (event) => enqueue({ run, event }),
      }).then(
        () => {
          if (inflight.current?.run === run) inflight.current = null;
          enqueue({ run, end: true });
        },
        (error: unknown) => {
          if (controller.signal.aborted) return;
          if (inflight.current?.run === run) inflight.current = null;
          // Show what already arrived before the failure.
          flush();
          dispatch({
            type: "failed",
            run,
            failure: isApiError(error)
              ? {
                  kind: error.kind,
                  status: error.status,
                  detail: error.detail,
                  message: error.message,
                }
              : { kind: "network", status: null, detail: null, message: "stream failed" },
          });
        },
      );
    },
    [transactionId, enqueue, flush, stop],
  );

  // Leaving the screen cancels the stream.
  useEffect(
    () => () => {
      inflight.current?.controller.abort();
      if (timer.current !== null) clearTimeout(timer.current);
    },
    [],
  );

  return {
    state,
    streaming: isStreaming(state),
    pending,
    start,
    stop,
    showAll: flush,
  };
}
