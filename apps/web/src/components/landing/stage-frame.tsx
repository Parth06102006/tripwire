"use client";

import type { ReactNode } from "react";

import { Badge, type BadgeTone } from "@/components/ui/badge";
import { cn } from "@/lib/cn";

/**
 * Chrome shared by the four "How it works" stages: the step name and one live
 * status chip on top, the interactive body in the middle, and a hint line at
 * the bottom. Every stage runs on illustrative data, so each one carries the
 * tag and nothing here touches the API.
 */

/** Live status chip for a stage header. Tone carries the same meaning as the workbench badges. */
export function StageChip({
  tone,
  children,
  live = false,
  className,
}: {
  tone: BadgeTone;
  children: ReactNode;
  /** Announce changes politely, for state the pointer can change too. */
  live?: boolean;
  className?: string;
}) {
  return (
    <Badge
      tone={tone}
      aria-live={live ? "polite" : undefined}
      className={cn("gap-1.5 rounded-full px-2.5 py-1 font-mono text-[11px]", className)}
    >
      {children}
    </Badge>
  );
}

export type StageFrameProps = {
  /** Step name, shown in the header. */
  label: string;
  /** Status chip, built with StageChip. */
  status: ReactNode;
  /**
   * One line under the stage. Stages pass the line for the current state, so
   * the hint doubles as the outcome of whatever the visitor just did.
   */
  hint: string;
  children: ReactNode;
};

export function StageFrame({ label, status, hint, children }: StageFrameProps) {
  return (
    <div className="relative flex size-full flex-col">
      <div aria-hidden="true" className="stage-grid pointer-events-none absolute inset-0" />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(75%_45%_at_50%_0%,rgba(242,140,56,0.1),transparent_70%)]"
      />
      <div className="relative flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-4 pt-4 sm:px-5 sm:pt-5">
        <p className="font-mono text-[11px] tracking-[0.22em] text-accent uppercase">{label}</p>
        {status}
      </div>
      <div className="relative flex min-h-0 flex-1 flex-col px-4 pt-4 pb-4 sm:px-5 sm:pt-5 sm:pb-5">
        {children}
      </div>
      <div className="relative flex items-center justify-between gap-4 border-t border-line px-4 py-3 sm:px-5">
        <p className="text-[12px] leading-5 text-dim">{hint}</p>
        <p className="shrink-0 font-mono text-[10px] tracking-[0.16em] text-dim/80 uppercase">
          illustrative
        </p>
      </div>
    </div>
  );
}
