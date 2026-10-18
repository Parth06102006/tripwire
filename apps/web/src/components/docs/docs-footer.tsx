"use client";

import Link from "next/link";
import { ArrowRight, ThumbsUp, Waypoints, Gauge } from "lucide-react";

interface DocsFooterProps {
  claps: number;
  onClap: () => void;
}

export function DocsFooter({ claps, onClap }: DocsFooterProps) {
  return (
    <footer className="mt-16 border-t border-border-strong pt-10">
      {/* Claps & Feedback Bar */}
      <div className="flex flex-col items-center justify-between gap-4 rounded-xl border border-border-strong bg-surface p-6 sm:flex-row">
        <div className="text-center sm:text-left">
          <h4 className="text-sm font-semibold text-fg">Was this guide insightful?</h4>
          <p className="text-xs text-fg-muted">
            Give it an applause or share it with fellow AML engineers and risk analysts.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onClap}
            className="flex items-center gap-2 rounded-full border border-border-strong bg-surface-sunken px-4 py-2 text-xs font-semibold text-fg transition-all hover:border-accent hover:text-accent"
          >
            <ThumbsUp className="size-4" aria-hidden />
            <span>Applaud Guide</span>
            <span className="font-mono text-accent">{claps}</span>
          </button>
        </div>
      </div>

      {/* Author Bio Card */}
      <div className="mt-10 flex flex-col gap-4 rounded-xl border border-border-strong bg-surface-sunken p-6 sm:flex-row sm:items-center">
        <div className="flex size-14 shrink-0 items-center justify-center rounded-full bg-accent text-lg font-bold text-accent-ink shadow-sm">
          TA
        </div>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-semibold text-fg">
              Tripwire Engineering & Detection Group
            </h4>
            <span className="text-3xs rounded bg-accent-soft px-2 py-0.5 font-semibold text-accent uppercase">
              Author
            </span>
          </div>
          <p className="text-xs leading-relaxed text-fg-secondary">
            Tripwire is built by a dedicated team of graph engineers, machine learning researchers,
            and financial crime specialists. We develop deterministic and agentic intelligence
            tooling to help compliance teams outpace structured illicit networks.
          </p>
        </div>
      </div>

      {/* Live Workbench Launch Cards */}
      <div className="mt-10">
        <h4 className="mb-4 text-xs font-semibold tracking-wider text-fg-muted uppercase">
          Explore the Live Application
        </h4>
        <div className="grid gap-4 sm:grid-cols-3">
          <Link
            href="/overview"
            className="group rounded-lg border border-border-strong bg-surface p-4 transition-all hover:border-accent hover:bg-surface-elevated"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-fg group-hover:text-accent">
                Overview Triage
              </span>
              <ArrowRight
                className="size-3.5 text-fg-muted transition-transform group-hover:translate-x-1 group-hover:text-accent"
                aria-hidden
              />
            </div>
            <p className="mt-2 text-2xs text-fg-muted">
              Inspect the live alert queue with prioritized review triage and instant peek drawer.
            </p>
          </Link>

          <Link
            href="/investigation"
            className="group rounded-lg border border-border-strong bg-surface p-4 transition-all hover:border-accent hover:bg-surface-elevated"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-fg group-hover:text-accent">
                Investigation Workstation
              </span>
              <Waypoints
                className="size-3.5 text-fg-muted transition-transform group-hover:translate-x-1 group-hover:text-accent"
                aria-hidden
              />
            </div>
            <p className="mt-2 text-2xs text-fg-muted">
              Explore dynamic Cytoscape graph canvas with traveling animated cash flow edges.
            </p>
          </Link>

          <Link
            href="/performance"
            className="group rounded-lg border border-border-strong bg-surface p-4 transition-all hover:border-accent hover:bg-surface-elevated"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-fg group-hover:text-accent">
                Performance Lab
              </span>
              <Gauge
                className="size-3.5 text-fg-muted transition-transform group-hover:translate-x-1 group-hover:text-accent"
                aria-hidden
              />
            </div>
            <p className="mt-2 text-2xs text-fg-muted">
              Simulate operational alert budget scenarios and inspect FalkorDB latency metrics.
            </p>
          </Link>
        </div>
      </div>
    </footer>
  );
}
