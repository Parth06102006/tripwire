/** Shared wording for investigation outcomes and case-gate denials. */
import type { ActionDenialCode, InvestigationOutcome } from "@/lib/api-schemas";

export const OUTCOME_LABEL: Record<InvestigationOutcome, string> = {
  evidence_found: "Evidence found",
  no_matching_path: "No matching path",
  unknown_anchor: "Unknown anchor",
  inconclusive: "Inconclusive",
};

export const OUTCOME_EXPLANATION: Record<InvestigationOutcome, string> = {
  evidence_found: "At least one query returned a path or a flow pattern.",
  no_matching_path:
    "The graph was queried and nothing matched within these bounds. This is not evidence that the transaction is safe.",
  unknown_anchor: "The anchor transaction was not found in the graph.",
  inconclusive: "A result hit its cap or a query did not complete, so the evidence may be partial.",
};

export const DENIAL_LABEL: Record<ActionDenialCode, string> = {
  anchor_not_scored: "The anchor transaction is not scored.",
  outcome_not_actionable: "The outcome is not evidence_found, so no case action is allowed.",
  decision_not_review: "Opening a case requires a review decision.",
  evidence_refs_missing: "The proposal cited no evidence.",
  evidence_ref_unverified: "The proposal cited a record this investigation did not return.",
  case_already_active: "This transaction already has an active case.",
  no_open_case: "There is no open case to enrich.",
  duplicate_enrichment: "This evidence is already attached to the case.",
};
