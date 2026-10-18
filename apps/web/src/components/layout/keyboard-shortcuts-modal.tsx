"use client";

import { Command, Keyboard } from "lucide-react";
import { useEffect, useState } from "react";

import { Dialog, DialogContent } from "@/components/ui/dialog";

interface ShortcutGroup {
  category: string;
  items: { key: string; description: string }[];
}

const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    category: "Navigation",
    items: [
      { key: "/", description: "Focus transaction ID search" },
      { key: "Esc", description: "Close active drawer, modal, or selection" },
      { key: "?", description: "Toggle this keyboard shortcuts guide" },
    ],
  },
  {
    category: "Investigation Workstation",
    items: [
      { key: "Click Node", description: "Inspect counterparty account or transfer node" },
      { key: "Click Edge", description: "Display directed transaction transfer amount" },
      { key: "Drag Node", description: "Rearrange subgraph layout dynamically" },
    ],
  },
  {
    category: "Triage Queue",
    items: [
      { key: "Inspect (Eye)", description: "Open slide-over alert dossier without leaving queue" },
      { key: "Click Row", description: "Open full graph investigation in new view" },
    ],
  },
];

/** Dispatch this on `window` to open the guide from anywhere, such as the account menu. */
export const OPEN_SHORTCUTS_EVENT = "tripwire:open-shortcuts";

/**
 * The shortcuts guide. Mount it once: it listens for `?` and `/`, and for
 * OPEN_SHORTCUTS_EVENT. `showTrigger={false}` leaves out its own button.
 */
export function KeyboardShortcutsModal({ showTrigger = true }: { showTrigger?: boolean } = {}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't trigger shortcuts when typing inside form inputs
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }

      if (event.key === "?" && !event.ctrlKey && !event.metaKey) {
        event.preventDefault();
        setOpen((prev) => !prev);
      } else if (event.key === "/" && !event.ctrlKey && !event.metaKey) {
        const searchInput = document.querySelector<HTMLInputElement>(
          'input[type="search"], input[placeholder*="transaction ID"], input[placeholder*="Transaction ID"]',
        );
        if (searchInput) {
          event.preventDefault();
          searchInput.focus();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    const openFromElsewhere = () => setOpen(true);
    window.addEventListener(OPEN_SHORTCUTS_EVENT, openFromElsewhere);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener(OPEN_SHORTCUTS_EVENT, openFromElsewhere);
    };
  }, []);

  return (
    <>
      {showTrigger ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1.5 text-2xs text-fg-muted transition-colors hover:text-fg"
          title="Keyboard shortcuts (?)"
        >
          <Keyboard className="size-3" aria-hidden />
          <span>Shortcuts</span>
        </button>
      ) : null}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          title={
            <span className="flex items-center gap-2">
              <Command className="size-4 text-accent" aria-hidden />
              <span>Analyst Keyboard Shortcuts</span>
            </span>
          }
          description="Accelerate your alert triage and graph investigation workflow."
          className="max-w-lg"
        >
          <div className="space-y-4 pt-1">
            {SHORTCUT_GROUPS.map((group) => (
              <div key={group.category} className="space-y-2">
                <h4 className="text-2xs font-semibold tracking-wider text-fg-muted uppercase">
                  {group.category}
                </h4>
                <div className="rounded-md border border-border bg-surface-sunken">
                  {group.items.map((item, idx) => (
                    <div
                      key={item.key}
                      className={
                        idx === 0
                          ? "flex items-center justify-between px-3 py-2 text-xs"
                          : "flex items-center justify-between border-t border-border/50 px-3 py-2 text-xs"
                      }
                    >
                      <span className="text-fg-secondary">{item.description}</span>
                      <kbd className="rounded border border-border-strong bg-surface-elevated px-2 py-0.5 font-mono text-2xs font-semibold text-fg shadow-sm">
                        {item.key}
                      </kbd>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
