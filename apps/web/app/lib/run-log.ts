"use client";

import { useSyncExternalStore } from "react";
import type { InvestigationOutcome, ToolTraceEntry } from "./api";

/**
 * Investigation attempts made from this browser tab.
 *
 * The API exposes no run history endpoint, so this log is the only source for
 * "recent runs" and "execution failures". It is session scoped by design and
 * every consumer labels it that way; nothing here is read from the backend.
 */
export interface RunLogEntry {
  id: string;
  at: string;
  transactionId: string;
  useLlm: boolean;
  status: "completed" | "failed";
  durationMs: number;
  httpStatus?: number;
  error?: string;
  investigationId?: string;
  decision?: "allow" | "review";
  outcome?: InvestigationOutcome;
  llmStatus?: "completed" | "fallback" | "unavailable";
  llmFallbackReason?: string | null;
  toolTrace?: ToolTraceEntry[];
}

const STORAGE_KEY = "traceaml.run-log.v1";
const MAX_ENTRIES = 25;
const EMPTY: readonly RunLogEntry[] = [];

let entries: readonly RunLogEntry[] | null = null;
const listeners = new Set<() => void>();

function load(): readonly RunLogEntry[] {
  if (entries) return entries;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    entries = Array.isArray(parsed) ? (parsed as RunLogEntry[]) : [];
  } catch {
    entries = [];
  }
  return entries;
}

export function recordRun(entry: RunLogEntry): void {
  entries = [entry, ...load()].slice(0, MAX_ENTRIES);
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Storage can be blocked; the in-memory log still serves this page view.
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useRunLog(): readonly RunLogEntry[] {
  return useSyncExternalStore(subscribe, load, () => EMPTY);
}
