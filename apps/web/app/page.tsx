import Link from "next/link";
import { NAV_ITEMS } from "./components/site-nav";

export default function Home() {
  return (
    <main className="flex flex-col gap-8">
      <section className="rounded-lg border border-[#292936] bg-[#12121A] p-8">
        <p className="font-mono text-xs tracking-widest text-[#B68CFF] uppercase">
          TraceAML
        </p>
        <h1 className="mt-2 max-w-xl text-3xl font-semibold tracking-tight">
          Synthetic AML transaction replay
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-[#9693A8]">
          Review risk-ranked transactions from IBM AMLworld HI-Small, investigate
          their bounded money-flow relationships in FalkorDB, and compare offline
          model results. This is a synthetic dataset replay, not a live bank feed.
        </p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md border border-[#292936] bg-[#191923] p-4 transition-colors hover:border-[#B68CFF] focus-visible:outline-2 focus-visible:outline-[#B68CFF]"
            >
              <span className="text-sm font-semibold">{item.label}</span>
              <span className="mt-1 block text-xs text-[#9693A8]">
                {item.hint}
              </span>
            </Link>
          ))}
        </div>
      </section>

    </main>
  );
}
