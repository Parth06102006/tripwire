import { CtaArrow, CtaLink } from "./cta";
import { DEMO_HREF, REPO_URL, WORKBENCH_HREF } from "./links";

interface HeroProps {
  onRequestDemo?: () => void;
  onContact?: () => void;
}

export default function Hero({ onRequestDemo, onContact }: HeroProps) {
  return (
    <section aria-labelledby="hero-title" className="relative">
      {/* Ambient warm gradient radiating from below and center */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[620px] overflow-hidden"
      >
        <div className="absolute inset-0 bg-[radial-gradient(110%_80%_at_50%_-10%,rgba(242,140,56,0.38),rgba(150,70,25,0.16)_40%,transparent_74%)]" />
        <div className="grain-layer absolute inset-0 opacity-[0.05] mix-blend-soft-light" />
      </div>

      <div className="relative mx-auto w-full max-w-[1260px] px-5 pt-10 sm:px-8 sm:pt-14 lg:pt-16">
        <div className="grid items-end gap-8 lg:grid-cols-12 lg:gap-12">
          {/* Left headline column */}
          <div className="lg:col-span-7 xl:col-span-7">
            <span className="inline-flex animate-hero-rise items-center gap-2 rounded-full border border-line-strong/60 bg-[#16120e]/80 px-3.5 py-1.5 text-[11px] font-medium tracking-[0.18em] text-[#e0a97c] uppercase shadow-sm">
              <span
                aria-hidden="true"
                className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent"
              />
              AML INVESTIGATION WORKBENCH
            </span>
            <h1
              id="hero-title"
              className="mt-5 animate-hero-rise text-[clamp(2.7rem,6.4vw,5.1rem)] leading-[0.98] font-bold tracking-[-0.035em] text-white"
            >
              Follow the money.
              <br />
              Uncover the network.
            </h1>
          </div>

          {/* Right description and action column */}
          <div className="flex flex-col justify-end lg:col-span-5 lg:pb-2 xl:col-span-5">
            <p className="max-w-[44ch] animate-hero-rise text-[15px] leading-7 font-normal text-[#b5b8b4] [animation-delay:120ms] sm:text-[16px]">
              Score suspicious transfers, let the agent trace the money through bounded Cypher, and
              read an investigation report where every claim is checked against the records behind
              it.
            </p>
            <div className="mt-7 flex animate-hero-rise flex-wrap items-center gap-3.5 [animation-delay:200ms]">
              {onRequestDemo ? (
                <button
                  type="button"
                  onClick={onRequestDemo}
                  className="group inline-flex items-center justify-center gap-2 rounded-full bg-accent px-6 py-3 text-[14px] font-semibold text-accent-ink shadow-[0_14px_40px_-16px_rgba(242,140,56,0.9)] transition-all duration-200 hover:shadow-[0_18px_48px_-14px_rgba(242,140,56,0.95)] hover:brightness-110"
                >
                  Request a demo
                  <CtaArrow />
                </button>
              ) : (
                <CtaLink href={DEMO_HREF} size="lg">
                  Request a demo
                  <CtaArrow />
                </CtaLink>
              )}

              {onContact ? (
                <button
                  type="button"
                  onClick={onContact}
                  className="inline-flex items-center justify-center rounded-full border border-line-strong bg-[#141516]/80 px-6 py-3 text-[14px] font-medium text-ink transition-colors hover:border-white/30 hover:bg-white/[0.06]"
                >
                  Contact us
                </button>
              ) : (
                <CtaLink href={REPO_URL} variant="secondary" size="lg">
                  Contact us
                </CtaLink>
              )}

              <CtaLink
                href={WORKBENCH_HREF}
                variant="quiet"
                size="md"
                className="hidden text-[13px] text-dim hover:text-accent xl:inline-flex"
              >
                Open the workbench
              </CtaLink>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
