"use client";

import { Check, Copy, Info, AlertTriangle, ShieldCheck, Sparkles } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/cn";

interface DocsCodeBlockProps {
  code: string;
  language?: string;
  filename?: string;
  className?: string;
}

export function DocsCodeBlock({
  code,
  language = "cypher",
  filename,
  className,
}: DocsCodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code.trim());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard fallback
    }
  };

  return (
    <div
      className={cn(
        "my-6 overflow-hidden rounded-lg border border-border-strong bg-surface-sunken font-mono text-xs shadow-sm",
        className,
      )}
    >
      <div className="flex items-center justify-between border-b border-border-strong bg-surface px-4 py-2 text-2xs text-fg-muted">
        <span className="font-medium text-fg-secondary">
          {filename ?? (language ? `${language.toUpperCase()} QUERY` : "SNIPPET")}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1.5 rounded px-2 py-1 transition-colors hover:bg-surface-elevated hover:text-fg"
          aria-label="Copy code to clipboard"
        >
          {copied ? (
            <>
              <Check className="size-3 text-safe" aria-hidden />
              <span className="text-safe">Copied</span>
            </>
          ) : (
            <>
              <Copy className="size-3" aria-hidden />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <div className="overflow-x-auto p-4 leading-relaxed text-fg">
        <pre className="selection:bg-accent-soft selection:text-fg">
          <code>{code.trim()}</code>
        </pre>
      </div>
    </div>
  );
}

interface DocsCalloutProps {
  type?: "info" | "warning" | "invariant" | "tip";
  title?: string;
  children: React.ReactNode;
}

export function DocsCallout({ type = "info", title, children }: DocsCalloutProps) {
  const config = {
    info: {
      border: "border-accent",
      bg: "bg-accent-soft/40",
      icon: Info,
      iconColor: "text-accent",
      defaultTitle: "Analyst Note",
    },
    warning: {
      border: "border-warning",
      bg: "bg-warning/10",
      icon: AlertTriangle,
      iconColor: "text-warning",
      defaultTitle: "Operational Consideration",
    },
    invariant: {
      border: "border-critical",
      bg: "bg-critical/10",
      icon: ShieldCheck,
      iconColor: "text-critical",
      defaultTitle: "Architectural Invariant",
    },
    tip: {
      border: "border-safe",
      bg: "bg-safe/10",
      icon: Sparkles,
      iconColor: "text-safe",
      defaultTitle: "Pro Tip",
    },
  }[type];

  const Icon = config.icon;

  return (
    <div
      role="note"
      className={cn(
        "my-6 rounded-r-lg border-l-4 p-4 text-xs transition-colors sm:p-5 sm:text-sm",
        config.border,
        config.bg,
      )}
    >
      <div className="mb-2 flex items-center gap-2 font-semibold text-fg">
        <Icon className={cn("size-4 shrink-0", config.iconColor)} aria-hidden />
        <span>{title ?? config.defaultTitle}</span>
      </div>
      <div className="leading-relaxed text-fg-secondary">{children}</div>
    </div>
  );
}
