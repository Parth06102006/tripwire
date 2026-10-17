/**
 * Runtime schemas for the TraceAML API, mirroring the Pydantic models in
 * services/api/src/api/schemas.py and services/api/src/api/cases/schemas.py.
 * Those models are the authority; update these when they change.
 *
 * Unknown keys are stripped rather than rejected, so an additive backend
 * change does not break the UI, and nothing outside the contract reaches a
 * component.
 */
import { z } from "zod";

export const healthSchema = z.object({
  status: z.literal("ok"),
  falkordb: z.enum(["available", "unavailable", "not_configured"]),
  version: z.string(),
  llm: z.enum(["not_configured", "configured"]),
});
export type Health = z.infer<typeof healthSchema>;

export const decisionSchema = z.enum(["allow", "review"]);
export type Decision = z.infer<typeof decisionSchema>;

/** Where the traditional model and rules send a transaction (ADR-023). */
export const modelRouteSchema = z.enum(["blocked_by_rule", "flagged_for_review", "standard_path"]);
export type ModelRoute = z.infer<typeof modelRouteSchema>;

export const alertItemSchema = z.object({
  transaction_id: z.string(),
  timestamp: z.string(),
  score: z.number(),
  decision: decisionSchema,
  route: modelRouteSchema.default("standard_path"),
  /** Whether the transaction exists in the configured graph and can be investigated. */
  graph_status: z.enum(["available", "missing", "unknown"]).default("unknown"),
});
export type AlertItem = z.infer<typeof alertItemSchema>;

export const routeCountsSchema = z.object({
  blocked_by_rule: z.number().int(),
  flagged_for_review: z.number().int(),
  standard_path: z.number().int(),
});
export type RouteCounts = z.infer<typeof routeCountsSchema>;

export const alertsResponseSchema = z.object({
  items: z.array(alertItemSchema),
  /** Alerts matching the filters; every scored transaction when none are set. */
  total: z.number().int(),
  limit: z.number().int(),
  offset: z.number().int(),
  /** All scored transactions, whatever the filters. Absent on an API without filters. */
  scored_total: z.number().int().nullish(),
  /** Matches per route under every filter except the route selection. */
  route_counts: routeCountsSchema.nullish(),
});
export type AlertsResponse = z.infer<typeof alertsResponseSchema>;

// Benchmarks ---------------------------------------------------------------

const splitMetricsSchema = z.object({
  rows: z.number(),
  prevalence: z.number(),
  alerts: z.number(),
  precision: z.number(),
  recall: z.number(),
});

export const modelBenchmarkSchema = z.object({
  average_precision: z.record(z.string(), z.number()),
  val_threshold_max_f1: z.number(),
  test_at_val_threshold: z.object({
    precision: z.number(),
    recall: z.number(),
    f1: z.number(),
    true_positives: z.number(),
    false_positives: z.number(),
  }),
  test_at_alert_budget: z.object({
    budget: z.number(),
    alerts: z.number(),
    true_positives: z.number(),
    precision: z.number(),
    recall: z.number(),
  }),
  splits: z.record(z.string(), splitMetricsSchema),
});
export type ModelBenchmark = z.infer<typeof modelBenchmarkSchema>;

export const latencyStatsSchema = z.object({
  samples: z.number(),
  p50_ms: z.number(),
  p95_ms: z.number(),
  mean_ms: z.number(),
  p99_ms: z.number().nullish(),
});
export type LatencyStats = z.infer<typeof latencyStatsSchema>;

const serialLatencySchema = latencyStatsSchema.extend({
  serial_requests_per_second: z.number(),
});

const investigationPerformanceSchema = serialLatencySchema.extend({
  graph_query_sum: latencyStatsSchema,
  evidence_transactions: z.number(),
  evidence_accounts: z.number(),
  evidence_paths: z.number(),
  all_reports_validated: z.boolean(),
});
export type InvestigationPerformance = z.infer<typeof investigationPerformanceSchema>;

const cohortInferenceSchema = z.object({
  rows: z.number(),
  repeats: z.number(),
  median_seconds: z.number(),
  transactions_per_second: z.number(),
  threads: z.number(),
  max_abs_error_vs_saved_scores: z.number(),
});

const flowQuerySchema = latencyStatsSchema.extend({
  matches_min: z.number(),
  matches_max: z.number(),
});

const capacityLevelSchema = z.object({
  concurrency: z.number(),
  requests: z.number(),
  throughput_rps: z.number(),
  p50_ms: z.number(),
  p95_ms: z.number(),
  p99_ms: z.number(),
  error_rate: z.number(),
});

export const capacitySweepSchema = z.object({
  endpoint: z.string(),
  workers: z.number(),
  duration_seconds: z.number(),
  levels: z.array(capacityLevelSchema),
  knee_concurrency: z.number().nullable(),
  peak_throughput_rps: z.number(),
  first_error_concurrency: z.number().nullable(),
});
export type CapacitySweep = z.infer<typeof capacitySweepSchema>;

export const costStatusSchema = z.object({
  external_llm_calls: z.number(),
  external_llm_cost: z.string(),
  local_compute_cost: z.string(),
  cost_per_1000_decisions: z.string(),
  dollar_weighted_recall: z.string(),
  price_basis: z.string().nullish(),
  scoring_usd_per_1000_transactions: z.number().nullish(),
  scoring_cpu_seconds_per_1000_transactions: z.number().nullish(),
  investigation_usd: z.number().nullish(),
  investigation_cpu_seconds: z.number().nullish(),
  investigation_provisioned_usd: z.number().nullish(),
});
export type CostStatus = z.infer<typeof costStatusSchema>;

export const performanceSummarySchema = z.object({
  measured_on: z.string(),
  dataset_label: z.string(),
  hardware: z.string(),
  graph_scope: z.string(),
  execution_mode: z.string(),
  model_inference: z.object({
    single_prepared_row: latencyStatsSchema,
    full_test_cohort: cohortInferenceSchema,
    full_test_cohort_all_threads: cohortInferenceSchema.nullish(),
    batches: z.record(z.string(), latencyStatsSchema).nullish(),
  }),
  // The investigation entry is the only one carrying graph_query_sum, so the
  // richer schema is tried first.
  api: z.record(z.string(), z.union([investigationPerformanceSchema, serialLatencySchema])),
  graph_queries: z.object({
    trace_funds: latencyStatsSchema,
    inspect_counterparties: latencyStatsSchema,
    fan_out: flowQuerySchema,
    fan_in: flowQuerySchema,
    pass_through: flowQuerySchema,
  }),
  cost: costStatusSchema,
  run_id: z.string().nullish(),
  git_commit: z.string().nullish(),
  concurrency: z
    .object({
      falkordb_thread_count: z.number().nullish(),
      falkordb_max_queued_queries: z.number().nullish(),
      sweeps: z.record(z.string(), capacitySweepSchema),
    })
    .nullish(),
});
export type PerformanceSummary = z.infer<typeof performanceSummarySchema>;

export const benchmarksResponseSchema = z.object({
  models: z.record(z.string(), modelBenchmarkSchema),
  performance: performanceSummarySchema.nullish(),
});
export type BenchmarksResponse = z.infer<typeof benchmarksResponseSchema>;

// Investigations -----------------------------------------------------------

export const investigationRequestSchema = z.object({
  transaction_id: z.string().min(1),
  max_hops: z.number().int().min(1).max(3),
  time_window_seconds: z.number().int().min(1).max(2_592_000),
  result_limit: z.number().int().min(1).max(100),
  use_llm: z.boolean(),
  act: z.boolean(),
});
export type InvestigationRequest = z.infer<typeof investigationRequestSchema>;

export const transactionEvidenceSchema = z.object({
  transaction_id: z.string(),
  timestamp: z.string(),
  source_account_key: z.string(),
  destination_account_key: z.string(),
  amount_paid: z.number().nullish(),
  payment_currency: z.string().nullish(),
  amount_received: z.number().nullish(),
  receiving_currency: z.string().nullish(),
  payment_format: z.string().nullish(),
});
export type TransactionEvidence = z.infer<typeof transactionEvidenceSchema>;

export const graphPathSchema = z.object({
  anchor_transaction_id: z.string(),
  direction: z.string(),
  depth: z.number().int(),
  account_keys: z.array(z.string()),
  transaction_ids: z.array(z.string()),
});
export type GraphPath = z.infer<typeof graphPathSchema>;

export const toolNameSchema = z.enum([
  "trace_funds",
  "inspect_counterparties",
  "detect_flow_patterns.fan_out",
  "detect_flow_patterns.fan_in",
  "detect_flow_patterns.pass_through",
]);

export const investigationEvidenceSchema = z.object({
  transactions: z.array(transactionEvidenceSchema),
  accounts: z.array(z.object({ account_key: z.string() })),
  paths: z.array(graphPathSchema),
  query_duration_ms: z.number(),
  tool_durations_ms: z
    .array(z.object({ tool: toolNameSchema, query_duration_ms: z.number() }))
    .default([]),
});
export type InvestigationEvidence = z.infer<typeof investigationEvidenceSchema>;

export const investigationOutcomeSchema = z.enum([
  "evidence_found",
  "no_matching_path",
  "unknown_anchor",
  "inconclusive",
]);
export type InvestigationOutcome = z.infer<typeof investigationOutcomeSchema>;

export const toolRunOutcomeSchema = z.enum([
  "evidence_found",
  "no_matching_path",
  "unknown_anchor",
  "inconclusive",
  "invalid_input",
]);
export type ToolRunOutcome = z.infer<typeof toolRunOutcomeSchema>;

export const toolTraceEntrySchema = z.object({
  tool_run_id: z.string(),
  tool: z.enum(["trace_funds", "inspect_counterparties", "detect_flow_patterns"]),
  transport: z.enum(["direct", "mcp"]),
  origin: z.enum(["policy", "model"]),
  arguments: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])),
  outcome: toolRunOutcomeSchema,
  status: z.enum(["ok", "error"]),
  duration_ms: z.number(),
  result_count: z.number().int(),
  path_count: z.number().int(),
  truncated: z.boolean(),
});
export type ToolTraceEntry = z.infer<typeof toolTraceEntrySchema>;

export const proposedActionSchema = z.enum(["none", "open_case", "enrich_case"]);

export const actionDenialCodeSchema = z.enum([
  "anchor_not_scored",
  "outcome_not_actionable",
  "decision_not_review",
  "evidence_refs_missing",
  "evidence_ref_unverified",
  "case_already_active",
  "no_open_case",
  "duplicate_enrichment",
]);
export type ActionDenialCode = z.infer<typeof actionDenialCodeSchema>;

export const caseActionResultSchema = z.object({
  proposed_action: proposedActionSchema,
  proposed_by: z.enum(["agent", "policy"]),
  reason: z.string(),
  status: z.enum(["executed", "denied", "no_action"]),
  denial_code: actionDenialCodeSchema.nullish(),
  case_id: z.string().nullish(),
  evidence_refs: z.array(z.string()).default([]),
  tool_run_ids: z.array(z.string()).default([]),
});
export type CaseActionResult = z.infer<typeof caseActionResultSchema>;

export const llmRunInfoSchema = z.object({
  provider: z.string(),
  model: z.string(),
  status: z.enum(["completed", "fallback", "unavailable"]),
  fallback_reason: z
    .enum(["not_configured", "provider_error", "timeout", "invalid_output", "verification_failed"])
    .nullish(),
  rounds: z.number().int().default(0),
  tool_calls: z.number().int().default(0),
  input_tokens: z.number().int().nullish(),
  output_tokens: z.number().int().nullish(),
  duration_ms: z.number().default(0),
  estimated_cost_usd: z.number().nullish(),
});
export type LlmRunInfo = z.infer<typeof llmRunInfoSchema>;

export const citedClaimSchema = z.object({
  transaction_id: z.string(),
  timestamp: z.string().nullish(),
  amount_paid: z.number().nullish(),
  payment_currency: z.string().nullish(),
  source_account_key: z.string().nullish(),
  destination_account_key: z.string().nullish(),
});
export type CitedClaim = z.infer<typeof citedClaimSchema>;

export const reasoningPointSchema = z.object({
  statement: z.string(),
  evidence_ids: z.array(z.string()),
});
export type ReasoningPoint = z.infer<typeof reasoningPointSchema>;

export const investigationReportSchema = z.object({
  hypothesis: z.string(),
  supporting_transaction_ids: z.array(z.string()),
  counterevidence_ids: z.array(z.string()),
  recommendation: z.literal("review"),
  validation: z.literal("validated"),
  source: z.enum(["deterministic", "llm"]).default("deterministic"),
  cited_claims: z.array(citedClaimSchema).default([]),
  cited_paths: z
    .array(z.object({ transaction_ids: z.array(z.string()), account_keys: z.array(z.string()) }))
    .default([]),
  llm: llmRunInfoSchema.nullish(),
  proposed_action: proposedActionSchema.default("none"),
  action_reason: z.string().nullish(),
  risk_level: z.number().int().min(1).max(5).nullish(),
  reasoning: z.array(reasoningPointSchema).default([]),
});
export type InvestigationReport = z.infer<typeof investigationReportSchema>;

export const escalationSchema = z.object({
  route: modelRouteSchema,
  review_threshold: z.number(),
  block_threshold: z.number().nullable(),
  agent_status: z.enum(["rated", "unavailable", "not_applicable"]),
  risk_level: z.number().int().min(1).max(5).nullish(),
  outcome: z.enum(["block", "allow", "pending_review"]),
  decided_by: z.enum(["rule", "agent", "model"]),
  reason: z.string(),
  simulated: z.literal(true),
});
export type Escalation = z.infer<typeof escalationSchema>;

export const investigationResponseSchema = z.object({
  investigation_id: z.string(),
  transaction_id: z.string(),
  risk_score: z.number(),
  decision: decisionSchema,
  policy_version: z.string(),
  evidence: investigationEvidenceSchema,
  report: investigationReportSchema.nullable(),
  created_at: z.string(),
  outcome: investigationOutcomeSchema,
  tool_trace: z.array(toolTraceEntrySchema).default([]),
  action: caseActionResultSchema.nullish(),
  escalation: escalationSchema.nullish(),
});
export type InvestigationResponse = z.infer<typeof investigationResponseSchema>;

// Streaming investigation events (POST /api/investigations/stream) --------

const scalar = z.union([z.string(), z.number(), z.boolean(), z.null()]);

export const executedStatementSchema = z.object({
  cypher: z.string(),
  parameters: z.record(z.string(), z.union([scalar, z.array(scalar)])),
  rows: z.number().int(),
  duration_ms: z.number(),
});
export type ExecutedStatement = z.infer<typeof executedStatementSchema>;

export const evidenceDeltaSchema = z.object({
  transactions: z.array(transactionEvidenceSchema),
  accounts: z.array(z.object({ account_key: z.string() })),
  paths: z.array(graphPathSchema),
});
export type EvidenceDelta = z.infer<typeof evidenceDeltaSchema>;

export const streamStartedSchema = z.object({
  transaction_id: z.string(),
  risk_score: z.number(),
  decision: decisionSchema,
  route: modelRouteSchema,
  review_threshold: z.number(),
  block_threshold: z.number().nullable(),
  policy_version: z.string(),
  max_hops: z.number().int(),
  time_window_seconds: z.number().int(),
  result_limit: z.number().int(),
  agent: z.enum(["llm", "deterministic"]),
  llm_provider: z.string().nullish(),
  llm_model: z.string().nullish(),
});
export type StreamStarted = z.infer<typeof streamStartedSchema>;

export const streamToolStartedSchema = z.object({
  call_id: z.string(),
  tool: toolTraceEntrySchema.shape.tool,
  origin: toolTraceEntrySchema.shape.origin,
  transport: toolTraceEntrySchema.shape.transport,
  arguments: toolTraceEntrySchema.shape.arguments,
  purpose: z.string(),
});
export type StreamToolStarted = z.infer<typeof streamToolStartedSchema>;

export const streamToolFinishedSchema = z.object({
  call_id: z.string(),
  entry: toolTraceEntrySchema,
  statements: z.array(executedStatementSchema).default([]),
  evidence: evidenceDeltaSchema.nullish(),
});
export type StreamToolFinished = z.infer<typeof streamToolFinishedSchema>;

export const streamAgentStepSchema = z.object({
  phase: z.enum(["round_started", "round_finished", "report_started", "report_finished"]),
  round: z.number().int(),
  tool_calls: z.number().int().default(0),
});
export type StreamAgentStep = z.infer<typeof streamAgentStepSchema>;

export const streamErrorSchema = z.object({ status: z.number().int(), detail: z.string() });
export type StreamError = z.infer<typeof streamErrorSchema>;

// Cases --------------------------------------------------------------------

export const caseStatusSchema = z.enum(["suspected", "under_review", "confirmed", "dismissed"]);
export type CaseStatus = z.infer<typeof caseStatusSchema>;

export const caseHistoryEntrySchema = z.object({
  review_id: z.string(),
  action: z.enum(["open", "enrich", "confirm", "dismiss"]),
  reviewer_id: z.string(),
  pattern_type: z.string().nullable(),
  notes: z.string().nullable(),
  timestamp: z.string(),
});
export type CaseHistoryEntry = z.infer<typeof caseHistoryEntrySchema>;

export const caseEvidenceEntrySchema = z.object({
  evidence_id: z.string(),
  review_id: z.string(),
  action: z.enum(["open_case", "enrich_case"]),
  proposed_by: z.enum(["agent", "policy"]),
  investigation_id: z.string(),
  reason: z.string(),
  evidence_refs: z.array(z.string()),
  tool_run_ids: z.array(z.string()),
  tool_trace: z.array(toolTraceEntrySchema),
  risk_score: z.number(),
  decision: decisionSchema,
  policy_version: z.string(),
  timestamp: z.string(),
});
export type CaseEvidenceEntry = z.infer<typeof caseEvidenceEntrySchema>;

export const caseItemSchema = z.object({
  case_id: z.string(),
  transaction_id: z.string(),
  status: caseStatusSchema,
  risk_score: z.number(),
  opened_by: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  history: z.array(caseHistoryEntrySchema),
  evidence: z.array(caseEvidenceEntrySchema).default([]),
});
export type CaseItem = z.infer<typeof caseItemSchema>;

export const caseListResponseSchema = z.object({
  items: z.array(caseItemSchema),
  total: z.number().int(),
  limit: z.number().int(),
  offset: z.number().int(),
});
export type CaseListResponse = z.infer<typeof caseListResponseSchema>;

export const caseCreateRequestSchema = z.object({
  transaction_id: z.string().min(1).max(128),
  opened_by: z.string().trim().min(1, "Enter your analyst ID").max(64),
  notes: z.string().max(4000).nullable(),
});
export type CaseCreateRequest = z.infer<typeof caseCreateRequestSchema>;

export const caseReviewRequestSchema = z.object({
  action: z.enum(["confirm", "dismiss"]),
  reviewer_id: z.string().trim().min(1, "Enter your reviewer ID").max(64),
  pattern_type: z.string().max(64).nullable(),
  notes: z.string().max(4000).nullable(),
});
export type CaseReviewRequest = z.infer<typeof caseReviewRequestSchema>;
