import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { DecideStage, ScoreStage, TraceStage, VerifyStage } from "./how-it-works-stages";

/** The live status chip of a stage, the one element that announces the state. */
function status() {
  const chip = document.querySelector("[aria-live='polite']");
  if (!chip) throw new Error("the stage has a live status chip");
  return chip;
}

describe("ScoreStage", () => {
  it("moves the verdict with the score and keeps policy in charge", () => {
    render(<ScoreStage />);
    const slider = screen.getByRole("slider", { name: "Risk score" });
    expect(status()).toHaveTextContent("Review");
    expect(screen.getByText(/A case is queued for an analyst/)).toBeInTheDocument();

    fireEvent.change(slider, { target: { value: "0.2" } });
    expect(status()).toHaveTextContent("Allow");
    expect(slider).toHaveAttribute("aria-valuetext", "0.20, Allow");
    expect(screen.getByText(/the transfer runs/i)).toBeInTheDocument();

    fireEvent.change(slider, { target: { value: "0.94" } });
    expect(status()).toHaveTextContent("Block");
    expect(screen.getByText(/A simulated block/)).toBeInTheDocument();
  });

  it("states the two policy thresholds", () => {
    render(<ScoreStage />);
    expect(screen.getByText("review at 0.45")).toBeInTheDocument();
    expect(screen.getByText("block at 0.80")).toBeInTheDocument();
  });
});

describe("TraceStage", () => {
  it("walks one hop, follows one branch and reports the funds path", async () => {
    render(<TraceStage />);
    expect(status()).toHaveTextContent("at the anchor");
    expect(screen.queryByRole("button", { name: /Follow acct-8820/ })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Walk one hop" }));
    expect(status()).toHaveTextContent("4 counterparties");
    expect(screen.getByText("hops 1/2")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Follow acct-8820 one hop" }));
    expect(status()).toHaveTextContent("funds path found");
    expect(screen.getByText("funds path")).toBeInTheDocument();
    expect(screen.getByText("hops 2/2")).toBeInTheDocument();
  });

  it("says when a branch returns no path and can walk again", async () => {
    render(<TraceStage />);
    await userEvent.click(screen.getByRole("button", { name: "Walk one hop" }));
    await userEvent.click(screen.getByRole("button", { name: "Follow acct-1013 one hop" }));
    expect(status()).toHaveTextContent("no path here");
    expect(screen.queryByText("funds path")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Reset" }));
    expect(status()).toHaveTextContent("at the anchor");
    expect(screen.queryByRole("button", { name: /Follow/ })).not.toBeInTheDocument();
  });
});

describe("VerifyStage", () => {
  it("checks claims one by one and keeps the rejected one visible", async () => {
    render(<VerifyStage />);
    expect(status()).toHaveTextContent("0 of 3 checked");

    await userEvent.click(screen.getByRole("button", { name: /9,400 USD/ }));
    expect(status()).toHaveTextContent("1 of 3 checked");
    expect(screen.getByText("supported")).toBeInTheDocument();
    expect(screen.getByText("tx-3f8a")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /sanctions list/ }));
    expect(screen.getByText("rejected")).toBeInTheDocument();
    expect(screen.getByText("not in records")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /three-hop path/ }));
    expect(status()).toHaveTextContent("2 supported · 1 rejected");
  });
});

describe("DecideStage", () => {
  it("appends the analyst decision and never erases an earlier one", async () => {
    render(<DecideStage />);
    expect(status()).toHaveTextContent("Review required");
    expect(screen.getByText("Case opened")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Confirm case" }));
    expect(status()).toHaveTextContent("Confirmed");
    expect(screen.getByText("Analyst confirmed")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(status()).toHaveTextContent("Dismissed");
    expect(screen.getByText("Analyst confirmed")).toBeInTheDocument();
    expect(screen.getByText("Analyst dismissed")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Reset" }));
    expect(status()).toHaveTextContent("Review required");
    expect(screen.queryByText("Analyst dismissed")).not.toBeInTheDocument();
  });
});
