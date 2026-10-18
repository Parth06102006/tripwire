"use client";

import { List } from "lucide-react";
import { cn } from "@/lib/cn";

export interface TocItem {
  id: string;
  title: string;
  level: number;
}

export const DOC_SECTIONS: TocItem[] = [
  { id: "introduction", title: "1. The Bank and the Money-Flow Network", level: 2 },
  { id: "ml-model", title: "2. Layer One: The Model That Scores the Stream", level: 2 },
  { id: "agent-pass", title: "3. Layer Two: The Agent Pass on Flagged Reviews", level: 2 },
  { id: "graph-foundation", title: "4. What the Agent Reads: The Graph", level: 2 },
  { id: "key-typologies", title: "5. The AML Patterns the Graph Exposes", level: 2 },
  { id: "end-to-end-architecture", title: "6. The Full Pipeline, End to End", level: 2 },
  { id: "analyst-workbench", title: "7. The Analyst Workbench Guide", level: 2 },
  { id: "glossary", title: "8. Technical Glossary & Key Terms", level: 2 },
  { id: "further-reading", title: "9. Further Reading: Field Notes", level: 2 },
];

export function DocsToc({ activeId }: { activeId?: string }) {
  const currentId = activeId ?? DOC_SECTIONS[0]?.id ?? "introduction";

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      const topOffset = 80;
      const elementPosition = el.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - topOffset;
      window.scrollTo({
        top: offsetPosition,
        behavior: "smooth",
      });
    }
  };

  return (
    <aside
      aria-label="Table of contents"
      className="sticky top-20 hidden h-[calc(100vh-6rem)] w-64 overflow-y-auto pr-4 xl:block"
    >
      <div className="flex items-center gap-2 pb-3 font-mono text-2xs font-semibold tracking-wider text-fg-muted uppercase">
        <List className="size-3.5" aria-hidden />
        <span>Contents</span>
      </div>
      <nav className="space-y-1 text-xs">
        {DOC_SECTIONS.map((section) => {
          const isActive = currentId === section.id;
          return (
            <button
              key={section.id}
              type="button"
              onClick={() => scrollToSection(section.id)}
              className={cn(
                "block w-full rounded-md py-1.5 pr-2 pl-3 text-left transition-colors",
                isActive
                  ? "border-l-2 border-accent bg-accent-soft/30 font-medium text-fg"
                  : "border-l-2 border-transparent text-fg-muted hover:bg-surface-elevated/50 hover:text-fg",
              )}
            >
              <span className="line-clamp-1">{section.title}</span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
