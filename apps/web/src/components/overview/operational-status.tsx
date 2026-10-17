"use client";

import { ServiceIndicator } from "@/components/layout/service-indicator";
import { Panel } from "@/components/shared/states";
import { useHealth } from "@/hooks/use-health";

export function OperationalStatus() {
  const health = useHealth();
  return (
    <Panel
      title="Service status"
      description={health.data ? `API version ${health.data.version}` : "Polled every 30 seconds"}
    >
      <ServiceIndicator />
      <div className="mt-4 space-y-2 border-t border-border pt-3 text-xs text-fg-secondary">
        <p>
          Investigations query the graph configured on the API host. A scored alert outside that
          graph opens with a clear not-in-graph message rather than an empty result.
        </p>
        <p>
          Decisions are deterministic policy: a score at or above the validation threshold is marked
          for review. Nothing here blocks a payment.
        </p>
      </div>
    </Panel>
  );
}
