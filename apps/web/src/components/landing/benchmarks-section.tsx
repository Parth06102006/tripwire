import { Info } from "lucide-react";
import RecordedMetrics from "./recorded-metrics";
import { SectionHeading } from "./section-heading";

const PROTOCOL = [
  {
    title: "One frozen cohort",
    body: "Train, validation and test splits are chronological. A transaction's features never use information later than its own timestamp.",
  },
  {
    title: "Thresholds chosen on validation",
    body: "The operating threshold is tuned on training and validation data, then applied once to the frozen test cohort.",
  },
  {
    title: "Recall at a fixed budget",
    body: "Results include recall at a stated alert budget, because a review team can only work a bounded queue.",
  },
  {
    title: "Measured, not assumed",
    body: "P50 and P95 latency, throughput, graph scope and cost per 1,000 decisions are reported after warm-up, with the hardware stated.",
  },
] as const;

export default function BenchmarksSection() {
  return (
    <section
      id="benchmarks"
      data-anchor
      className="border-t border-line px-5 py-20 sm:px-8 sm:py-24"
    >
      <div className="mx-auto w-full max-w-[1260px]">
        <div data-reveal>
          <SectionHeading
            eyebrow="Benchmarks"
            title="Numbers with their protocol attached."
            description="Figures come from the recorded run artifact the API serves, shown next to the conditions that produced them."
          />
        </div>

        <div className="mt-12 grid gap-8 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)] lg:items-start">
          <div data-reveal>
            <RecordedMetrics />
          </div>

          <ul className="grid gap-5" data-reveal>
            {PROTOCOL.map((item) => (
              <li key={item.title} className="flex gap-3.5">
                <span aria-hidden="true" className="mt-2 h-px w-5 shrink-0 bg-accent/60" />
                <span className="min-w-0">
                  <span className="block text-[14px] font-semibold text-ink">{item.title}</span>
                  <span className="mt-1 block text-[13px] leading-6 text-dim">{item.body}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <p
          data-reveal
          className="mt-10 flex items-start gap-3 rounded-card border border-line bg-white/[0.02] p-4 text-[12px] leading-6 text-dim"
        >
          <Info aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
          <span>
            Synthetic IBM AMLworld HI-Small data. Reported results demonstrate behaviour on that
            benchmark and do not transfer to a real bank without re-evaluation.
          </span>
        </p>
      </div>
    </section>
  );
}
