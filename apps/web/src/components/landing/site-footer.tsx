"use client";

import { ArrowUpRight } from "lucide-react";
import Link from "next/link";

import { useHealth } from "@/hooks/use-health";
import { cn } from "@/lib/cn";

import { DEMO_HREF, PERFORMANCE_HREF, REPO_URL, WORKBENCH_HREF } from "./links";

/** The FastAPI docs page. It is only linked where an address is known: in development, or when set at build time. */
const API_DOCS_URL =
  process.env.NEXT_PUBLIC_API_DOCS_URL ??
  (process.env.NODE_ENV === "development" ? "http://127.0.0.1:8000/docs" : undefined);

const PLATFORM_LINKS = [
  { label: "Live Workbench", href: WORKBENCH_HREF, external: true },
  { label: "Documentation", href: "/docs" },
  { label: "Alert Queue", href: WORKBENCH_HREF },
  { label: "Graph Investigation", href: DEMO_HREF },
  { label: "Performance", href: PERFORMANCE_HREF },
] as const;

const INVARIANT_LINKS = [
  { label: "Graph Authority", href: "#product" },
  { label: "Typology Engine", href: "#typologies" },
  { label: "Bounded Cypher", href: "#sandbox" },
  { label: "Evaluation Isolation", href: "#benchmarks" },
] as const;

const LINK_CLASS = "transition-colors hover:text-white";

/** Reads the real service state from the API; nothing is assumed when it cannot be reached. */
function ServiceStatus() {
  const health = useHealth();

  let dot = "bg-zinc-500";
  let label = "Checking service";
  if (health.isError) {
    label = "Service unreachable";
    dot = "bg-critical";
  } else if (health.data) {
    switch (health.data.falkordb) {
      case "available":
        label = "FalkorDB available";
        dot = "animate-pulse bg-safe";
        break;
      case "unavailable":
        label = "FalkorDB unavailable";
        dot = "bg-warning";
        break;
      case "not_configured":
        label = "FalkorDB not configured";
        break;
    }
  }

  return (
    <div
      role="status"
      className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-zinc-900 px-3 py-1 text-[11px] text-zinc-300"
    >
      <span className={cn("size-1.5 rounded-full", dot)} aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

function GithubMark() {
  return (
    <svg className="size-3.5 fill-current" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
      />
    </svg>
  );
}

export default function SiteFooter() {
  return (
    <footer className="relative overflow-hidden border-t border-white/10 bg-[#050507] pt-20 pb-12 font-mono text-[12px] text-zinc-400">
      <div className="mx-auto max-w-7xl space-y-16 px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 items-start gap-8 md:grid-cols-12">
          <div className="space-y-4 md:col-span-5">
            <div className="flex items-center gap-2 text-white">
              <svg
                className="size-4 text-[#f28c38]"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
              >
                <polygon points="12,2 15,9 22,12 15,15 12,22 9,15 2,12 9,9" />
              </svg>
              <span className="font-sans text-lg font-bold tracking-[0.14em] uppercase">
                Tripwire
              </span>
            </div>

            <p className="max-w-sm font-sans text-[14px] leading-relaxed text-zinc-400">
              Graph-powered anti-money laundering detection and transaction topology intelligence
              over FalkorDB with bounded Cypher investigations and deterministic policy
              verification.
            </p>

            <ServiceStatus />
          </div>

          <nav aria-label="Platform" className="space-y-3 md:col-span-3">
            <div className="font-mono text-[11px] font-bold tracking-wider text-white uppercase">
              Platform
            </div>
            <ul className="space-y-2">
              {PLATFORM_LINKS.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className={cn(LINK_CLASS, "external" in link && "flex items-center gap-1")}
                  >
                    <span>{link.label}</span>
                    {"external" in link ? (
                      <ArrowUpRight className="size-3" aria-hidden="true" />
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label="Invariants" className="space-y-3 md:col-span-2">
            <div className="font-mono text-[11px] font-bold tracking-wider text-white uppercase">
              Invariants
            </div>
            <ul className="space-y-2">
              {INVARIANT_LINKS.map((link) => (
                <li key={link.href}>
                  <a href={link.href} className={LINK_CLASS}>
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label="Developer" className="space-y-3 md:col-span-2">
            <div className="font-mono text-[11px] font-bold tracking-wider text-white uppercase">
              Developer
            </div>
            <ul className="space-y-2">
              {API_DOCS_URL ? (
                <li>
                  <a
                    href={API_DOCS_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(LINK_CLASS, "flex items-center gap-1")}
                  >
                    <span>API Docs</span>
                    <ArrowUpRight className="size-3" aria-hidden="true" />
                  </a>
                </li>
              ) : null}
              <li>
                <a
                  href={REPO_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(LINK_CLASS, "flex items-center gap-1.5")}
                >
                  <GithubMark />
                  <span>GitHub</span>
                </a>
              </li>
              <li>
                <span className="text-zinc-600">pnpm / uv toolchain</span>
              </li>
            </ul>
          </nav>
        </div>

        <div
          aria-hidden="true"
          className="[container-type:inline-size] overflow-hidden border-t border-white/10 pt-8 select-none"
        >
          <div className="font-sans text-[21.5cqw] leading-[0.8] font-black tracking-[-0.05em] text-zinc-900/80 uppercase transition-colors hover:text-zinc-800">
            Tripwire
          </div>
        </div>

        <div className="flex flex-col items-center justify-between gap-4 border-t border-white/5 pt-6 text-[11px] text-zinc-600 sm:flex-row">
          <div>Tripwire · Synthetic IBM AMLworld Workbench · FalkorDB</div>
          <div>Zero emoji · Strict TypeScript · Bounded Execution</div>
        </div>
      </div>
    </footer>
  );
}
