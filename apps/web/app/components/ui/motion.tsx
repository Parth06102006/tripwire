"use client";

import { ChevronDown, X } from "lucide-react";
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { cx } from "./card";
import { IconButton } from "./controls";

/**
 * Motion patterns modelled on transitions.dev. They are CSS driven (transform,
 * opacity and grid-track animation) so there is no animation dependency.
 * prefers-reduced-motion collapses every duration in globals.css.
 */

/** Number pop-in: replays only when the value genuinely changes after mount. */
export function AnimatedValue({ value, className }: { value: string; className?: string }) {
  const previous = useRef(value);
  const [generation, setGeneration] = useState(0);
  useEffect(() => {
    if (previous.current !== value) {
      previous.current = value;
      setGeneration((count) => count + 1);
    }
  }, [value]);
  return (
    <span key={generation} className={cx(generation > 0 && "pop-in", "inline-block", className)}>
      {value}
    </span>
  );
}

interface SegmentedTabsProps<T extends string> {
  label: string;
  value: T;
  options: readonly { value: T; label: string; disabled?: boolean; hint?: string }[];
  onChange: (value: T) => void;
}

/** Sliding tabs: one indicator translates between equal-width segments. */
export function SegmentedTabs<T extends string>({
  label,
  value,
  options,
  onChange,
}: SegmentedTabsProps<T>) {
  const index = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    event.preventDefault();
    const step = event.key === "ArrowRight" ? 1 : -1;
    for (let offset = 1; offset <= options.length; offset += 1) {
      const next = (index + step * offset + options.length * offset) % options.length;
      if (!options[next].disabled) {
        onChange(options[next].value);
        refs.current[next]?.focus();
        return;
      }
    }
  };

  return (
    <div
      role="tablist"
      aria-label={label}
      onKeyDown={onKeyDown}
      className="relative grid rounded-control border border-line-strong bg-raised p-0.5"
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      <span
        aria-hidden="true"
        className="absolute inset-y-0.5 left-0.5 rounded-md bg-accent-soft ring-1 ring-accent/40 transition-transform duration-[var(--motion-standard)] ease-[var(--ease-out)]"
        style={{
          width: `calc((100% - 4px) / ${options.length})`,
          transform: `translateX(${index * 100}%)`,
        }}
      />
      {options.map((option, position) => (
        <button
          key={option.value}
          ref={(node) => {
            refs.current[position] = node;
          }}
          type="button"
          role="tab"
          aria-selected={option.value === value}
          tabIndex={option.value === value ? 0 : -1}
          disabled={option.disabled}
          title={option.hint}
          onClick={() => onChange(option.value)}
          className={cx(
            "relative z-10 px-3 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40",
            option.value === value ? "text-accent" : "text-dim hover:text-ink",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

interface SplitRevealProps {
  open: boolean;
  onClose: () => void;
  panelLabel: string;
  panel: ReactNode;
  children: ReactNode;
  width?: number;
  className?: string;
}

/**
 * Panel reveal. On wide screens the main content and a side panel share a grid
 * whose second track animates open, so the queue keeps its context. Below lg
 * the panel becomes a slide-over. Focus moves into the panel on open and returns
 * to the element that opened it on close; Escape closes.
 */
export function SplitReveal({
  open,
  onClose,
  panelLabel,
  panel,
  children,
  width = 400,
  className,
}: SplitRevealProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const opener = useRef<HTMLElement | null>(null);
  const wasOpen = useRef(false);

  useEffect(() => {
    if (open && !wasOpen.current) {
      opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      panelRef.current?.focus({ preventScroll: true });
    } else if (!open && wasOpen.current) {
      const target = opener.current;
      if (target && document.contains(target)) target.focus({ preventScroll: true });
      opener.current = null;
    }
    wasOpen.current = open;
  }, [open]);

  return (
    <div
      className={cx("reveal-x gap-0 lg:data-[open=true]:gap-4", className)}
      data-open={open}
      style={{ ["--panel-width" as string]: `${width}px` }}
    >
      <div className="min-w-0">{children}</div>
      <aside
        aria-label={panelLabel}
        inert={!open}
        className={cx(
          "reveal-x-panel",
          "max-lg:fixed max-lg:inset-y-0 max-lg:right-0 max-lg:z-40 max-lg:w-[min(92vw,420px)] max-lg:border-l max-lg:border-line max-lg:bg-card max-lg:p-4",
          "max-lg:transition-transform max-lg:duration-[var(--motion-panel)] max-lg:ease-[var(--ease-out)]",
          open ? "max-lg:translate-x-0" : "max-lg:translate-x-full",
        )}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.stopPropagation();
            onClose();
          }
        }}
      >
        <div
          ref={panelRef}
          tabIndex={-1}
          className="flex h-full max-h-[calc(100vh-8rem)] flex-col gap-3 overflow-y-auto rounded-card outline-none lg:border lg:border-line lg:bg-card lg:p-4"
        >
          <div className="flex justify-end lg:hidden">
            <IconButton label="Close details" onClick={onClose}>
              <X aria-hidden="true" className="h-4 w-4" />
            </IconButton>
          </div>
          {panel}
        </div>
      </aside>
    </div>
  );
}

/** Expandable region (card resize): the track animates between 0 and content height. */
export function Disclosure({
  title,
  children,
  defaultOpen = false,
  badge,
}: {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
  badge?: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  return (
    <div className="rounded-control border border-line">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-xs font-medium text-ink hover:bg-hover"
      >
        <span className="flex items-center gap-2">
          {title}
          {badge}
        </span>
        <ChevronDown
          aria-hidden="true"
          className={cx(
            "h-4 w-4 text-dim transition-transform duration-[var(--motion-standard)]",
            open && "rotate-180",
          )}
        />
      </button>
      <div id={id} className="reveal-y" data-open={open}>
        <div className="reveal-y-inner" inert={!open}>
          <div className="border-t border-line p-3">{children}</div>
        </div>
      </div>
    </div>
  );
}
