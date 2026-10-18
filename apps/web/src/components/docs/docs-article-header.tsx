"use client";

import { useState } from "react";
import { Bookmark, Share2, ThumbsUp, Clock, Calendar, Check, Sun, Moon } from "lucide-react";
import { cn } from "@/lib/cn";

interface DocsArticleHeaderProps {
  theme: "dark" | "light";
  onToggleTheme: () => void;
  claps: number;
  onClap: () => void;
}

export function DocsArticleHeader({ theme, onToggleTheme, claps, onClap }: DocsArticleHeaderProps) {
  const [bookmarked, setBookmarked] = useState(false);
  const [copied, setCopied] = useState(false);
  const [clapAnim, setClapAnim] = useState(false);

  const handleClap = () => {
    onClap();
    setClapAnim(true);
    setTimeout(() => setClapAnim(false), 600);
  };

  const handleShare = async () => {
    try {
      if (typeof window !== "undefined") {
        await navigator.clipboard.writeText(window.location.href);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      // Clipboard fallback
    }
  };

  return (
    <header className="border-b border-border-strong pb-8">
      {/* Publication badge */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-accent-soft px-3 py-1 font-mono text-2xs font-semibold tracking-wider text-accent uppercase">
          Architecture & Investigation Guide
        </span>
        <span className="rounded-full border border-border-strong px-2.5 py-0.5 text-2xs text-fg-muted">
          Updated for Iteration 2
        </span>
      </div>

      {/* Main Headline */}
      <h1 className="text-2xl font-bold tracking-tight text-fg sm:text-3xl md:text-4xl lg:text-[42px] lg:leading-[1.15]">
        Securing the Transaction Network: The ML Model, the Agent Pass, and the Graph
      </h1>

      {/* Editorial Subtitle */}
      <p className="mt-4 text-base leading-relaxed font-normal text-fg-secondary sm:text-lg">
        Start from the bank’s side of the counter. A machine learning model scores every transfer; a
        bounded LLM agent adds a second pass over flagged alerts; and every claim the agent makes
        has to be backed by graph evidence retrieved from FalkorDB.
      </p>

      {/* Author Byline & Meta */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-border-strong pt-6">
        <div className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-full bg-accent text-sm font-bold text-accent-ink shadow-sm">
            TA
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-fg">TraceAML Intelligence Team</span>
              <span className="text-3xs rounded bg-surface px-1.5 py-0.5 font-medium text-accent">
                Core
              </span>
            </div>
            <div className="flex items-center gap-3 text-xs text-fg-muted">
              <span className="flex items-center gap-1">
                <Calendar className="size-3" aria-hidden />
                October 2026
              </span>
              <span>·</span>
              <span className="flex items-center gap-1">
                <Clock className="size-3" aria-hidden />
                14 min read
              </span>
            </div>
          </div>
        </div>

        {/* Action Toolbar: Claps, Bookmark, Share, Light/Dark Switch */}
        <div className="flex items-center gap-2">
          {/* Light / Dark Mode Toggle Button */}
          <button
            type="button"
            onClick={onToggleTheme}
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            className="flex items-center gap-1.5 rounded-full border border-border-strong bg-surface px-3 py-1.5 text-xs font-medium text-fg transition-colors hover:border-fg-muted hover:bg-surface-elevated"
          >
            {theme === "dark" ? (
              <>
                <Sun className="size-3.5 text-warning" aria-hidden />
                <span className="hidden sm:inline">Light Mode</span>
              </>
            ) : (
              <>
                <Moon className="size-3.5 text-accent" aria-hidden />
                <span className="hidden sm:inline">Dark Mode</span>
              </>
            )}
          </button>

          {/* Medium-style Applause Button */}
          <button
            type="button"
            onClick={handleClap}
            title="Applaud this guide"
            aria-label="Applaud this guide"
            className={cn(
              "relative flex items-center gap-1.5 rounded-full border border-border-strong bg-surface px-3 py-1.5 text-xs font-medium text-fg transition-all hover:border-accent hover:text-accent",
              clapAnim && "scale-105 border-accent text-accent",
            )}
          >
            <ThumbsUp className="size-3.5" aria-hidden />
            <span className="font-mono">{claps}</span>
            {clapAnim && (
              <span className="absolute -top-6 left-1/2 -translate-x-1/2 animate-out font-mono text-2xs font-bold text-accent duration-500 fade-out slide-out-to-top">
                +1
              </span>
            )}
          </button>

          {/* Bookmark Button */}
          <button
            type="button"
            onClick={() => setBookmarked((b) => !b)}
            title={bookmarked ? "Bookmarked" : "Bookmark guide"}
            aria-label={bookmarked ? "Bookmarked" : "Bookmark guide"}
            className={cn(
              "flex size-8 items-center justify-center rounded-full border border-border-strong bg-surface text-fg transition-colors hover:border-fg-muted hover:bg-surface-elevated",
              bookmarked && "border-accent text-accent",
            )}
          >
            <Bookmark className="size-3.5" aria-hidden />
          </button>

          {/* Share Link Button */}
          <button
            type="button"
            onClick={handleShare}
            title="Share article link"
            aria-label="Share article link"
            className="flex size-8 items-center justify-center rounded-full border border-border-strong bg-surface text-fg transition-colors hover:border-fg-muted hover:bg-surface-elevated"
          >
            {copied ? (
              <Check className="size-3.5 text-safe" aria-hidden />
            ) : (
              <Share2 className="size-3.5" aria-hidden />
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
