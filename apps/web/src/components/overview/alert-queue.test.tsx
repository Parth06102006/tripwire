import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { renderWithClient, stubApi } from "@/test/render";

import { EMPTY_DRAFT } from "@/lib/alert-filters";
import { AlertQueue } from "./alert-queue";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

afterEach(() => {
  vi.unstubAllGlobals();
  push.mockReset();
});

const items = [
  {
    transaction_id: "tx-high",
    timestamp: "2022-09-01 10:00",
    score: 0.97,
    decision: "review",
    route: "flagged_for_review",
  },
  {
    transaction_id: "tx-low",
    timestamp: "2022-09-02 11:00",
    score: 0.12,
    decision: "allow",
    route: "standard_path",
    graph_status: "missing",
  },
];

describe("AlertQueue", () => {
  it("lists scored alerts with links to their investigations", async () => {
    stubApi((url) =>
      url.pathname === "/api/alerts"
        ? { body: { items, total: 2, limit: 50, offset: 0 } }
        : undefined,
    );
    renderWithClient(<AlertQueue />);

    const link = await screen.findByRole("link", { name: "tx-high" });
    expect(link).toHaveAttribute("href", "/investigation/tx-high");
    expect(
      screen.getByText("2 of 2 scored transactions match, highest score first"),
    ).toBeInTheDocument();
    const row = link.closest("tr");
    expect(row && within(row).getByText("Flagged for review")).toBeInTheDocument();
  });

  it("defaults to flagged_for_review route", async () => {
    const calls = stubApi((url) =>
      url.pathname === "/api/alerts"
        ? { body: { items, total: 2, limit: 50, offset: 0 } }
        : undefined,
    );
    renderWithClient(<AlertQueue />);
    await screen.findByText("tx-high");
    expect(calls[0]?.path).toContain("route=flagged_for_review");
    const chip = screen.getByRole("button", { name: /Flagged for review/ });
    expect(chip).toHaveAttribute("aria-pressed", "true");
  });

  it("keeps an alert missing from the graph in the queue and marks it", async () => {
    stubApi(() => ({ body: { items, total: 2, limit: 50, offset: 0 } }));
    renderWithClient(<AlertQueue />);
    const missing = (await screen.findByRole("link", { name: "tx-low" })).closest("tr");
    expect(missing && within(missing).getByText("Not in graph")).toBeInTheDocument();
    const present = screen.getByRole("link", { name: "tx-high" }).closest("tr");
    expect(present && within(present).queryByText("Not in graph")).toBeNull();
  });

  it("opens an investigation when a row is clicked", async () => {
    stubApi(() => ({ body: { items, total: 2, limit: 50, offset: 0 } }));
    renderWithClient(<AlertQueue />);
    await userEvent.click(await screen.findByText("2022-09-02 11:00"));
    expect(push).toHaveBeenCalledWith("/investigation/tx-low");
  });

  it("asks the API for the transactions matching the filters", async () => {
    const calls = stubApi((url) =>
      url.pathname === "/api/alerts"
        ? {
            body: {
              items,
              total: url.searchParams.size > 2 ? 1 : 2,
              limit: 50,
              offset: 0,
              scored_total: 761639,
              route_counts: { blocked_by_rule: 4, flagged_for_review: 1, standard_path: 9 },
            },
          }
        : undefined,
    );
    renderWithClient(<AlertQueue initialDraft={EMPTY_DRAFT} />);
    await screen.findByText("tx-high");

    const chip = screen.getByRole("button", { name: /Flagged for review/ });
    expect(within(chip).getByText("1")).toBeInTheDocument();
    await userEvent.click(chip);
    expect(chip).toHaveAttribute("aria-pressed", "true");
    await vi.waitFor(() => expect(calls.at(-1)?.path).toContain("route=flagged_for_review"));

    await userEvent.type(screen.getByLabelText("Minimum score"), "0.9");
    await userEvent.type(screen.getByLabelText("Transaction ID contains"), "high");
    await vi.waitFor(() => {
      const last = calls.at(-1)?.path ?? "";
      expect(last).toContain("min_score=0.9");
      expect(last).toContain("q=high");
      expect(last).toContain("offset=0");
    });
    expect(
      await screen.findByText("1 of 761,639 scored transactions match, highest score first"),
    ).toBeInTheDocument();
  });

  it("does not send a score range it can reject, and says so", async () => {
    const calls = stubApi(() => ({ body: { items, total: 2, limit: 50, offset: 0 } }));
    renderWithClient(<AlertQueue />);
    await screen.findByText("tx-high");

    await userEvent.type(screen.getByLabelText("Minimum score"), "0.9");
    await userEvent.type(screen.getByLabelText("Maximum score"), "0.2");
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The minimum score is above the maximum.",
    );
    // The inverted range is never requested: the queue falls back to no score filter.
    expect(calls.every((call) => !call.path.includes("max_score"))).toBe(true);
    await vi.waitFor(() => expect(calls.at(-1)?.path).not.toContain("min_score"));
  });

  it("clears every filter at once", async () => {
    const calls = stubApi(() => ({ body: { items, total: 2, limit: 50, offset: 0 } }));
    renderWithClient(<AlertQueue />);
    await screen.findByText("tx-high");
    await userEvent.click(screen.getByRole("button", { name: /Blocked by rule/ }));
    await userEvent.click(await screen.findByRole("button", { name: "Clear filter" }));
    expect(screen.getByRole("button", { name: /Blocked by rule/ })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    await vi.waitFor(() => expect(calls.at(-1)?.path).not.toContain("route="));
  });

  it("explains an unreachable API instead of showing an empty queue", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Promise.reject(new TypeError("fetch failed"))),
    );
    renderWithClient(<AlertQueue />);
    expect(await screen.findByText("The alert queue could not be loaded")).toBeInTheDocument();
    expect(screen.getByText(/could not be reached/)).toBeInTheDocument();
  });
});
