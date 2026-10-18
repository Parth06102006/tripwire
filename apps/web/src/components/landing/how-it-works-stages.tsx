"use client";

import {
  Ban,
  Check,
  CircleCheck,
  CircleDashed,
  CircleSlash,
  Flag,
  ShieldAlert,
  X,
} from "lucide-react";
import { useState } from "react";

import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

import { StageChip, StageFrame } from "./stage-frame";

/**
 * The four interactive panels for the "How it works" section. Each stage keeps
 * one idea and one control, so a visitor can see a step of the pipeline happen
 * instead of reading about it:
 *
 *   ScoreStage   one draggable score, three policy bands
 *   TraceStage   a bounded graph walk that follows one branch
 *   VerifyStage  claims checked one by one against returned records
 *   DecideStage  a decision appended to an append-only case history
 *
 * All data is illustrative and lives in this file.
 */

// ---- Step 01: score ---------------------------------------------------------

/** Where the policy thresholds sit on the 0 to 1 score, in this illustration. */
const REVIEW_AT = 0.45;
const BLOCK_AT = 0.8;

const SCORE_VERDICT = {
  allow: {
    label: "Allow",
    tone: "neutral",
    icon: CircleCheck,
    outcome: "the transfer runs",
    hint: "Below the review threshold, the transfer runs.",
  },
  review: {
    label: "Review",
    tone: "review",
    icon: Flag,
    outcome: "a case is queued",
    hint: "A case is queued for an analyst, with the evidence attached.",
  },
  block: {
    label: "Block",
    tone: "critical",
    icon: Ban,
    outcome: "simulated only",
    hint: "A simulated block: policy decides, the model only scores.",
  },
} as const satisfies Record<
  string,
  { label: string; tone: BadgeTone; icon: typeof Check; outcome: string; hint: string }
>;

type ScoreVerdict = keyof typeof SCORE_VERDICT;

const SCORE_ORDER: readonly ScoreVerdict[] = ["allow", "review", "block"];

const BAND_TONE: Record<ScoreVerdict, string> = {
  allow: "text-ink",
  review: "text-warning",
  block: "text-critical",
};

function verdictOf(score: number): ScoreVerdict {
  if (score >= BLOCK_AT) return "block";
  if (score >= REVIEW_AT) return "review";
  return "allow";
}

export function ScoreStage() {
  const [score, setScore] = useState(0.68);
  const key = verdictOf(score);
  const verdict = SCORE_VERDICT[key];
  const VerdictIcon = verdict.icon;

  return (
    <StageFrame
      label="Score"
      hint={verdict.hint}
      status={
        <StageChip tone={verdict.tone} live>
          <VerdictIcon aria-hidden />
          {verdict.label}
        </StageChip>
      }
    >
      {/* Readout and bands centered above the control, so the panel reads as one
          display with the control pinned at its foot. */}
      <div className="flex min-h-0 flex-1 flex-col justify-center">
        <p className="font-mono text-[11px] tracking-[0.18em] text-dim uppercase">Risk score</p>
        <p className="mt-2 text-[clamp(2.4rem,8vw,3.4rem)] leading-none font-semibold tracking-[-0.03em] text-ink tabular-nums">
          {score.toFixed(2)}
        </p>
        <p className="mt-3 text-[12px] leading-5 text-dim">
          Scored at its own timestamp, nothing later.
        </p>

        {/* The three policy bands, with the band the score currently sits in. */}
        <ul className="mt-6 space-y-1.5">
          {SCORE_ORDER.map((band) => {
            const spec = SCORE_VERDICT[band];
            const active = band === key;
            return (
              <li
                key={band}
                className={cn(
                  "flex items-center gap-3 rounded-md border px-2.5 py-1.5",
                  active ? "border-line-strong bg-[#e6e7e5]/[0.05]" : "border-transparent",
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "size-1.5 shrink-0 rounded-full",
                    active
                      ? band === "allow"
                        ? "bg-ink"
                        : band === "review"
                          ? "bg-warning"
                          : "bg-critical"
                      : "bg-[#e6e7e5]/20",
                  )}
                />
                <span
                  className={cn(
                    "font-mono text-[11px] tracking-[0.14em] uppercase",
                    active ? BAND_TONE[band] : "text-dim",
                  )}
                >
                  {spec.label}
                </span>
                <span className={cn("ml-auto text-[11px]", active ? "text-dim" : "text-dim/70")}>
                  {spec.outcome}
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      {/* The one control, kept at the bottom of the stage. */}
      <div className="mt-6 border-t border-line pt-4 sm:pt-5">
        <p className="font-mono text-[11px] text-dim">drag to score</p>
        <div className="relative mt-2 h-11">
          {/* Track: base, the review and block bands, then the value fill. */}
          <div className="absolute inset-x-0 top-1/2 h-2.5 -translate-y-1/2 overflow-hidden rounded-full bg-[#e6e7e5]/[0.07]">
            <span
              aria-hidden="true"
              className="absolute inset-y-0 bg-warning/20"
              style={{
                left: `${REVIEW_AT * 100}%`,
                width: `${(BLOCK_AT - REVIEW_AT) * 100}%`,
              }}
            />
            <span
              aria-hidden="true"
              className="absolute inset-y-0 right-0 bg-critical/20"
              style={{ left: `${BLOCK_AT * 100}%` }}
            />
            <span
              aria-hidden="true"
              className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-accent/70 to-accent"
              style={{ width: `calc(${score} * (100% - 18px) + 9px)` }}
            />
          </div>

          {/* Threshold ticks. */}
          <span
            aria-hidden="true"
            className="absolute top-1/2 h-4 w-px -translate-x-1/2 -translate-y-1/2 bg-warning"
            style={{ left: `${REVIEW_AT * 100}%` }}
          />
          <span
            aria-hidden="true"
            className="absolute top-1/2 h-4 w-px -translate-x-1/2 -translate-y-1/2 bg-critical"
            style={{ left: `${BLOCK_AT * 100}%` }}
          />

          {/* Handle. */}
          <span
            aria-hidden="true"
            className="absolute top-1/2 size-[18px] -translate-y-1/2 rounded-full border-2 border-canvas bg-accent shadow-[0_0_0_3px_rgba(242,140,56,0.22)] transition-[left] duration-75"
            style={{ left: `calc(${score} * (100% - 18px))` }}
          />

          {/* Transparent range input over the bar: pointer drag, arrow keys and Home/End. */}
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={score}
            onChange={(event) => setScore(Number(event.target.value))}
            aria-label="Risk score"
            aria-valuetext={`${score.toFixed(2)}, ${verdict.label}`}
            className="peer absolute inset-x-0 top-1/2 z-10 h-11 w-full -translate-y-1/2 cursor-ew-resize appearance-none bg-transparent opacity-0"
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-1/2 z-20 h-11 -translate-y-1/2 rounded-lg peer-focus-visible:ring-2 peer-focus-visible:ring-accent/60"
          />
        </div>

        <div className="relative mt-1 h-4 font-mono text-[11px]">
          <span className="absolute left-0 text-dim">allow</span>
          <span
            className="absolute -translate-x-1/2 whitespace-nowrap text-warning"
            style={{ left: `${REVIEW_AT * 100}%` }}
          >
            review at {REVIEW_AT.toFixed(2)}
          </span>
          <span
            className="absolute -translate-x-1/2 whitespace-nowrap text-critical"
            style={{ left: `${BLOCK_AT * 100}%` }}
          >
            block at {BLOCK_AT.toFixed(2)}
          </span>
        </div>
      </div>
    </StageFrame>
  );
}

// ---- Step 02: trace ---------------------------------------------------------

type TraceNode = {
  id: string;
  /** Account id shown under the node, for the first hop. */
  label: string | null;
  /** Position in percent of the graph box. */
  x: number;
  y: number;
  depth: 1 | 2;
  /** Parent node id, `"anchor"` for the first hop. */
  parent: string;
};

const ANCHOR = { x: 50, y: 50 };

/** Distance from the anchor of the first and second hop, in viewBox units. */
const HOP_RADIUS = 34;
const OUTER_RADIUS = 48;

/**
 * One walk of the trace: the anchor, four counterparties sitting on the hop-1
 * ring, and two accounts each on the hop-2 ring. The ring a node sits on is how
 * many hops it is from the anchor, so the bound is visible, not just stated.
 */
const TRACE: readonly TraceNode[] = [
  { id: "a1", label: "acct-4471", x: 22.5, y: 30, depth: 1, parent: "anchor" },
  { id: "a2", label: "acct-8820", x: 77.5, y: 30, depth: 1, parent: "anchor" },
  { id: "a3", label: "acct-1013", x: 77.5, y: 70, depth: 1, parent: "anchor" },
  { id: "a4", label: "acct-2096", x: 22.5, y: 70, depth: 1, parent: "anchor" },
  { id: "a1c1", label: null, x: 6.2, y: 30.5, depth: 2, parent: "a1" },
  { id: "a1c2", label: null, x: 20.4, y: 12.2, depth: 2, parent: "a1" },
  { id: "a2c1", label: null, x: 93.8, y: 30.5, depth: 2, parent: "a2" },
  { id: "a2c2", label: null, x: 82.1, y: 14.3, depth: 2, parent: "a2" },
  { id: "a3c1", label: null, x: 93.8, y: 69.5, depth: 2, parent: "a3" },
  { id: "a3c2", label: null, x: 82.1, y: 85.7, depth: 2, parent: "a3" },
  { id: "a4c1", label: null, x: 6.2, y: 69.5, depth: 2, parent: "a4" },
  { id: "a4c2", label: null, x: 20.4, y: 85.7, depth: 2, parent: "a4" },
];

/** The one branch of the walk that ends on a funds path. */
const FUNDS_BRANCH = "a2";
const FUNDS_END = "a2c1";
const HOP_BUDGET = 2;

/** Ring labels, placed just inside each ring at the top. */
const RINGS = [
  { radius: HOP_RADIUS, label: "1 hop", top: "23%" },
  { radius: OUTER_RADIUS, label: "2 hops", top: "8%" },
] as const;

const TRACE_REVEAL = "animate-[hero-rise_340ms_cubic-bezier(0.22,1,0.36,1)_both]";

function positionOf(id: string): { x: number; y: number } {
  if (id === "anchor") return ANCHOR;
  return TRACE.find((node) => node.id === id) ?? ANCHOR;
}

export function TraceStage() {
  // `walked` spends the first hop, `branch` spends the second on one account.
  const [walked, setWalked] = useState(false);
  const [branch, setBranch] = useState<string | null>(null);

  const path = branch === FUNDS_BRANCH;
  const shown = TRACE.filter((node) => (node.depth === 1 ? walked : node.parent === branch));
  const counterparts = TRACE.filter((node) => node.depth === 1).length;
  const hops = walked ? (branch ? HOP_BUDGET : 1) : 0;

  /** The hop-1 ring lights up once the first hop is walked; the outer ring once a branch is followed. */
  const ringSpent = (radius: number) => (radius === HOP_RADIUS ? walked : branch !== null);

  const status = !walked
    ? { tone: "neutral" as BadgeTone, text: "at the anchor", label: null }
    : !branch
      ? { tone: "neutral" as BadgeTone, text: `${counterparts} counterparties`, label: null }
      : path
        ? { tone: "verified" as BadgeTone, text: "funds path found", label: true }
        : { tone: "neutral" as BadgeTone, text: "no path here", label: null };

  const hint = !walked
    ? "Walk one hop from the anchor, then pick which account to follow."
    : !branch
      ? `Hop budget ${HOP_BUDGET}. Pick one account to follow; a bounded walk follows one branch.`
      : path
        ? "Two transactions out and back: the walk returned this path as evidence."
        : "This branch returned no funds path. Reset and follow another account.";

  return (
    <StageFrame
      label="Trace"
      hint={hint}
      status={
        <StageChip tone={status.tone} live>
          {status.label ? <Check aria-hidden /> : <CircleDashed aria-hidden />}
          {status.text}
        </StageChip>
      }
    >
      <p className="mb-3 font-mono text-[11px] leading-5 text-dim">
        Bounds: hops &le; {HOP_BUDGET} &middot; window &le; 72 h &middot; records &le; 500 &middot;
        30 s
      </p>

      <div className="relative min-h-0 flex-1">
        <svg
          aria-hidden="true"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="absolute inset-0 size-full"
        >
          {/* One ring per hop of the budget: the walk is bounded, and the ring of
              a hop that has been spent lights up. */}
          {RINGS.map((ring) => {
            const spent = ringSpent(ring.radius);
            return (
              <circle
                key={ring.radius}
                cx={ANCHOR.x}
                cy={ANCHOR.y}
                r={ring.radius}
                fill="none"
                vectorEffect="non-scaling-stroke"
                strokeWidth={1}
                strokeDasharray="2 7"
                className={cn(
                  "transition-colors",
                  spent ? "stroke-accent/50" : "stroke-line-strong/70",
                )}
              />
            );
          })}

          {shown.map((node) => {
            const from = positionOf(node.parent);
            const onPath = path && (node.id === FUNDS_BRANCH || node.id === FUNDS_END);
            return (
              <line
                key={node.id}
                x1={from.x}
                y1={from.y}
                x2={node.x}
                y2={node.y}
                vectorEffect="non-scaling-stroke"
                strokeWidth={onPath ? 2 : 1.5}
                strokeDasharray={onPath ? "7 9" : undefined}
                className={cn("stroke-line-strong", onPath && "animate-flow stroke-accent")}
              />
            );
          })}
        </svg>

        {/* Hop labels: what each ring means, lit once that hop is spent. */}
        {RINGS.map((ring) => {
          const spent = ringSpent(ring.radius);
          return (
            <span
              key={ring.label}
              aria-hidden="true"
              className={cn(
                "absolute left-1/2 -translate-x-1/2 -translate-y-1/2 font-mono text-[10px] tracking-[0.16em] transition-colors",
                spent ? "text-accent" : "text-dim/60",
              )}
              style={{ top: ring.top }}
            >
              {ring.label}
            </span>
          );
        })}

        {/* Anchor: the transaction the investigation starts from. */}
        <button
          type="button"
          onClick={() => setWalked(true)}
          disabled={walked}
          aria-label={
            walked
              ? "Anchor transaction, both hops walked"
              : "Walk one hop out from the anchor transaction"
          }
          className="group absolute z-10 -translate-x-1/2 -translate-y-1/2 rounded-full disabled:cursor-default"
          style={{ left: `${ANCHOR.x}%`, top: `${ANCHOR.y}%` }}
        >
          {!walked ? (
            <span
              aria-hidden="true"
              className="absolute -inset-2 animate-node-pulse rounded-full border border-accent/50"
            />
          ) : null}
          <span
            aria-hidden="true"
            className={cn(
              "relative flex size-6 items-center justify-center rounded-full border-2 border-accent bg-[#1a110a]",
              !walked && "transition-transform group-hover:scale-110",
            )}
          >
            <span className="size-2 rounded-full bg-accent" />
          </span>
          <span className="absolute top-full left-1/2 mt-1.5 -translate-x-1/2 font-mono text-[10px] whitespace-nowrap text-accent">
            anchor
          </span>
        </button>

        {/* First hop: one button per counterparty, each one able to spend the second hop. */}
        {TRACE.filter((node) => node.depth === 1 && walked).map((node, index) => {
          const active = branch === node.id;
          const open = branch === null;
          return (
            <button
              key={node.id}
              type="button"
              onClick={() => setBranch(node.id)}
              disabled={!open}
              aria-label={`Follow ${node.label ?? node.id} one hop`}
              className={cn(
                "group absolute z-10 -translate-x-1/2 -translate-y-1/2 rounded-full disabled:cursor-default",
                TRACE_REVEAL,
                !open && !active && "opacity-45",
              )}
              style={{
                left: `${node.x}%`,
                top: `${node.y}%`,
                animationDelay: `${index * 60}ms`,
              }}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "relative block size-4 rounded-full border-2 bg-canvas",
                  active ? "border-accent" : "border-line-strong",
                  open && "transition-transform group-hover:scale-125 group-hover:border-accent",
                )}
              />
              <span
                className={cn(
                  "absolute top-full left-1/2 mt-1.5 -translate-x-1/2 font-mono text-[10px] whitespace-nowrap",
                  active ? "text-accent" : "text-dim",
                )}
              >
                {node.label}
              </span>
            </button>
          );
        })}

        {/* Second hop: the two accounts of the branch that was followed. */}
        {TRACE.filter((node) => node.depth === 2 && node.parent === branch).map((node, index) => {
          const end = path && node.id === FUNDS_END;
          return (
            <span
              key={node.id}
              aria-hidden="true"
              className={cn("absolute z-10 -translate-x-1/2 -translate-y-1/2", TRACE_REVEAL)}
              style={{
                left: `${node.x}%`,
                top: `${node.y}%`,
                animationDelay: `${index * 60}ms`,
              }}
            >
              <span
                className={cn(
                  "block size-3.5 rounded-full border-2 bg-canvas",
                  end ? "border-accent" : "border-line-strong",
                )}
              />
              {end ? (
                <span className="absolute bottom-full left-1/2 mb-2 -translate-x-1/2 font-mono text-[10px] whitespace-nowrap text-accent">
                  funds path
                </span>
              ) : null}
            </span>
          );
        })}
      </div>

      <div className="mt-3 flex items-center gap-2">
        <Button variant="primary" size="sm" onClick={() => setWalked(true)} disabled={walked}>
          Walk one hop
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setWalked(false);
            setBranch(null);
          }}
          disabled={!walked}
        >
          Reset
        </Button>
        <span className="ml-auto font-mono text-[11px] text-dim">
          hops {hops}/{HOP_BUDGET}
        </span>
      </div>
    </StageFrame>
  );
}

// ---- Step 03: verify --------------------------------------------------------

type Claim = {
  id: string;
  text: string;
  supported: boolean;
  /** Record or path reference the claim is checked against, as the tools returned it. */
  record: string;
};

const CLAIMS: readonly Claim[] = [
  {
    id: "amount",
    text: "9,400 USD left acct-8820 at 02:14",
    supported: true,
    record: "tx-3f8a",
  },
  {
    id: "watchlist",
    text: "The counterparty is on a sanctions list",
    supported: false,
    record: "not in records",
  },
  {
    id: "path",
    text: "A three-hop path reaches the cash-out account",
    supported: true,
    record: "path-77c1",
  },
];

export function VerifyStage() {
  const [checked, setChecked] = useState<readonly string[]>([]);
  const allChecked = checked.length === CLAIMS.length;
  const supported = CLAIMS.filter((claim) => claim.supported).length;
  const rejected = CLAIMS.length - supported;

  return (
    <StageFrame
      label="Verify"
      hint="Click a claim to check it against what the tools returned."
      status={
        <StageChip tone={allChecked ? "review" : "neutral"} live>
          {allChecked
            ? `${supported} supported · ${rejected} rejected`
            : `${checked.length} of ${CLAIMS.length} checked`}
        </StageChip>
      }
    >
      <div className="my-auto">
        <p className="font-mono text-[11px] tracking-[0.18em] text-dim uppercase">
          Claims from the draft report
        </p>

        <div className="mt-3 flex flex-col gap-2.5">
          {CLAIMS.map((claim) => {
            const done = checked.includes(claim.id);
            return (
              <button
                key={claim.id}
                type="button"
                onClick={() => setChecked((ids) => [...ids, claim.id])}
                className="flex w-full items-start gap-3 rounded-lg border border-line bg-[#e6e7e5]/[0.02] px-3 py-3 text-left transition-colors hover:border-line-strong hover:bg-[#e6e7e5]/[0.05]"
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border",
                    done
                      ? claim.supported
                        ? "border-safe/50 bg-safe/10 text-safe"
                        : "border-critical/50 bg-critical/10 text-critical"
                      : "animate-pulse border-dashed border-line-strong",
                  )}
                >
                  {done ? (
                    claim.supported ? (
                      <Check className="size-3" />
                    ) : (
                      <X className="size-3" />
                    )
                  ) : null}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] leading-5 text-ink">{claim.text}</span>
                  {done ? (
                    <span className="mt-1.5 flex items-center gap-2">
                      <span
                        className={cn(
                          "font-mono text-[11px]",
                          claim.supported ? "text-safe" : "text-critical",
                        )}
                      >
                        {claim.supported ? "supported" : "rejected"}
                      </span>
                      <Badge tone="neutral" className="font-mono">
                        {claim.record}
                      </Badge>
                    </span>
                  ) : null}
                </span>
              </button>
            );
          })}
        </div>

        {/* Closing note once every claim has been checked. */}
        {allChecked ? (
          <p className="mt-4 animate-[hero-rise_340ms_cubic-bezier(0.22,1,0.36,1)_both] text-[12px] leading-5 text-dim">
            Only supported claims reach the case; the rejected one is dropped.
          </p>
        ) : null}
      </div>
    </StageFrame>
  );
}

// ---- Step 04: decide --------------------------------------------------------

type CaseEntry = {
  id: string;
  label: string;
  meta: string;
  tone: "accent" | "critical" | "dim";
};

const OPENED: CaseEntry = {
  id: "opened",
  label: "Case opened",
  meta: "alert tx-9c12 · policy suggests review",
  tone: "accent",
};

const DECISION: Record<
  "confirmed" | "dismissed",
  {
    chip: string;
    tone: BadgeTone;
    icon: typeof Check;
    label: string;
    meta: string;
    dot: CaseEntry["tone"];
  }
> = {
  confirmed: {
    chip: "Confirmed",
    tone: "critical",
    icon: ShieldAlert,
    label: "Analyst confirmed",
    meta: "reviewer ana-2109 · 4 evidence references",
    dot: "critical",
  },
  dismissed: {
    chip: "Dismissed",
    tone: "neutral",
    icon: CircleSlash,
    label: "Analyst dismissed",
    meta: "reviewer ana-2109 · reason kept with the case",
    dot: "dim",
  },
};

const DOT: Record<CaseEntry["tone"], string> = {
  accent: "bg-accent",
  critical: "bg-critical",
  dim: "bg-dim",
};

export function DecideStage() {
  const [log, setLog] = useState<readonly CaseEntry[]>([OPENED]);
  const [decision, setDecision] = useState<"confirmed" | "dismissed" | null>(null);
  const current = decision ? DECISION[decision] : null;
  const StatusIcon = current ? current.icon : Flag;

  function decide(kind: "confirmed" | "dismissed") {
    setDecision(kind);
    setLog((entries) => [
      ...entries,
      {
        id: `${kind}-${entries.length}`,
        label: DECISION[kind].label,
        meta: DECISION[kind].meta,
        tone: DECISION[kind].dot,
      },
    ]);
  }

  return (
    <StageFrame
      label="Decide"
      hint="The record is append-only: nothing an analyst does is erased."
      status={
        <StageChip tone={current ? current.tone : "review"} live>
          <StatusIcon aria-hidden />
          {current ? current.chip : "Review required"}
        </StageChip>
      }
    >
      <p className="font-mono text-[11px] tracking-[0.18em] text-dim uppercase">
        Policy suggests: review
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button variant="primary" size="sm" onClick={() => decide("confirmed")}>
          <Check aria-hidden />
          Confirm case
        </Button>
        <Button variant="secondary" size="sm" onClick={() => decide("dismissed")}>
          <X aria-hidden />
          Dismiss
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="ml-auto"
          onClick={() => {
            setLog([OPENED]);
            setDecision(null);
          }}
          disabled={log.length === 1}
        >
          Reset
        </Button>
      </div>

      <div className="mt-4 flex min-h-0 flex-1 flex-col rounded-lg border border-line bg-[#080909]/40 p-3">
        <p className="font-mono text-[10px] tracking-[0.18em] text-dim uppercase">Case history</p>
        <ol className="mt-3 min-h-0 flex-1 scrollbar-thin space-y-3 overflow-y-auto border-l border-line-strong pl-5">
          {log.map((entry) => (
            <li
              key={entry.id}
              className="relative animate-[hero-rise_340ms_cubic-bezier(0.22,1,0.36,1)_both]"
            >
              <span
                aria-hidden="true"
                className={cn(
                  "absolute top-[5px] -left-5 size-2.5 -translate-x-1/2 rounded-full ring-2 ring-[#080909]",
                  DOT[entry.tone],
                )}
              />
              <p className="text-[13px] leading-5 text-ink">{entry.label}</p>
              <p className="mt-0.5 font-mono text-[11px] leading-4 text-dim">{entry.meta}</p>
            </li>
          ))}
        </ol>

        {/* What the record belongs to, and how much is in it. */}
        <div className="mt-3 flex items-center justify-between gap-3 border-t border-line pt-2.5 font-mono text-[10px] tracking-[0.14em] text-dim uppercase">
          <span>case-4f21 &middot; ana-2109</span>
          <span>
            {log.length} {log.length === 1 ? "entry" : "entries"}
          </span>
        </div>
      </div>
    </StageFrame>
  );
}
