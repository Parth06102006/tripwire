import { CtaArrow, CtaLink } from "./cta";
import { SIGN_IN_HREF } from "./links";

/**
 * The hero: the headline, one line on what the product does, and one way in.
 * Get started goes to the sign-in page, which sends a visitor who is already
 * signed in straight on to the workbench.
 */
export default function Hero() {
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
              className="mt-5 animate-hero-rise text-[clamp(2.4rem,4.4vw,3.8rem)] leading-[1.02] font-bold tracking-[-0.035em] text-white"
            >
              {/* One line per sentence from the lg breakpoint up; narrower screens may wrap. */}
              <span className="block lg:whitespace-nowrap">Follow the money.</span>
              <span className="block lg:whitespace-nowrap">Uncover the network.</span>
            </h1>
          </div>

          {/* Right description and action column */}
          <div className="flex flex-col justify-end lg:col-span-5 lg:pb-2 xl:col-span-5">
            <p className="max-w-[40ch] animate-hero-rise text-[15px] leading-7 font-normal text-[#b5b8b4] [animation-delay:120ms] sm:text-[16px]">
              Trace suspicious money through the graph, with every claim checked against the
              records.
            </p>
            <div className="mt-7 flex animate-hero-rise flex-wrap items-center gap-3.5 [animation-delay:200ms]">
              <CtaLink href={SIGN_IN_HREF} size="lg">
                Get started
                <CtaArrow />
              </CtaLink>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
