"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Reveals `[data-reveal]` descendants as they scroll into view.
 *
 * The hidden state is applied only after this component runs, so the page is
 * fully readable without JavaScript, and reduced-motion visitors skip the
 * observer entirely.
 */
export default function RevealScope({ children }: { children: ReactNode }) {
  const root = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const scope = root.current;
    if (!scope) return;
    const targets = Array.from(scope.querySelectorAll<HTMLElement>("[data-reveal]"));
    if (targets.length === 0) return;

    const showAll = () => {
      for (const target of targets) target.dataset.visible = "true";
    };

    if (
      typeof IntersectionObserver === "undefined" ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      showAll();
      return;
    }

    document.documentElement.dataset.revealScope = "on";
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          (entry.target as HTMLElement).dataset.visible = "true";
          observer.unobserve(entry.target);
        }
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.05 },
    );
    for (const target of targets) observer.observe(target);

    return () => {
      observer.disconnect();
      delete document.documentElement.dataset.revealScope;
    };
  }, []);

  return (
    <div ref={root} className="contents">
      {children}
    </div>
  );
}
