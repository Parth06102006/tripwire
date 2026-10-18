import { act, render, screen } from "@testing-library/react";
import { motionValue } from "motion/react";
import type { ReactElement } from "react";
import { describe, expect, it } from "vitest";

import { STAGE_END, STAGE_START, TeaserProgressContext } from "@/components/ui/teaser-progress";

import { DecideStage, ScoreStage, TraceStage, VerifyStage } from "./how-it-works-stages";

/** The live status chip of a stage, the one element that announces the state. */
function status() {
  const chip = document.querySelector("[aria-live='polite']");
  if (!chip) throw new Error("the stage has a live status chip");
  return chip;
}

/** Teaser progress for a point in the stage's own time, 0 to 1. */
const progressAt = (time: number) => STAGE_START + time * (STAGE_END - STAGE_START);

/** Render a stage inside a teaser, and return a way to scroll it to a point in its time. */
function renderScrolled(stage: ReactElement, time = 0) {
  const progress = motionValue(progressAt(time));
  render(<TeaserProgressContext.Provider value={progress}>{stage}</TeaserProgressContext.Provider>);
  return (next: number) => act(() => progress.set(progressAt(next)));
}

describe("ScoreStage", () => {
  it("raises the score as the teaser scrolls and moves the verdict with it", () => {
    const scrollTo = renderScrolled(<ScoreStage />, 0);
    expect(status()).toHaveTextContent("Allow");
    expect(screen.getByText("0.12")).toBeInTheDocument();
    expect(screen.getByText("Below the review threshold, the transfer runs.")).toBeInTheDocument();

    scrollTo(0.5);
    expect(status()).toHaveTextContent("Review");
    expect(screen.getByText(/A case is queued for an analyst/)).toBeInTheDocument();

    scrollTo(1);
    expect(status()).toHaveTextContent("Block");
    expect(screen.getByText("0.92")).toBeInTheDocument();
    expect(screen.getByText(/A simulated block/)).toBeInTheDocument();
  });

  it("states the two policy thresholds and asks for no input", () => {
    renderScrolled(<ScoreStage />);
    expect(screen.getByText("review at 0.45")).toBeInTheDocument();
    expect(screen.getByText("block at 0.80")).toBeInTheDocument();
    expect(screen.queryByRole("slider")).not.toBeInTheDocument();
  });
});

describe("TraceStage", () => {
  it("walks one hop, then follows one branch to the funds path, as it scrolls", () => {
    const scrollTo = renderScrolled(<TraceStage />, 0);
    expect(status()).toHaveTextContent("at the anchor");
    expect(screen.getByText("hops 0/2")).toBeInTheDocument();
    expect(screen.queryByText("acct-8820")).not.toBeInTheDocument();

    scrollTo(0.4);
    expect(status()).toHaveTextContent("4 counterparties");
    expect(screen.getByText("acct-8820")).toBeInTheDocument();
    expect(screen.getByText("hops 1/2")).toBeInTheDocument();

    scrollTo(0.9);
    expect(status()).toHaveTextContent("funds path found");
    expect(screen.getByText("funds path")).toBeInTheDocument();
    expect(screen.getByText("hops 2/2")).toBeInTheDocument();
  });

  it("goes back when the visitor scrolls back up", () => {
    const scrollTo = renderScrolled(<TraceStage />, 1);
    expect(status()).toHaveTextContent("funds path found");
    scrollTo(0);
    expect(status()).toHaveTextContent("at the anchor");
  });

  it("has nothing to click", () => {
    renderScrolled(<TraceStage />, 1);
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });
});

describe("VerifyStage", () => {
  it("checks the claims one by one and keeps the rejected one visible", () => {
    const scrollTo = renderScrolled(<VerifyStage />, 0);
    expect(status()).toHaveTextContent("0 of 3 checked");

    scrollTo(0.3);
    expect(status()).toHaveTextContent("1 of 3 checked");
    expect(screen.getByText("supported")).toBeInTheDocument();
    expect(screen.getByText("tx-3f8a")).toBeInTheDocument();

    scrollTo(0.6);
    expect(screen.getByText("rejected")).toBeInTheDocument();
    expect(screen.getByText("not in records")).toBeInTheDocument();

    scrollTo(1);
    expect(status()).toHaveTextContent("2 supported · 1 rejected");
    expect(screen.getByText(/Only supported claims reach the case/)).toBeInTheDocument();
  });
});

describe("DecideStage", () => {
  it("appends evidence and then the analyst's decision, keeping the earlier entries", () => {
    const scrollTo = renderScrolled(<DecideStage />, 0);
    expect(status()).toHaveTextContent("Review required");
    expect(screen.getByText("Case opened")).toBeInTheDocument();
    expect(screen.getByText("1 entry")).toBeInTheDocument();

    scrollTo(0.5);
    expect(screen.getByText("Evidence attached")).toBeInTheDocument();
    expect(status()).toHaveTextContent("Review required");

    scrollTo(1);
    expect(status()).toHaveTextContent("Confirmed");
    expect(screen.getByText("Case opened")).toBeInTheDocument();
    expect(screen.getByText("Evidence attached")).toBeInTheDocument();
    expect(screen.getByText("Analyst confirmed")).toBeInTheDocument();
    expect(screen.getByText("3 entries")).toBeInTheDocument();
  });
});

describe("outside a teaser", () => {
  it("shows the finished state, for demos and pages without scrolling", () => {
    render(<VerifyStage />);
    expect(status()).toHaveTextContent("2 supported · 1 rejected");
  });
});
