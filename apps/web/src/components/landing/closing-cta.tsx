import { CtaArrow, CtaLink } from "./cta";
import { PERFORMANCE_HREF, DEMO_HREF, WORKBENCH_HREF } from "./links";

export default function ClosingCta() {
  return (
    <section className="relative overflow-hidden border-t border-line px-5 py-20 sm:px-8 sm:py-24">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[420px] bg-[radial-gradient(80%_120%_at_50%_120%,rgba(242,140,56,0.24),transparent_70%)]"
      />
      <div className="relative mx-auto w-full max-w-[1260px]">
        <div
          data-reveal
          className="relative overflow-hidden rounded-[22px] border border-line bg-[#0d0e0f]/90 px-6 py-12 text-center sm:px-12 sm:py-16"
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_100%_at_50%_-20%,rgba(242,140,56,0.18),transparent_65%)]"
          />
          <div className="relative">
            <p className="text-[11px] font-medium tracking-[0.2em] text-accent uppercase">
              Get started
            </p>
            <h2 className="mx-auto mt-4 max-w-2xl text-[clamp(1.9rem,3.6vw,2.9rem)] leading-[1.06] font-semibold tracking-[-0.03em] text-ink">
              Put the graph on the case.
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-[15px] leading-7 text-dim">
              Run a bounded investigation on the synthetic replay and read the evidence before you
              decide anything.
            </p>
            <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
              <CtaLink href={WORKBENCH_HREF} size="lg">
                Open the workbench
                <CtaArrow />
              </CtaLink>
              <CtaLink href={PERFORMANCE_HREF} variant="secondary" size="lg">
                View recorded benchmarks
              </CtaLink>
              <CtaLink href={DEMO_HREF} variant="quiet" size="lg">
                Watch a replay investigation
              </CtaLink>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
