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
          Analyst workbench scaffold
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-[#9693A8]">
          Initial Next.js App Router shell for transaction triage and graph
          investigation. Routes and layout only. No backend calls, no replay
          stream, no scores or metrics are displayed in this scaffold.
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

      <section className="rounded-lg border border-[#292936] bg-[#12121A] p-6">
        <h2 className="text-sm font-semibold">Scaffold scope</h2>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm leading-6 text-[#9693A8]">
          <li>TypeScript with strict mode, App Router, Tailwind CSS, ESLint.</li>
          <li>Static routes only; no data fetching or Server-Sent Events yet.</li>
          <li>Empty states intentionally show no transactions or results.</li>
        </ul>
      </section>
    </main>
  );
}
