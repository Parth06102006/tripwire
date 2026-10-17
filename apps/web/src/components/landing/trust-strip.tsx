import { CalendarRange, Database, Network, Scale } from "lucide-react";

const ITEMS = [
  {
    icon: Database,
    title: "Synthetic replay",
    body: "IBM AMLworld HI-Small, loaded into FalkorDB and replayed locally. No live bank feed.",
  },
  {
    icon: CalendarRange,
    title: "Frozen cohort",
    body: "Chronological train, validation and test split. The test cohort is scored once.",
  },
  {
    icon: Network,
    title: "Bounded Cypher",
    body: "Hop depth, time window, row and duration caps on every graph query.",
  },
  {
    icon: Scale,
    title: "Policy owns the call",
    body: "Models produce scores. Deterministic policy maps them to allow, review or simulated block.",
  },
] as const;

export default function TrustStrip() {
  return (
    <section
      aria-label="How the replay works"
      className="relative border-t border-line bg-[#090a0b]/80"
    >
      <div className="mx-auto grid w-full max-w-[1260px] gap-px px-4 py-10 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
        {ITEMS.map((item, index) => {
          const Icon = item.icon;
          return (
            <div
              key={item.title}
              data-reveal
              style={{ ["--reveal-delay" as string]: `${index * 70}ms` }}
              className="flex gap-3.5 px-1 py-2 sm:px-4"
            >
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] border border-line bg-white/[0.03] text-accent">
                <Icon aria-hidden="true" className="h-4 w-4" />
              </span>
              <span className="min-w-0">
                <span className="block text-[13px] font-semibold text-ink">{item.title}</span>
                <span className="mt-1 block text-[13px] leading-6 text-dim">{item.body}</span>
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
