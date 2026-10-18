"use client";

import { Activity, Cpu, Database, Info, ShieldCheck } from "lucide-react";

import { ServiceIndicator } from "@/components/layout/service-indicator";
import { Panel } from "@/components/shared/states";
import { useHealth } from "@/hooks/use-health";

export function OperationalStatus() {
  const health = useHealth();
  const falkorStatus = health.data?.falkordb ?? "unknown";
  const isGraphAvailable = falkorStatus === "available";

  return (
    <Panel
      title="System Telemetry"
      description={health.data ? `TraceAML Core v${health.data.version}` : "Polled every 30s"}
    >
      <div className="space-y-4">
        {/* Service connection strip */}
        <div className="rounded-md border border-border/80 bg-surface-sunken p-3">
          <ServiceIndicator />
        </div>

        {/* Specifications grid */}
        <div className="space-y-2.5 text-xs">
          <div className="flex items-center justify-between border-b border-border/50 pb-2">
            <span className="flex items-center gap-1.5 text-fg-muted">
              <Database className="size-3.5 text-accent" aria-hidden />
              Graph authority
            </span>
            <span className="font-medium text-fg">
              {isGraphAvailable ? "FalkorDB Connected" : "Disconnected"}
            </span>
          </div>

          <div className="flex items-center justify-between border-b border-border/50 pb-2">
            <span className="flex items-center gap-1.5 text-fg-muted">
              <Cpu className="size-3.5 text-accent" aria-hidden />
              Policy engine
            </span>
            <span className="font-medium text-fg">Deterministic (v1)</span>
          </div>

          <div className="flex items-center justify-between border-b border-border/50 pb-2">
            <span className="flex items-center gap-1.5 text-fg-muted">
              <Activity className="size-3.5 text-accent" aria-hidden />
              Replay source
            </span>
            <span className="font-mono text-2xs text-fg-secondary">IBM AMLworld</span>
          </div>

          <div className="flex items-center justify-between pb-1">
            <span className="flex items-center gap-1.5 text-fg-muted">
              <ShieldCheck className="size-3.5 text-safe" aria-hidden />
              Execution safety
            </span>
            <span className="text-2xs text-safe">Zero-loss simulation</span>
          </div>
        </div>

        {/* Operational Invariants Notice */}
        <div className="rounded-md border border-border/70 bg-surface-elevated/40 p-3 text-xs">
          <div className="flex items-center gap-1.5 font-medium text-fg">
            <Info className="size-3.5 text-fg-muted" aria-hidden />
            Architectural Guarantees
          </div>
          <p className="mt-1.5 text-2xs leading-relaxed text-fg-secondary">
            Decisions are deterministic policy proposals: scores at or above the validation
            threshold route to human analyst review. FalkorDB serves as the exclusive structural
            evidence source.
          </p>
        </div>
      </div>
    </Panel>
  );
}
