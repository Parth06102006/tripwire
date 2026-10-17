"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * The case API requires a reviewer identifier but the app has no sign-in, so
 * the analyst types one and it is remembered in this browser only.
 */
const KEY = "traceaml.analyst-id";
const listeners = new Set<() => void>();

function read(): string {
  try {
    return window.localStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useAnalystId(): [string, (value: string) => void] {
  const value = useSyncExternalStore(subscribe, read, () => "");
  const set = useCallback((next: string) => {
    try {
      window.localStorage.setItem(KEY, next);
    } catch {
      // Blocked storage only means the id is not remembered next time.
    }
    listeners.forEach((listener) => listener());
  }, []);
  return [value, set];
}
