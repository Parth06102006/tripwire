"use client";

import Link from "next/link";
import { ArrowRight, Waypoints, Gauge } from "lucide-react";

export function DocsFooter() {
  return (
    <footer className="mt-16 border-t border-border-strong pt-10">
      {/* Live Workbench Launch Cards */}
      <div>
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
