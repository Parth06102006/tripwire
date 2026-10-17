import {
  CircleAlert,
  CircleCheck,
  CircleDashed,
  CircleHelp,
  CircleX,
  Loader,
  TriangleAlert,
} from "lucide-react";
import type { ReactNode } from "react";
import { cx } from "./card";

export type Tone = "neutral" | "accent" | "safe" | "warning" | "critical";

const TONE_CLASS: Record<Tone, string> = {
  neutral: "border-line-strong text-dim",
  accent: "border-accent/40 bg-accent-soft text-accent",
  safe: "border-safe/40 bg-safe/10 text-safe",
  warning: "border-warning/40 bg-warning/10 text-warning",
  critical: "border-critical/40 bg-critical/10 text-critical",
};

const TONE_ICON: Record<Tone, typeof CircleCheck> = {
  neutral: CircleDashed,
  accent: CircleAlert,
  safe: CircleCheck,
  warning: TriangleAlert,
  critical: CircleX,
};

interface StatusBadgeProps {
  tone: Tone;
  children: ReactNode;
  icon?: typeof CircleCheck | "none";
  title?: string;
}

/** Colour is never the only signal: every badge carries an icon and a text label. */
export function StatusBadge({ tone, children, icon, title }: StatusBadgeProps) {
  const Icon = icon === "none" ? null : (icon ?? TONE_ICON[tone]);
  return (
    <span
      title={title}
      className={cx(
        "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        TONE_CLASS[tone],
      )}
    >
      {Icon ? <Icon aria-hidden="true" className="h-3 w-3" /> : null}
      {children}
    </span>
  );
}

export function DecisionBadge({ decision }: { decision: "allow" | "review" }) {
  return decision === "review" ? (
    <StatusBadge tone="warning" icon={TriangleAlert} title="Deterministic policy decision">
      Review
    </StatusBadge>
  ) : (
    <StatusBadge tone="neutral" icon={CircleCheck} title="Deterministic policy decision">
      Allow
    </StatusBadge>
  );
}

export type ServiceState =
  | "healthy"
  | "degraded"
  | "failed"
  | "configured"
  | "not_configured"
  | "unknown"
  | "checking";

const SERVICE_MAP: Record<ServiceState, { tone: Tone; label: string; icon: typeof CircleCheck }> = {
  healthy: { tone: "safe", label: "Healthy", icon: CircleCheck },
  degraded: { tone: "warning", label: "Degraded", icon: TriangleAlert },
  failed: { tone: "critical", label: "Failed", icon: CircleX },
  configured: { tone: "neutral", label: "Configured, unverified", icon: CircleCheck },
  not_configured: { tone: "neutral", label: "Not configured", icon: CircleDashed },
  unknown: { tone: "neutral", label: "Unknown", icon: CircleHelp },
  checking: { tone: "neutral", label: "Checking", icon: Loader },
};

export function ServiceBadge({ state }: { state: ServiceState }) {
  const meta = SERVICE_MAP[state];
  const Icon = meta.icon;
  // Keyed on state so the icon swaps with a short animation on real changes.
  return (
    <StatusBadge tone={meta.tone} icon="none" title={`Service state: ${meta.label}`}>
      <Icon key={state} aria-hidden="true" className="icon-swap h-3 w-3" />
      {meta.label}
    </StatusBadge>
  );
}
