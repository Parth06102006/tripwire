"use client";

import { useState } from "react";

const FALLBACK = {
  ink: "#e6e7e5",
  dim: "#858985",
  accent: "#f28c38",
  line: "rgba(230, 231, 229, 0.1)",
  lineStrong: "rgba(230, 231, 229, 0.2)",
  raised: "#1b1c1c",
  hover: "rgba(230, 231, 229, 0.04)",
};

export type ChartColors = typeof FALLBACK;

const VARS: Record<keyof ChartColors, string> = {
  ink: "--ink",
  dim: "--dim",
  accent: "--accent",
  line: "--line",
  lineStrong: "--line-strong",
  raised: "--raised",
  hover: "--surface-hover",
};

/**
 * SVG presentation attributes do not reliably resolve var(), so chart
 * libraries get concrete values read from the same CSS tokens at runtime.
 */
export function useChartColors(): ChartColors {
  // Read once on first client render; charts mount only after data loads.
  const [colors] = useState<ChartColors>(() => {
    if (typeof document === "undefined") return FALLBACK;
    const style = getComputedStyle(document.documentElement);
    const next = { ...FALLBACK };
    for (const key of Object.keys(VARS) as (keyof ChartColors)[]) {
      const value = style.getPropertyValue(VARS[key]).trim();
      if (value) next[key] = value;
    }
    return next;
  });
  return colors;
}
