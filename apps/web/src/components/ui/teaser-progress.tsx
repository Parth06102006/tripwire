"use client";

import { motionValue, useMotionValueEvent, useScroll, type MotionValue } from "motion/react";
import { createContext, useContext, useState, type ReactNode, type RefObject } from "react";

/**
 * Scroll progress of one teaser, for the panel that belongs to it.
 *
 * StickyTeaserScroll wraps each panel in <TeaserProgress>, so a panel can play
 * its animation as its teaser scrolls past instead of asking for clicks.
 * Progress runs 0 to 1 while the teaser crosses the viewport and is 0.5 when it
 * is centred. Read it with useTeaserProgress, or useStageTime for the part of
 * that range a stage plays in.
 */
export const TeaserProgressContext = createContext<MotionValue<number> | null>(null);

export function TeaserProgress({
  target,
  children,
}: {
  target: RefObject<HTMLElement | null>;
  children: ReactNode;
}) {
  const { scrollYProgress } = useScroll({ target, offset: ["start end", "end start"] });
  return (
    <TeaserProgressContext.Provider value={scrollYProgress}>
      {children}
    </TeaserProgressContext.Provider>
  );
}

/** Stand-in for panels rendered outside a teaser (a demo page, a test): fully played. */
const PLAYED = motionValue(1);

/** Rounded to hundredths, so a panel re-renders at most a hundred times over a scroll. */
const quantise = (value: number) => Math.round(value * 100) / 100;

/** The teaser's scroll progress, 0 to 1. Outside a teaser it is 1: the finished state. */
export function useTeaserProgress(): number {
  const source = useContext(TeaserProgressContext);
  const [value, setValue] = useState(() => quantise((source ?? PLAYED).get()));
  useMotionValueEvent(source ?? PLAYED, "change", (next) => setValue(quantise(next)));
  return value;
}

/**
 * Where a stage plays within its teaser's scroll: it starts as the teaser
 * reaches the middle of the screen and finishes a little past it, so the
 * finished state stays on screen while the teaser is still the active one.
 * Tuned for both the pinned desktop panel and the inline panel below 992px.
 */
export const STAGE_START = 0.28;
export const STAGE_END = 0.55;

/** The stage's own clock, 0 to 1, driven by scrolling. */
export function useStageTime(): number {
  const progress = useTeaserProgress();
  return Math.min(1, Math.max(0, (progress - STAGE_START) / (STAGE_END - STAGE_START)));
}
