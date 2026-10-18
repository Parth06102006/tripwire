/**
 * Hand-written fixtures shaped like API responses. Identifiers are invented
 * (tx-a, acct-1); no dataset records are copied into the repository.
 */
import type {
  InvestigationRequest,
  InvestigationResponse,
  ToolTraceEntry,
  TransactionEvidence,
} from "@/lib/api-schemas";
import type { EvidenceBatch } from "@/lib/graph/model";

export function tx(
  id: string,
  from: string,
  to: string,
  overrides: Partial<TransactionEvidence> = {},
): TransactionEvidence {
  return {
    transaction_id: id,
    timestamp: "2022-09-01 10:00",
    source_account_key: from,
    destination_account_key: to,
    amount_paid: 100,
    payment_currency: "US Dollar",
    amount_received: 100,
    receiving_currency: "US Dollar",
    payment_format: "ACH",
    ...overrides,
  };
}

export function trace(overrides: Partial<ToolTraceEntry> = {}): ToolTraceEntry {
  return {
    tool_run_id: "run-1",
    tool: "trace_funds",
    transport: "direct",
    origin: "policy",
    arguments: { transaction_id: "tx-a", max_hops: 2 },
    outcome: "evidence_found",
    status: "ok",
    duration_ms: 12.5,
    result_count: 2,
    path_count: 1,
    truncated: false,
    ...overrides,
  };
}

export function investigation(
  overrides: Partial<InvestigationResponse> = {},
): InvestigationResponse {
  const transactions = [tx("tx-a", "1::A", "2::B"), tx("tx-b", "2::B", "3::C")];
  return {
    investigation_id: "inv-1",
    transaction_id: "tx-a",
    risk_score: 0.91,
    decision: "review",
    policy_version: "v1",
    evidence: {
      transactions,
      accounts: [{ account_key: "1::A" }, { account_key: "2::B" }, { account_key: "3::C" }],
      paths: [
        {
          anchor_transaction_id: "tx-a",
          direction: "both",
          depth: 2,
          account_keys: ["1::A", "2::B", "3::C"],
          transaction_ids: ["tx-a", "tx-b"],
        },
      ],
      query_duration_ms: 20,
      tool_durations_ms: [],
    },
    report: {
      hypothesis: "2 related transfers across 3 accounts.",
      supporting_transaction_ids: ["tx-a", "tx-b"],
      counterevidence_ids: [],
      recommendation: "review",
      validation: "validated",
      source: "deterministic",
      cited_claims: [],
      cited_paths: [],
      llm: null,
      proposed_action: "none",
      action_reason: null,
      risk_level: null,
      reasoning: [],
    },
    created_at: "2026-10-17T10:00:00Z",
    outcome: "evidence_found",
    tool_trace: [trace()],
    action: null,
    ...overrides,
  };
}

export const request: InvestigationRequest = {
  transaction_id: "tx-a",
  max_hops: 2,
  time_window_seconds: 86_400,
  result_limit: 50,
  use_llm: false,
  act: false,
};

/** A response's evidence as one graph batch. */
export function batch(seq: number, response: InvestigationResponse): EvidenceBatch {
  return { ...response.evidence, seq, anchorTransactionId: response.transaction_id };
}
