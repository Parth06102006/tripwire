import { StickyTeaserScroll, type StickyTeaserItem } from "@/components/ui/sticky-teaser-scroll";

import { DEMO_HREF, PERFORMANCE_HREF } from "./links";

/** Height of the sticky landing header at desktop widths, so the pinned image sits below it. */
const HEADER_HEIGHT = 72;

const STEPS: readonly StickyTeaserItem[] = [
  {
    id: "score",
    eyebrow: "Step 01",
    title: "Score the transfer",
    description:
      "A LightGBM model with past-only graph features scores each transaction at its own timestamp. A logistic baseline is evaluated on the same frozen rows, so the graph contribution is visible.",
    href: PERFORMANCE_HREF,
    linkLabel: "See the benchmarks",
    image: {
      src: "/how-it-works/01-score.svg",
      alt: "A transfer from one account through a transaction node to another, above a risk scale with a review threshold and a block rule.",
    },
  },
  {
    id: "trace",
    eyebrow: "Step 02",
    title: "Trace the network",
    description:
      "The investigation walks outward from the anchor transaction with bounded Cypher: counterparties, funds paths and flow patterns, capped by hops, time window, rows and duration.",
    href: DEMO_HREF,
    linkLabel: "Open an investigation",
    image: {
      src: "/how-it-works/02-trace.svg",
      alt: "A network growing outward from one anchor transaction in two bounded hops, with one path highlighted.",
    },
  },
  {
    id: "verify",
    eyebrow: "Step 03",
    title: "Verify the evidence",
    description:
      "A tool-calling agent drafts the report. Deterministic validation re-checks every claim against the records the tools returned, and counter-evidence stays next to the supporting set.",
    image: {
      src: "/how-it-works/03-verify.svg",
      alt: "Four claims checked against returned records: three verified and one rejected as not in the records.",
    },
  },
  {
    id: "decide",
    eyebrow: "Step 04",
    title: "Decide and record",
    description:
      "Policy maps the validated result to allow or review. The analyst confirms or dismisses, and the case keeps the decision, the reviewer and the evidence references.",
    image: {
      src: "/how-it-works/04-decide.svg",
      alt: "A review decision followed by an append-only case history: case opened, analyst confirmed, evidence references kept.",
    },
  },
];

/**
 * The four-step workflow as a pinned image beside scrolling teasers. The
 * section must not clip overflow: `position: sticky` needs the page itself to
 * be the scroll container.
 */
export default function HowItWorks() {
  return (
    <section
      id="how-it-works"
      data-anchor
      className="border-t border-line bg-[#090a0b]/60 pt-20 pb-12 sm:pt-24"
    >
      <div className="mx-auto w-full max-w-[1260px] px-5 sm:px-8">
        <div data-reveal>
          <p className="flex items-center gap-2.5 text-[11px] font-medium tracking-[0.2em] text-accent uppercase">
            <span aria-hidden="true" className="h-px w-6 bg-accent/50" />
            How it works
          </p>
          <h2 className="mt-4 max-w-3xl text-[clamp(1.9rem,3.4vw,2.7rem)] leading-[1.08] font-semibold tracking-[-0.03em] text-ink">
            From a flagged transfer to a reviewable case.
          </h2>
        </div>
      </div>

      <StickyTeaserScroll items={STEPS} stickyTop={HEADER_HEIGHT} linkLabel="Learn more" />
    </section>
  );
}
