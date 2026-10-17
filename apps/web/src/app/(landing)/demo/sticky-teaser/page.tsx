import type { Metadata } from "next";
import Link from "next/link";

import { StickyTeaserScroll, type StickyTeaserItem } from "@/components/ui/sticky-teaser-scroll";

export const metadata: Metadata = {
  title: "Sticky teaser scroll demo",
  robots: { index: false, follow: false },
};

const photo = (seed: string) => `https://picsum.photos/seed/${seed}/1000/1250`;

const ITEMS: readonly StickyTeaserItem[] = [
  {
    id: "harbour",
    eyebrow: "Project 01",
    title: "Harbour Light",
    description:
      "A waterfront redevelopment that keeps the old crane line and opens the quay to walkers and cyclists.",
    href: "#harbour",
    image: { src: photo("harbour-light"), alt: "A harbour at dusk with cranes against the sky" },
  },
  {
    id: "orchard",
    eyebrow: "Project 02",
    title: "Orchard Row",
    description:
      "Forty low-rise homes arranged around a working orchard, shared paths and a single car-free lane.",
    href: "#orchard",
    image: { src: photo("orchard-row"), alt: "Rows of trees in soft morning light" },
  },
  {
    id: "atrium",
    eyebrow: "Project 03",
    title: "The Atrium",
    description:
      "A civic library built around a daylit central court, with reading rooms that step down to the street.",
    image: { src: photo("the-atrium"), alt: "A tall bright interior with stairs and skylights" },
  },
  {
    id: "ridge",
    eyebrow: "Project 04",
    title: "Ridge House",
    description:
      "A weekend house set into the slope, using local stone and a roof that disappears into the hillside.",
    href: "#ridge",
    linkLabel: "Read the story",
    image: { src: photo("ridge-house"), alt: "A stone house on a green hillside" },
  },
];

export default async function StickyTeaserDemoPage({
  searchParams,
}: {
  searchParams: Promise<{ side?: string; scrubbed?: string }>;
}) {
  const { side, scrubbed } = await searchParams;
  const imageSide = side === "left" ? "left" : "right";
  const isScrubbed = scrubbed === "1";

  return (
    <main className="min-h-screen bg-canvas text-ink">
      <header className="mx-auto max-w-[1260px] px-5 pt-16 pb-12 sm:px-8">
        <p className="font-mono text-[11px] tracking-[0.22em] text-accent uppercase">Demo</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-[-0.03em]">Sticky teaser scroll</h1>
        <p className="mt-3 max-w-[60ch] text-[15px] leading-7 text-dim">
          Scroll down. The image stays pinned and swaps as each teaser crosses the middle of the
          screen. Below 992px the pinning turns off and each teaser carries its own image.
        </p>
        <nav aria-label="Variants" className="mt-6 flex flex-wrap gap-2 text-[13px]">
          {[
            { label: "Image right", href: "?side=right" },
            { label: "Image left", href: "?side=left" },
            { label: "Scrubbed", href: "?scrubbed=1" },
          ].map((variant) => (
            <Link
              key={variant.href}
              href={variant.href}
              className="rounded-full border border-line-strong px-3.5 py-1.5 text-ink transition-colors hover:bg-white/[0.06]"
            >
              {variant.label}
            </Link>
          ))}
        </nav>
      </header>

      <StickyTeaserScroll items={ITEMS} imageSide={imageSide} scrubbed={isScrubbed} />

      <footer className="mx-auto max-w-[1260px] px-5 py-24 text-center text-[13px] text-dim sm:px-8">
        End of demo.
      </footer>
    </main>
  );
}
