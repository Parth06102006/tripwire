import {
  Activity,
  BellRing,
  ChartColumn,
  FolderOpen,
  LayoutDashboard,
  Network,
} from "lucide-react";

export interface NavItem {
  href: "/" | "/simulation" | "/cases" | "/alerts" | "/benchmarks" | "/system";
  label: string;
  hint: string;
  icon: typeof Activity;
}

export const NAV_ITEMS: readonly NavItem[] = [
  { href: "/", label: "Overview", hint: "Command centre", icon: LayoutDashboard },
  { href: "/simulation", label: "Simulation", hint: "Graph workspace", icon: Network },
  { href: "/cases", label: "Cases", hint: "Investigation records", icon: FolderOpen },
  { href: "/alerts", label: "Alerts", hint: "Triage queue", icon: BellRing },
  { href: "/benchmarks", label: "Benchmarks", hint: "Performance lab", icon: ChartColumn },
  { href: "/system", label: "System", hint: "Health and diagnostics", icon: Activity },
] as const;

export function isActive(pathname: string, href: NavItem["href"]): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}
