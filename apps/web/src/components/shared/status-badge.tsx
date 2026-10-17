import {
  Ban,
  CircleCheck,
  CircleDashed,
  CircleSlash,
  Flag,
  FolderOpen,
  ShieldAlert,
  TriangleAlert,
  Waypoints,
  type LucideIcon,
} from "lucide-react";

import { Badge, type BadgeTone } from "@/components/ui/badge";
import type { CaseStatus, Decision, InvestigationOutcome, ModelRoute } from "@/lib/api-schemas";
import { OUTCOME_LABEL } from "@/lib/investigation/outcomes";

type StatusSpec = { label: string; tone: BadgeTone; icon: LucideIcon };

const DECISION: Record<Decision, StatusSpec> = {
  review: { label: "Review", tone: "review", icon: Flag },
  allow: { label: "Allow", tone: "neutral", icon: CircleCheck },
};

const OUTCOME: Record<InvestigationOutcome, StatusSpec> = {
  evidence_found: { label: OUTCOME_LABEL.evidence_found, tone: "verified", icon: Waypoints },
  no_matching_path: { label: OUTCOME_LABEL.no_matching_path, tone: "neutral", icon: CircleDashed },
  unknown_anchor: { label: OUTCOME_LABEL.unknown_anchor, tone: "critical", icon: CircleSlash },
  inconclusive: { label: OUTCOME_LABEL.inconclusive, tone: "review", icon: TriangleAlert },
};

const CASE: Record<CaseStatus, StatusSpec> = {
  suspected: { label: "Suspected", tone: "review", icon: FolderOpen },
  under_review: { label: "Under review", tone: "review", icon: FolderOpen },
  confirmed: { label: "Confirmed", tone: "critical", icon: ShieldAlert },
  dismissed: { label: "Dismissed", tone: "neutral", icon: CircleSlash },
};

function SpecBadge({ spec }: { spec: StatusSpec }) {
  const Icon = spec.icon;
  return (
    <Badge tone={spec.tone}>
      <Icon aria-hidden />
      {spec.label}
    </Badge>
  );
}

export function DecisionBadge({ decision }: { decision: Decision }) {
  return <SpecBadge spec={DECISION[decision]} />;
}

export function OutcomeBadge({ outcome }: { outcome: InvestigationOutcome }) {
  return <SpecBadge spec={OUTCOME[outcome]} />;
}

const ROUTE: Record<ModelRoute, StatusSpec> = {
  blocked_by_rule: { label: "Blocked by rule", tone: "critical", icon: Ban },
  flagged_for_review: { label: "Flagged for review", tone: "review", icon: Flag },
  standard_path: { label: "Standard path", tone: "neutral", icon: CircleCheck },
};

/** Where the model and rules send a transaction in the escalation chain. */
export function RouteBadge({ route }: { route: ModelRoute }) {
  return <SpecBadge spec={ROUTE[route]} />;
}

export function CaseStatusBadge({ status }: { status: CaseStatus }) {
  return <SpecBadge spec={CASE[status]} />;
}
