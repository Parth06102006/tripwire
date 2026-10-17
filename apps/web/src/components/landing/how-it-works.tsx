import { Search, ShieldCheck, Target, UserCheck } from "lucide-react";

const STEPS = [
  {
    icon: Search,
    title: "Score the transfer",
    body: "A LightGBM model with past-only graph features scores each transaction at its own timestamp. A logistic baseline is evaluated on the same frozen rows, so the graph contribution is visible.",
  },
  {
    icon: Target,
    title: "Trace the network",
    body: "The investigation walks outward from the anchor transaction with bounded Cypher: counterparties, funds paths and flow patterns, capped by hops, time window, rows and duration.",
  },
  {
    icon: ShieldCheck,
    title: "Verify the evidence",
    body: "A tool-calling agent drafts the report. Deterministic validation re-checks every claim against the records the tools returned, and counter-evidence stays next to the supporting set.",
  },
  {
    icon: UserCheck,
    title: "Decide and record",
    body: "Policy maps the validated result to allow or review. The analyst confirms or dismisses, and the case keeps the decision, the reviewer and the evidence references.",
  },
] as const;

export default function HowItWorks() {
  return (
    <section
      id="how-it-works"
      data-anchor
      className="border-t border-line bg-[#090a0b]/60 px-5 py-20 sm:px-8 sm:py-24"
    >
      <div className="mx-auto w-full max-w-[1260px]">
        <div data-reveal>
          <p className="flex items-center gap-2.5 text-[11px] font-medium tracking-[0.2em] text-accent uppercase">
            <span aria-hidden="true" className="h-px w-6 bg-accent/50" />
            How it works
          </p>
          <h2 className="mt-4 max-w-3xl text-[clamp(1.9rem,3.4vw,2.7rem)] leading-[1.08] font-semibold tracking-[-0.03em] text-ink">
            From a flagged transfer to a reviewable case.
          </h2>
        </div>

        <ol className="mt-14 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, index) => {
            const Icon = step.icon;
            return (
              <li
                key={step.title}
                data-reveal
                style={{ ["--reveal-delay" as string]: `${index * 80}ms` }}
                className="relative border-t border-line pt-6"
              >
                <span aria-hidden="true" className="absolute -top-px left-0 h-px w-10 bg-accent" />
                <span className="flex items-center justify-between">
                  <span className="font-mono text-[11px] tracking-[0.22em] text-accent">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <Icon aria-hidden="true" className="h-4 w-4 text-dim" />
                </span>
                <h3 className="mt-4 text-[17px] font-semibold tracking-tight text-ink">
                  {step.title}
                </h3>
                <p className="mt-2.5 text-[14px] leading-7 text-dim">{step.body}</p>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
