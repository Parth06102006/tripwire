"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import { BrandLockup } from "./brand";
import { CtaArrow, CtaLink } from "./cta";
import { DEMO_HREF, NAV_LINKS, REPO_URL, WORKBENCH_HREF } from "./links";

interface SiteHeaderProps {
  onRequestDemo?: () => void;
  onContact?: () => void;
}

/**
 * Landing navigation matching the baseline screenshot:
 * Crisp typography, brand lockup, section navigation, and distinct CTA buttons.
 */
export default function SiteHeader({ onRequestDemo, onContact }: SiteHeaderProps) {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 w-full transition-[background-color,border-color] duration-[var(--motion-standard)] ease-[var(--ease-out)]",
        scrolled || open
          ? "border-b border-line bg-[#0a0b0c]/94 backdrop-blur-xl"
          : "border-b border-transparent bg-[#0a0b0c]/60 backdrop-blur-md",
      )}
    >
      <div className="mx-auto flex h-16 w-full max-w-[1440px] items-center justify-between gap-6 px-4 sm:h-[72px] sm:px-8">
        <BrandLockup />

        <nav aria-label="Sections" className="hidden items-center gap-1 lg:flex">
          {NAV_LINKS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-full px-3.5 py-1.5 text-[13px] text-[#b0b3af] transition-colors duration-[var(--motion-fast)] hover:bg-white/[0.05] hover:text-white"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <Link
            href={WORKBENCH_HREF}
            className="mr-1 hidden items-center font-mono text-[12px] text-dim transition-colors hover:text-accent xl:inline-flex"
          >
            Live Workbench
          </Link>

          {onContact ? (
            <button
              type="button"
              onClick={onContact}
              className="hidden items-center justify-center rounded-full border border-line-strong bg-white/[0.02] px-4 py-2 text-[13px] font-medium text-ink transition-colors hover:border-white/30 hover:bg-white/[0.06] sm:inline-flex"
            >
              Contact us
            </button>
          ) : (
            <CtaLink
              href={REPO_URL}
              variant="secondary"
              size="sm"
              className="hidden sm:inline-flex"
            >
              Contact us
            </CtaLink>
          )}

          {onRequestDemo ? (
            <button
              type="button"
              onClick={onRequestDemo}
              className="hidden items-center justify-center gap-1.5 rounded-full bg-accent px-4 py-2 text-[13px] font-semibold text-accent-ink shadow-[0_12px_32px_-14px_rgba(242,140,56,0.85)] hover:brightness-110 sm:inline-flex"
            >
              Request a Demo
              <CtaArrow />
            </button>
          ) : (
            <CtaLink href={DEMO_HREF} variant="primary" size="sm" className="hidden sm:inline-flex">
              Request a Demo
              <CtaArrow />
            </CtaLink>
          )}

          <button
            type="button"
            aria-label={open ? "Close navigation" : "Open navigation"}
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-line-strong text-ink transition-colors hover:bg-white/[0.06] lg:hidden"
          >
            {open ? (
              <X aria-hidden="true" className="h-4 w-4" />
            ) : (
              <Menu aria-hidden="true" className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>

      <div className="reveal-y lg:hidden" data-open={open}>
        <div className="reveal-y-inner" inert={!open}>
          <div className="border-t border-line px-4 pt-4 pb-6 sm:px-7">
            <nav aria-label="Sections" className="flex flex-col">
              {NAV_LINKS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="border-b border-line py-3 text-sm text-dim transition-colors hover:text-ink"
                >
                  {item.label}
                </Link>
              ))}
              <Link
                href={WORKBENCH_HREF}
                onClick={() => setOpen(false)}
                className="border-b border-line py-3 text-sm text-accent transition-colors"
              >
                Launch Workbench
              </Link>
            </nav>
            <div className="mt-5 flex flex-col gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  if (onRequestDemo) onRequestDemo();
                }}
                className="flex items-center justify-center gap-1.5 rounded-full bg-accent py-2.5 text-sm font-semibold text-accent-ink"
              >
                Request a Demo
                <CtaArrow />
              </button>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  if (onContact) onContact();
                }}
                className="flex items-center justify-center rounded-full border border-line-strong py-2.5 text-sm font-medium text-ink"
              >
                Contact us
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
