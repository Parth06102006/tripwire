import type { ReactNode } from "react";

import { BrandLockup } from "@/components/landing/brand";
import { ServiceIndicator } from "@/components/layout/service-indicator";
import { SidebarNav } from "@/components/layout/sidebar-nav";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      <a
        href="#main"
        className="sr-only z-50 rounded-md bg-accent px-3 py-2 text-accent-ink focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Skip to content
      </a>
      <aside className="flex shrink-0 flex-col border-b border-border bg-sidebar md:sticky md:top-0 md:h-dvh md:w-56 md:border-r md:border-b-0">
        <div className="flex items-center justify-between gap-3 px-4 py-3 md:block md:px-5 md:pt-5 md:pb-6">
          <BrandLockup subtitle="Workbench" />
          <div className="md:hidden">
            <ServiceIndicator compact />
          </div>
        </div>
        <SidebarNav />
        <div className="mt-auto hidden px-5 pb-5 md:block">
          <ServiceIndicator compact />
          <p className="mt-3 text-2xs text-fg-muted">
            Synthetic IBM AMLworld replay. No real accounts, and no payment is ever blocked.
          </p>
        </div>
      </aside>
      <main id="main" className="min-w-0 flex-1">
        {children}
      </main>
    </div>
  );
}
