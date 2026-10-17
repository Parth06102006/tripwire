import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { InvestigationResponse } from "@/lib/api-schemas";
import { investigation } from "@/test/fixtures";

import { VerdictCard } from "./verdict-card";

function rated(level: number, outcome: "block" | "allow"): InvestigationResponse {
  const base = investigation();
  if (!base.report) throw new Error("fixture has a report");
  return {
    ...base,
    report: {
      ...base.report,
      source: "llm",
      risk_level: level,
      reasoning: [{ statement: "tx-a moves onward through tx-b.", evidence_ids: ["tx-a", "tx-b"] }],
      llm: {
        provider: "gemini",
        model: "flash",
        status: "completed",
        fallback_reason: null,
        rounds: 2,
        tool_calls: 2,
        input_tokens: 1200,
        output_tokens: 300,
        duration_ms: 2400,
        estimated_cost_usd: null,
      },
    },
    escalation: {
      route: "flagged_for_review",
      review_threshold: 0.5,
      block_threshold: 0.99,
      agent_status: "rated",
      risk_level: level,
      outcome,
      decided_by: "agent",
      reason: `The agent rated the transaction ${level} of 5.`,
      simulated: true,
    },
  };
}

describe("VerdictCard", () => {
  it("shows the simulated decision, the risk level and the path through the chain", () => {
    render(<VerdictCard response={rated(4, "block")} onEvidence={vi.fn()} />);
    expect(screen.getByText("Block")).toBeInTheDocument();
    expect(screen.getByText("4 of 5")).toBeInTheDocument();
    expect(screen.getByText("Decided by the agent's verified risk level")).toBeInTheDocument();
    expect(screen.getByText("Risk 4 to 5: block")).toHaveAttribute("aria-current", "step");
    expect(screen.getByText("Risk 1 to 3: allow")).not.toHaveAttribute("aria-current");
  });

  it("lets the analyst jump from a reasoning point to its evidence", async () => {
    const onEvidence = vi.fn();
    render(<VerdictCard response={rated(2, "allow")} onEvidence={onEvidence} />);
    await userEvent.click(screen.getByRole("button", { name: "tx-b" }));
    expect(onEvidence).toHaveBeenCalledWith("tx-b");
  });

  it("says when no rating exists and the transaction waits for an operator", () => {
    const response = investigation({
      escalation: {
        route: "flagged_for_review",
        review_threshold: 0.5,
        block_threshold: 0.99,
        agent_status: "unavailable",
        risk_level: null,
        outcome: "pending_review",
        decided_by: "model",
        reason: "No LLM provider is configured. The transaction stays flagged for operator review.",
        simulated: true,
      },
    });
    render(<VerdictCard response={response} onEvidence={vi.fn()} />);
    expect(screen.getByText("Operator review")).toBeInTheDocument();
    expect(screen.getByText("Not rated")).toBeInTheDocument();
    expect(screen.getByText("No rating: operator review")).toHaveAttribute("aria-current", "step");
  });
});
