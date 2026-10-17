import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

export function PageHeader({
  title,
  description,
  children,
  compact = false,
}: {
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  /** Tighter padding, for screens that must fit one viewport. */
  compact?: boolean;
}) {
  return (
    <header
      className={cn(
        "flex flex-wrap items-end justify-between gap-x-6 gap-y-3 px-4 md:px-8",
        compact ? "pt-4 pb-3 md:pt-5" : "pt-6 pb-5 md:pt-8",
      )}
    >
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight text-fg">{title}</h1>
        {description ? (
          <p className="mt-1 max-w-[68ch] text-sm text-fg-secondary">{description}</p>
        ) : null}
      </div>
      {children}
    </header>
  );
}
