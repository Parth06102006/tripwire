"use client";

import { FastForward, Play, RotateCw, Square } from "lucide-react";
import { useId } from "react";

import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import type { ReviewBounds } from "@/hooks/use-agent-review";
import { formatWindow } from "@/lib/formatters";

const HOPS = [1, 2, 3] as const;
const WINDOWS = [3_600, 21_600, 86_400, 259_200, 604_800, 2_592_000] as const;
const LIMITS = [25, 50, 100] as const;

export function Composer({
  bounds,
  onChange,
  onStart,
  onStop,
  onShowAll,
  streaming,
  pending,
  hasRun,
  llmConfigured,
}: {
  bounds: ReviewBounds;
  onChange: (bounds: ReviewBounds) => void;
  onStart: () => void;
  onStop: () => void;
  onShowAll: () => void;
  streaming: boolean;
  pending: number;
  hasRun: boolean;
  llmConfigured: boolean;
}) {
  const id = useId();
  return (
    <form
      className="border-t border-border bg-sidebar px-4 py-3"
      onSubmit={(event) => {
        event.preventDefault();
        onStart();
      }}
      aria-label="Review settings"
    >
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-[11px] text-fg-muted" htmlFor={`${id}-hops`}>
          Hops
          <Select
            id={`${id}-hops`}
            value={bounds.max_hops}
            disabled={streaming}
            onChange={(event) => onChange({ ...bounds, max_hops: Number(event.target.value) })}
            className="h-7 w-[4.5rem] text-xs"
          >
            {HOPS.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </Select>
        </label>
        <label className="flex flex-col gap-1 text-[11px] text-fg-muted" htmlFor={`${id}-window`}>
          Window
          <Select
            id={`${id}-window`}
            value={bounds.time_window_seconds}
            disabled={streaming}
            onChange={(event) =>
              onChange({ ...bounds, time_window_seconds: Number(event.target.value) })
            }
            className="h-7 w-28 text-xs"
          >
            {WINDOWS.map((value) => (
              <option key={value} value={value}>
                {formatWindow(value)}
              </option>
            ))}
          </Select>
        </label>
        <label className="flex flex-col gap-1 text-[11px] text-fg-muted" htmlFor={`${id}-limit`}>
          Limit
          <Select
            id={`${id}-limit`}
            value={bounds.result_limit}
            disabled={streaming}
            onChange={(event) => onChange({ ...bounds, result_limit: Number(event.target.value) })}
            className="h-7 w-20 text-xs"
          >
            {LIMITS.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </Select>
        </label>
        <label className="flex h-7 items-center gap-1.5 self-end text-xs text-fg-secondary has-disabled:opacity-50">
          <input
            type="checkbox"
            className="size-3.5 accent-accent"
            checked={bounds.use_llm}
            disabled={streaming}
            onChange={(event) => onChange({ ...bounds, use_llm: event.target.checked })}
          />
          Gemini agent
        </label>
        <div className="ml-auto self-end">
          {streaming ? (
            <Button type="button" size="sm" onClick={onStop}>
              <Square /> Stop
            </Button>
          ) : (
            <Button type="submit" size="sm" variant="primary">
              {hasRun ? <RotateCw /> : <Play />} {hasRun ? "Review again" : "Start review"}
            </Button>
          )}
        </div>
      </div>
      <p className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[10px] text-fg-muted">
        <span>
          {bounds.use_llm && !llmConfigured
            ? "No LLM key is configured on the API host; the policy agent will run instead and no risk level is produced."
            : "Steps appear at a readable pace; every duration shown was measured by the API."}
        </span>
        {pending > 0 ? (
          <button
            type="button"
            onClick={onShowAll}
            className="flex items-center gap-1 rounded-sm text-fg-secondary hover:text-fg"
          >
            <FastForward className="size-3" aria-hidden /> Show all now
          </button>
        ) : null}
      </p>
    </form>
  );
}
