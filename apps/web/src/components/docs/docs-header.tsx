"use client";

import Link from "next/link";
import { BookOpen, ExternalLink, Sun, Moon } from "lucide-react";

interface DocsHeaderProps {
  progress: number;
  theme: "dark" | "light";
  onToggleTheme: () => void;
}

export function DocsHeader({ progress, theme, onToggleTheme }: DocsHeaderProps) {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-surface/90 backdrop-blur-md transition-colors">
      {/* Scroll Progress Bar */}
      <div
        className="absolute top-0 left-0 h-[3px] bg-accent transition-all duration-75 ease-out"
        style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
        role="progressbar"
        aria-valuenow={Math.round(progress)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Reading progress"
      />

      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
        {/* Brand / Publication Title */}
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="flex items-center gap-2 text-xs font-semibold tracking-wider text-fg uppercase transition-colors hover:text-accent"
          >
            <div className="flex size-6 items-center justify-center rounded bg-accent text-accent-ink">
              <BookOpen className="size-3.5" aria-hidden />
            </div>
            <span>TraceAML Docs</span>
          </Link>
          <span className="hidden text-fg-muted md:inline">/</span>
          <span className="hidden text-xs text-fg-secondary md:inline">
            Engineering & Detection Journal
          </span>
        </div>

        {/* Right Actions & Navigation */}
        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/overview"
            className="hidden items-center gap-1 rounded px-2.5 py-1 text-xs text-fg-secondary transition-colors hover:bg-surface-elevated hover:text-fg sm:flex"
          >
            <span>Workbench</span>
          </Link>

          <Link
            href="/investigation"
            className="hidden items-center gap-1 rounded px-2.5 py-1 text-xs text-fg-secondary transition-colors hover:bg-surface-elevated hover:text-fg md:flex"
          >
            <span>Investigation</span>
          </Link>

          <Link
            href="/performance"
            className="hidden items-center gap-1 rounded px-2.5 py-1 text-xs text-fg-secondary transition-colors hover:bg-surface-elevated hover:text-fg md:flex"
          >
            <span>Performance</span>
          </Link>

          {/* Theme Switcher Button */}
          <button
            type="button"
            onClick={onToggleTheme}
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            className="flex size-8 items-center justify-center rounded-full border border-border-strong text-fg transition-colors hover:border-fg-muted hover:bg-surface-elevated"
          >
            {theme === "dark" ? (
              <Sun className="size-4 text-warning" aria-hidden />
            ) : (
              <Moon className="size-4 text-accent" aria-hidden />
            )}
          </button>

          <Link
            href="/overview"
            className="flex items-center gap-1 rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-accent-ink shadow-sm transition-opacity hover:opacity-90"
          >
            <span>Launch App</span>
            <ExternalLink className="size-3" aria-hidden />
          </Link>
        </div>
      </div>
    </header>
  );
}
