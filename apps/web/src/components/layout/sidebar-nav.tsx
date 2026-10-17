"use client";

import { Gauge, ListOrdered, Waypoints, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/cn";

type NavItem = { href: string; label: string; icon: LucideIcon; match: (path: string) => boolean };

const NAV: NavItem[] = [
  {
    href: "/overview",
    label: "Overview",
    icon: ListOrdered,
    match: (path) => path.startsWith("/overview"),
  },
  {
    href: "/investigation",
    label: "Investigation",
    icon: Waypoints,
    match: (path) => path.startsWith("/investigation"),
  },
  {
    href: "/performance",
    label: "Performance",
    icon: Gauge,
    match: (path) => path.startsWith("/performance"),
  },
];

export function SidebarNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Primary" className="px-2 pb-2 md:px-3 md:pb-0">
      <ul className="flex gap-1 md:flex-col">
        {NAV.map((item) => {
          const active = item.match(pathname);
          const Icon = item.icon;
          return (
            <li key={item.href} className="flex-1 md:flex-none">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center justify-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors md:justify-start",
                  active
                    ? "bg-surface-elevated text-fg"
                    : "text-fg-secondary hover:bg-surface hover:text-fg",
                )}
              >
                <Icon
                  className={cn("size-4", active ? "text-accent" : "text-fg-muted")}
                  aria-hidden
                />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
