"use client";

import { useQuery } from "@tanstack/react-query";
import { Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { healthQuery } from "../../lib/api";
import { ServiceBadge, type ServiceState } from "../ui/badge";
import { cx } from "../ui/card";
import { IconButton } from "../ui/controls";
import { NAV_ITEMS, isActive } from "./nav";

function SidebarNav({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <nav aria-label="Primary" className="flex flex-col gap-1">
      {NAV_ITEMS.map((item) => {
        const active = isActive(pathname, item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            title={item.hint}
            className={cx(
              "selectable relative flex items-center gap-3 rounded-control px-3 py-2 text-sm",
              active ? "bg-raised text-ink" : "text-dim hover:bg-hover hover:text-ink",
            )}
          >
            <span
              aria-hidden="true"
              className={cx(
                "absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-accent transition-opacity duration-[var(--motion-fast)]",
                active ? "opacity-100" : "opacity-0",
              )}
            />
            <Icon aria-hidden="true" className={cx("h-4 w-4", active && "text-accent")} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function Brand() {
  return (
    <Link href="/" className="flex items-center gap-3 rounded-control px-3 py-2">
      <span
        aria-hidden="true"
        className="flex h-7 w-7 items-center justify-center rounded-md bg-accent text-sm font-bold text-accent-ink"
      >
        T
      </span>
      <span className="flex flex-col leading-tight">
        <span className="text-sm font-semibold tracking-wide">TraceAML</span>
        <span className="text-[11px] text-dim">Obsidian Graph Console</span>
      </span>
    </Link>
  );
}

function EnvironmentStatus() {
  const health = useQuery({ ...healthQuery, refetchInterval: 60_000 });
  const state: ServiceState = health.isPending ? "checking" : health.isError ? "failed" : "healthy";
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-dim">
      <span className="hidden sm:inline">Synthetic AMLworld replay · offline evaluation</span>
      <span className="font-mono">
        {health.data ? `API v${health.data.version}` : health.isError ? "API unreachable" : "API"}
      </span>
      <ServiceBadge state={state} />
    </div>
  );
}

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const current = NAV_ITEMS.find((item) => isActive(pathname, item.href));

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  return (
    <div className="flex min-h-screen">
      <a
        href="#content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-control focus:bg-accent focus:px-3 focus:py-2 focus:text-accent-ink"
      >
        Skip to content
      </a>

      <aside className="sticky top-0 hidden h-screen w-56 shrink-0 flex-col gap-6 border-r border-line bg-canvas p-3 lg:flex">
        <Brand />
        <SidebarNav pathname={pathname} />
      </aside>

      {menuOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            className="absolute inset-0 bg-canvas/70"
            onClick={() => setMenuOpen(false)}
          />
          <aside className="slide-in absolute inset-y-0 left-0 flex w-64 flex-col gap-6 border-r border-line bg-canvas p-3">
            <div className="flex items-center justify-between">
              <Brand />
              <IconButton label="Close navigation" onClick={() => setMenuOpen(false)}>
                <X aria-hidden="true" className="h-4 w-4" />
              </IconButton>
            </div>
            <SidebarNav pathname={pathname} onNavigate={() => setMenuOpen(false)} />
          </aside>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-line bg-canvas/90 px-4 py-3 backdrop-blur sm:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <IconButton
              label="Open navigation"
              className="lg:hidden"
              onClick={() => setMenuOpen(true)}
              aria-expanded={menuOpen}
            >
              <Menu aria-hidden="true" className="h-4 w-4" />
            </IconButton>
            <p className="truncate text-sm text-dim">
              <span className="text-ink">TraceAML</span>
              <span aria-hidden="true"> / </span>
              {current?.label ?? "Workbench"}
            </p>
          </div>
          <EnvironmentStatus />
        </div>
        <main id="content" tabIndex={-1} className="fade-up mx-auto flex w-full max-w-[1500px] flex-1 flex-col gap-6 p-4 outline-none sm:p-6">
          {children}
        </main>
        <footer className="border-t border-line px-4 py-3 text-xs text-dim sm:px-6">
          Synthetic IBM AMLworld HI-Small data. This replay is not connected to a live bank feed. Displayed records and metrics come from the API.
        </footer>
      </div>
    </div>
  );
}
