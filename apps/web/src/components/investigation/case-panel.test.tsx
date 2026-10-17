import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { CaseItem } from "@/lib/api-schemas";
import { renderWithClient, stubApi } from "@/test/render";

import { CasePanel } from "./case-panel";

vi.mock("sonner", () => ({ toast: { success: vi.fn() } }));

afterEach(() => {
  vi.unstubAllGlobals();
});

function caseItem(overrides: Partial<CaseItem> = {}): CaseItem {
  return {
    case_id: "case-1",
    transaction_id: "tx-a",
    status: "suspected",
    risk_score: 0.9,
    opened_by: "traceaml-policy",
    created_at: "2026-10-17T10:00:00Z",
    updated_at: "2026-10-17T10:00:00Z",
    history: [
      {
        review_id: "h1",
        action: "open",
        reviewer_id: "traceaml-policy",
        pattern_type: null,
        notes: null,
        timestamp: "2026-10-17T10:00:00Z",
      },
    ],
    evidence: [],
    ...overrides,
  };
}

const panel = (onRunGate = vi.fn()) => (
  <CasePanel
    transactionId="tx-a"
    latestAction={null}
    canRunGate
    gateRunning={false}
    onRunGate={onRunGate}
  />
);

describe("CasePanel", () => {
  it("offers the gated action and a manual open when no case exists", async () => {
    stubApi(() => ({ body: { items: [], total: 0, limit: 100, offset: 0 } }));
    const onRunGate = vi.fn();
    renderWithClient(panel(onRunGate));

    await userEvent.click(
      await screen.findByRole("button", { name: /Propose case through the gate/ }),
    );
    expect(onRunGate).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: /Open case manually/ })).toBeInTheDocument();
  });

  it("confirms a case and shows the persisted status the API returns", async () => {
    let current = caseItem();
    const calls = stubApi((url, init) => {
      if (url.pathname === "/api/cases" && (init?.method ?? "GET") === "GET")
        return { body: { items: [current], total: 1, limit: 100, offset: 0 } };
      if (url.pathname === "/api/cases/case-1/review") {
        current = caseItem({
          status: "confirmed",
          history: [
            ...current.history,
            {
              review_id: "h2",
              action: "confirm",
              reviewer_id: "analyst-7",
              pattern_type: "fan-out",
              notes: null,
              timestamp: "2026-10-17T11:00:00Z",
            },
          ],
        });
        return { body: current };
      }
      return undefined;
    });

    renderWithClient(panel());
    await userEvent.click(await screen.findByRole("button", { name: "Confirm" }));
    await userEvent.type(screen.getByLabelText("Reviewer ID"), "analyst-7");
    await userEvent.type(screen.getByLabelText(/Pattern you identified/), "fan-out");
    await userEvent.click(screen.getByRole("button", { name: "Confirm case" }));

    expect(await screen.findByText("Confirmed")).toBeInTheDocument();
    expect(screen.getByText(/decision is final/)).toBeInTheDocument();
    expect(calls.find((c) => c.method === "POST")?.body).toEqual({
      action: "confirm",
      reviewer_id: "analyst-7",
      pattern_type: "fan-out",
      notes: null,
    });
  });

  it("requires a reviewer ID before sending a decision", async () => {
    const calls = stubApi(() => ({
      body: { items: [caseItem()], total: 1, limit: 100, offset: 0 },
    }));
    renderWithClient(panel());
    await userEvent.click(await screen.findByRole("button", { name: "Dismiss" }));
    await userEvent.click(screen.getByRole("button", { name: "Dismiss case" }));
    expect(await screen.findByText("Enter your analyst ID")).toBeInTheDocument();
    expect(calls.some((c) => c.method === "POST")).toBe(false);
  });
});
