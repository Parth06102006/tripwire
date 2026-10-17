"use client";

import { useSyncExternalStore } from "react";
import {
  ApiError,
  fetchJson,
  isAlertsResponse,
  isBenchmarksResponse,
  isHealthResponse,
  type AlertsResponse,
  type BenchmarksResponse,
  type HealthResponse,
} from "./api";

/**
 * Real requests to the API, timed in the browser. They are the only runtime
 * measurements the System page shows, so they are labelled as browser round
 * trips. The API has no metrics endpoint.
 */
export type ProbeName = "health" | "score_artifact" | "benchmark_artifact";

export interface ProbeSample {
  name: ProbeName;
  at: string;
  ok: boolean;
  ms: number;
  httpStatus?: number;
  detail?: string;
}

const MAX_SAMPLES = 60;
let samples: readonly ProbeSample[] = [];
const listeners = new Set<() => void>();

function push(sample: ProbeSample): void {
  samples = [sample, ...samples].slice(0, MAX_SAMPLES);
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useProbeSamples(): readonly ProbeSample[] {
  return useSyncExternalStore(subscribe, () => samples, () => samples);
}

async function timed<T>(name: ProbeName, run: () => Promise<T>): Promise<T> {
  const started = performance.now();
  const at = new Date().toISOString();
  try {
    const value = await run();
    push({ name, at, ok: true, ms: performance.now() - started });
    return value;
  } catch (error) {
    push({
      name,
      at,
      ok: false,
      ms: performance.now() - started,
      httpStatus: error instanceof ApiError ? error.status : undefined,
      detail: error instanceof ApiError ? error.detail : "Unexpected client error.",
    });
    throw error;
  }
}

export const probeHealth = (): Promise<HealthResponse> =>
  timed("health", () => fetchJson<HealthResponse>("/api/health", undefined, isHealthResponse));

export const probeScoreArtifact = (): Promise<AlertsResponse> =>
  timed("score_artifact", () =>
    fetchJson<AlertsResponse>("/api/alerts?limit=1&offset=0", undefined, isAlertsResponse),
  );

export const probeBenchmarkArtifact = (): Promise<BenchmarksResponse> =>
  timed("benchmark_artifact", () =>
    fetchJson<BenchmarksResponse>("/api/benchmarks", undefined, isBenchmarksResponse),
  );

export function percentile(values: number[], fraction: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.floor(sorted.length * fraction));
  return sorted[index];
}
