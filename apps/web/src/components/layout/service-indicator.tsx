"use client";

import { CircleCheck, CircleDashed, CircleX, type LucideIcon } from "lucide-react";

import { useHealth } from "@/hooks/use-health";
import { cn } from "@/lib/cn";

type Line = { label: string; state: string; icon: LucideIcon; className: string };

const OK = { icon: CircleCheck, className: "text-safe" };
const DOWN = { icon: CircleX, className: "text-critical" };
const OFF = { icon: CircleDashed, className: "text-fg-muted" };

export function ServiceIndicator({ compact = false }: { compact?: boolean }) {
  const health = useHealth();

  let lines: Line[];
  if (health.isPending) {
    lines = [{ label: "API", state: "Checking", ...OFF }];
  } else if (health.isError) {
    lines = [{ label: "API", state: "Unreachable", ...DOWN }];
  } else {
    const { falkordb, llm } = health.data;
    lines = [
      { label: "API", state: "Online", ...OK },
      {
        label: "FalkorDB",
        state:
          falkordb === "available"
            ? "Available"
            : falkordb === "unavailable"
              ? "Unavailable"
              : "Not configured",
        ...(falkordb === "available" ? OK : falkordb === "unavailable" ? DOWN : OFF),
      },
      {
        label: "LLM agent",
        state: llm === "configured" ? "Configured" : "Off",
        ...(llm === "configured" ? OK : OFF),
      },
    ];
  }

  if (compact) {
    const worst = lines.find((line) => line.className === DOWN.className) ?? lines[0];
    if (!worst) return null;
    const Icon = worst.icon;
    return (
      <span className="flex items-center gap-1.5 text-xs text-fg-secondary">
        <Icon className={cn("size-3.5", worst.className)} aria-hidden />
        {worst.label} {worst.state.toLowerCase()}
      </span>
    );
  }

  return (
    <dl className="space-y-1.5 text-xs" aria-live="polite">
      {lines.map(({ label, state, icon: Icon, className }) => (
        <div key={label} className="flex items-center justify-between gap-2">
          <dt className="text-fg-muted">{label}</dt>
          <dd className="flex items-center gap-1.5 text-fg-secondary">
            <Icon className={cn("size-3.5", className)} aria-hidden />
            {state}
          </dd>
        </div>
      ))}
    </dl>
  );
}
