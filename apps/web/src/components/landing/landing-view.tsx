"use client";

import CypherSandbox from "./cypher-sandbox";
import { HatchRule } from "./hatch-rule";
import Hero from "./hero";
import HowItWorks from "./how-it-works";
import ProductSection from "./product-section";
import RevealScope from "./reveal-scope";
import SiteFooter from "./site-footer";
import SiteHeader from "./site-header";
import TrustStrip from "./trust-strip";
import TypologiesExplorer from "./typologies-explorer";
import WorkbenchPreview from "./workbench-preview";
import { WorldDotMap } from "./world-map";

export default function LandingView() {
  return (
    <div
      data-landing-root
      className="relative min-h-screen w-full overflow-x-clip bg-[#0a0b0c] text-ink selection:bg-accent selection:text-accent-ink"
    >
      <a
        href="#content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-full focus:bg-accent focus:px-4 focus:py-2 focus:text-[13px] focus:font-semibold focus:text-accent-ink"
      >
        Skip to content
      </a>

      <RevealScope>
        {/* Navigation Header */}
        <SiteHeader />

        {/* Precision Blueprint Hatch Rule right below Header */}
        <HatchRule density={1} showCrosshairs className="opacity-80" />

        <main id="content" className="w-full">
          {/* Hero Section */}
          <Hero />

          {/* Product Preview: Amber Dot-Matrix World Silhouette + Floating Workbench Card */}
          <section
            aria-label="Tripwire AI Investigation Workbench"
            className="relative overflow-hidden pt-12 pb-16 sm:pt-16 sm:pb-24"
          >
            <WorldDotMap className="h-[440px] sm:h-[580px] lg:h-[680px]" />
            <div className="relative mx-auto w-full max-w-[1260px] px-4 sm:px-6">
              <WorkbenchPreview />
            </div>
          </section>

          {/* Trust Guarantees */}
          <TrustStrip />

          {/* Interactive AML Typology Engine */}
          <TypologiesExplorer />

          {/* Core Architecture Invariants & First-Class Transactions */}
          <ProductSection />

          {/* Interactive Live Cypher Execution Sandbox */}
          <CypherSandbox />

          {/* 4-Step Investigation Pipeline */}
          <HowItWorks />
        </main>

        {/* Site Footer */}
        <SiteFooter />
      </RevealScope>
    </div>
  );
}
