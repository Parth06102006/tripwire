import type { ReactNode } from "react";

import { BrandLockup } from "@/components/landing/brand";
import { AccountMenu } from "@/components/layout/account-menu";
import { KeyboardShortcutsModal } from "@/components/layout/keyboard-shortcuts-modal";
import { SidebarNav } from "@/components/layout/sidebar-nav";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-dvh flex-col bg-[#090a0b] md:flex-row">
      {/* Subtle ambient obsidian glow */}
      <div
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_75%_50%_at_50%_-15%,rgba(242,140,56,0.06),transparent_65%)]"
        aria-hidden
      />

      <a
        href="#main"
        className="sr-only z-50 rounded-md bg-accent px-3 py-2 text-accent-ink focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Skip to content
      </a>
      {/* One shortcuts guide for the whole shell; the account menu and "?" open it. */}
      <KeyboardShortcutsModal showTrigger={false} />
      <aside className="relative z-10 flex shrink-0 flex-col border-b border-border bg-sidebar md:sticky md:top-0 md:h-dvh md:w-56 md:border-r md:border-b-0">
        <div className="flex items-center justify-between gap-3 px-4 py-3 md:block md:px-5 md:pt-5 md:pb-6">
          <BrandLockup subtitle="Workbench" />
          <div className="md:hidden">
            <AccountMenu compact />
          </div>
        </div>
        <SidebarNav />
        <div className="mt-auto hidden px-3 pb-4 md:block">
          <AccountMenu />
        </div>
      </aside>
      <main id="main" className="relative z-10 min-w-0 flex-1">
        {children}
      </main>
    </div>
  );
}
