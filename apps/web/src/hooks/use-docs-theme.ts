"use client";

import { useSyncExternalStore } from "react";

export type DocsTheme = "dark" | "light";

const STORAGE_KEY = "traceaml-docs-theme";
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  // Another tab may change the saved theme; adopt it here too.
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

function readTheme(): DocsTheme {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "light" || saved === "dark") return saved;
  } catch {
    // Storage access blocked
  }
  return "dark";
}

const serverTheme = (): DocsTheme => "dark";
const emptySubscribe = () => () => {};

/**
 * The docs page theme, kept in localStorage as an external store. The server
 * always renders the dark theme and the browser adopts the saved choice after
 * hydration, so the markup stays consistent without hydration mismatches.
 */
export function useDocsTheme() {
  const isHydrated = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );

  const storeTheme = useSyncExternalStore(subscribe, readTheme, serverTheme);
  const theme = isHydrated ? storeTheme : "dark";

  const setTheme = (next: DocsTheme) => {
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Storage access blocked
    }
    for (const listener of listeners) listener();
  };

  return { theme, setTheme };
}
