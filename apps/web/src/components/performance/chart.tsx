"use client";

import { BarChart, LineChart } from "echarts/charts";
import {
  AriaComponent,
  GridComponent,
  LegendComponent,
  TooltipComponent,
} from "echarts/components";
import * as echarts from "echarts/core";
import type { EChartsCoreOption } from "echarts/core";
import { SVGRenderer } from "echarts/renderers";
import ReactEChartsCore from "echarts-for-react/lib/core";
import { useState, type ReactNode } from "react";

import { cn } from "@/lib/cn";

// Only the pieces these charts use are registered, which keeps the bundle small.
echarts.use([
  BarChart,
  LineChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  AriaComponent,
  SVGRenderer,
]);

/**
 * Chart colours as literal values: ECharts paints with them directly and
 * cannot read CSS variables. They are the app's Obsidian tokens: text and
 * grid from the neutral scale, the selected model in the accent orange, and
 * the other series in blue and neutral greys, which stay distinguishable in
 * colour-vision deficiency and keep clear of the green, amber and red that
 * carry status elsewhere.
 */
export const CHART = {
  text: "#e6e7e5",
  textSecondary: "#a9ada9",
  textMuted: "#858985",
  grid: "#232424",
  axis: "#343535",
  surface: "#141515",
  accent: "#f28c38",
  series: ["#f28c38", "#6f9fd8", "#c8c9c6"] as const,
  // Ordered measures such as P50 then P95: a light then a strong accent.
  sequential: ["#f6bd88", "#f28c38"] as const,
};

/** Each model keeps its colour and name across every chart and table. */
const MODEL_STYLE: Record<string, { color: string; label: string; short: string }> = {
  iteration1_lgbm: {
    color: "#7d817d",
    label: "Iteration 1 LightGBM baseline",
    short: "Iteration 1",
  },
  c3: { color: "#6f9fd8", label: "C3: Iteration 1 features, regularized", short: "C3" },
  c2: { color: "#c8c9c6", label: "C2: all families except account registry", short: "C2" },
  c1: { color: CHART.accent, label: "C1: all seven families (selected)", short: "C1 (selected)" },
  logreg: { color: "#6f9fd8", label: "Logistic regression", short: "Logistic regression" },
  lgbm: { color: "#c8c9c6", label: "LightGBM", short: "LightGBM" },
  lgbm_graph: {
    color: CHART.accent,
    label: "LightGBM + graph features",
    short: "LightGBM + graph",
  },
};
export function modelColor(model: string): string {
  return MODEL_STYLE[model]?.color ?? CHART.textMuted;
}
export const modelLabel = (model: string) => MODEL_STYLE[model]?.label ?? model;
/** Compact name for chart axes and legends; the table carries the full label. */
export const modelShortLabel = (model: string) => MODEL_STYLE[model]?.short ?? model;

export const baseAxis = {
  axisLine: { lineStyle: { color: CHART.axis } },
  axisTick: { show: false },
  axisLabel: { color: CHART.textSecondary, fontSize: 11 },
  splitLine: { lineStyle: { color: CHART.grid } },
  nameTextStyle: { color: CHART.textMuted, fontSize: 11 },
};

export const baseTooltip = {
  backgroundColor: "#1b1c1c",
  borderColor: "#3a3b3b",
  textStyle: { color: CHART.text, fontSize: 12 },
  extraCssText: "border-radius:6px;box-shadow:0 8px 24px rgba(0,0,0,.4);",
};

/**
 * ECharts measures label widths itself, so it must use the font the page
 * actually renders; otherwise axis labels are clipped and legends overlap.
 */
function pageFontFamily(): string {
  if (typeof document === "undefined") return "sans-serif";
  return getComputedStyle(document.body).fontFamily || "sans-serif";
}

export function Chart({
  option,
  height = 240,
  title,
  summary,
  className,
  children,
}: {
  option: EChartsCoreOption;
  height?: number;
  title: string;
  /** Plain-language reading of the chart, shown under it and read by screen readers. */
  summary: ReactNode;
  className?: string;
  children?: ReactNode;
}) {
  const [fontFamily] = useState(pageFontFamily);
  return (
    <figure className={cn("min-w-0", className)}>
      <figcaption className="mb-1">
        <span className="text-xs font-medium text-fg">{title}</span>
      </figcaption>
      <ReactEChartsCore
        echarts={echarts}
        option={{
          aria: { enabled: true },
          textStyle: { fontFamily },
          animationDuration: 300,
          ...option,
        }}
        style={{ height, width: "100%" }}
        opts={{ renderer: "svg" }}
        notMerge
      />
      <p className="mt-1 text-[11px] text-fg-muted">{summary}</p>
      {children}
    </figure>
  );
}
