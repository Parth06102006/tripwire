import Link from "next/link";
import { cn } from "@/lib/cn";
import { BrandLockup } from "./brand";
import { DEMO_HREF, PERFORMANCE_HREF, REPO_ISSUES_URL, REPO_URL, WORKBENCH_HREF } from "./links";

const COLUMNS = [
  {
    heading: "Workbench",
    links: [
      { label: "Overview", href: WORKBENCH_HREF },
      { label: "Investigation", href: DEMO_HREF },
    ],
  },
  {
    heading: "Evaluation",
    links: [{ label: "Performance", href: PERFORMANCE_HREF }],
  },
] as const;

export default function SiteFooter() {
  return (
    <footer className="border-t border-line bg-[#08090a] px-5 pt-14 pb-8 sm:px-8">
      <div className="mx-auto w-full max-w-[1260px]">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1.4fr)_repeat(2,minmax(0,1fr))]">
          <div>
            <BrandLockup subtitle="Graph-powered AML workbench" />
            <p className="mt-5 max-w-sm text-[13px] leading-6 text-dim">
              A detection and investigation workbench for synthetic IBM AMLworld data: reproducible
              models, bounded graph evidence and reports that stay inside what the queries returned.
            </p>
            <div className="mt-5 flex flex-wrap gap-3 text-[12px]">
              <Link
                href={REPO_URL}
                target="_blank"
                rel="noreferrer"
                className="rounded-full border border-line-strong px-3.5 py-1.5 text-ink transition-colors hover:bg-white/[0.06]"
              >
                Repository
              </Link>
              <Link
                href={REPO_ISSUES_URL}
                target="_blank"
                rel="noreferrer"
                className="rounded-full border border-line-strong px-3.5 py-1.5 text-ink transition-colors hover:bg-white/[0.06]"
              >
                Report an issue
              </Link>
            </div>
          </div>

          {COLUMNS.map((column) => (
            <nav key={column.heading} aria-label={column.heading}>
              <h2 className="text-[11px] font-medium tracking-[0.18em] text-dim uppercase">
                {column.heading}
              </h2>
              <ul className="mt-4 flex flex-col gap-2.5">
                {column.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-[13px] text-ink/80 transition-colors hover:text-accent"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-12 flex flex-col gap-4 border-t border-line pt-6 text-[11px] leading-6 text-dim">
          <p className="max-w-4xl">
            IBM AMLworld HI-Small is synthetic data, replayed here and never presented as a live
            bank feed. Benchmark results demonstrate behaviour on that dataset and are not evidence
            of real-world detection performance.
          </p>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className={cn("font-mono")}>Tripwire · TraceAML workbench</span>
            <span className="inline-flex items-center gap-2 rounded-full border border-line bg-[#101214] px-3 py-1 font-mono text-[11px] text-ink">
              <span className="h-2 w-2 animate-pulse rounded-full bg-safe" />
              FastAPI Engine Online · 761,639 Replay Records
            </span>
            <span>Built with Next.js, FastAPI and FalkorDB · dataset licence CDLA-Sharing-1.0</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
