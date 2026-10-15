import Link from "next/link";

export interface NavItem {
  href: "/alerts" | "/investigations" | "/benchmarks" | "/system";
  label: string;
  hint: string;
}

export const NAV_ITEMS: readonly NavItem[] = [
  { href: "/alerts", label: "Alerts", hint: "Triage queue" },
  { href: "/investigations", label: "Investigations", hint: "Graph workspace" },
  { href: "/benchmarks", label: "Benchmarks", hint: "Ablation results" },
  { href: "/system", label: "System", hint: "Service health" },
] as const;

export default function SiteNav() {
  return (
    <nav aria-label="Workbench" className="flex items-center gap-1">
      {NAV_ITEMS.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          title={item.hint}
          className="rounded-md px-3 py-2 text-sm text-[#9693A8] transition-colors hover:bg-[#191923] hover:text-[#F2F0F8] focus-visible:outline-2 focus-visible:outline-[#B68CFF]"
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
