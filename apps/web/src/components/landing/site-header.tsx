"use client";

import { LogOut, Menu, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import { BrandLockup } from "./brand";
import { CtaArrow, CtaLink } from "./cta";
import { signOutAndLeave } from "@/lib/auth/sign-out";
import { useAuthStatus } from "@/lib/auth/use-auth-status";
import { DEMO_HREF, NAV_LINKS, SIGN_IN_HREF, SIGN_UP_HREF } from "./links";

interface SiteHeaderProps {
  onRequestDemo?: () => void;
}

/**
 * Landing navigation matching the baseline screenshot:
 * Crisp typography, brand lockup, section navigation, and distinct CTA buttons.
 */
export default function SiteHeader({ onRequestDemo }: SiteHeaderProps) {
  const [open, setOpen] = useState(false);
  // Signed out: Sign in and Sign up. Signed in: Sign out. Sign-in off: neither.
  const status = useAuthStatus();
  const canEnter = status !== "signed-out";
  const signedIn = status === "signed-in";
  const [leaving, setLeaving] = useState(false);
  const signOut = async () => {
    setLeaving(true);
    // Back to the landing page, now signed out.
    await signOutAndLeave("/");
  };
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
          ? "border-b border-line bg-canvas/94 backdrop-blur-xl"
          : "border-b border-transparent bg-canvas/60 backdrop-blur-md",
      )}
    >
      <div className="mx-auto flex h-16 w-full max-w-[1440px] items-center justify-between gap-6 px-4 sm:h-[72px] sm:px-8">
        <BrandLockup />

        <nav aria-label="Sections" className="hidden items-center gap-1 lg:flex">
          {NAV_LINKS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-full px-3.5 py-1.5 text-[13px] text-ink-soft transition-colors duration-[var(--motion-fast)] hover:bg-hover hover:text-ink"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          {canEnter ? (
            <>
              {signedIn ? (
                <button
                  type="button"
                  onClick={signOut}
                  disabled={leaving}
                  className="hidden items-center gap-1.5 rounded-full px-3 py-2 text-[13px] font-medium text-ink-soft transition-colors hover:text-ink disabled:opacity-50 sm:inline-flex"
                >
                  <LogOut aria-hidden="true" className="size-3.5" />
                  Sign out
                </button>
              ) : null}
            </>
          ) : (
            <>
              <Link
                href={SIGN_IN_HREF}
                className="hidden items-center rounded-full px-3 py-2 text-[13px] font-medium text-ink-soft transition-colors hover:text-ink sm:inline-flex"
              >
                Sign in
              </Link>
              <CtaLink
                href={SIGN_UP_HREF}
                variant="secondary"
                size="sm"
                className="hidden sm:inline-flex"
              >
                Sign up
              </CtaLink>
            </>
          )}

          {onRequestDemo ? (
            <button
              type="button"
              onClick={onRequestDemo}
              className="hidden items-center justify-center gap-1.5 rounded-full bg-accent px-4 py-2 text-[13px] font-semibold text-accent-ink shadow-[0_12px_32px_-14px_rgba(242,140,56,0.85)] hover:brightness-110 sm:inline-flex"
            >
              Request a demo
              <CtaArrow />
            </button>
          ) : (
            <CtaLink href={DEMO_HREF} variant="primary" size="sm" className="hidden sm:inline-flex">
              Request a demo
              <CtaArrow />
            </CtaLink>
          )}

          <button
            type="button"
            aria-label={open ? "Close navigation" : "Open navigation"}
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-line-strong text-ink transition-colors hover:bg-hover lg:hidden"
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
              {canEnter ? null : (
                <Link
                  href={SIGN_IN_HREF}
                  onClick={() => setOpen(false)}
                  className="border-b border-line py-3 text-sm text-ink transition-colors hover:text-accent"
                >
                  Sign in
                </Link>
              )}
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
                Request a demo
                <CtaArrow />
              </button>
              {canEnter ? (
                signedIn ? (
                  <button
                    type="button"
                    onClick={signOut}
                    disabled={leaving}
                    className="flex items-center justify-center gap-1.5 rounded-full border border-line-strong py-2.5 text-sm font-medium text-ink disabled:opacity-50"
                  >
                    <LogOut aria-hidden="true" className="size-4" />
                    Sign out
                  </button>
                ) : null
              ) : (
                <Link
                  href={SIGN_UP_HREF}
                  onClick={() => setOpen(false)}
                  className="flex items-center justify-center rounded-full border border-line-strong py-2.5 text-sm font-medium text-ink"
                >
                  Sign up
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
