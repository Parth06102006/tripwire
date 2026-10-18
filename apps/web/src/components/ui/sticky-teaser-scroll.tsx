"use client";

import {
  AnimatePresence,
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
  type Transition,
} from "motion/react";
import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import {
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
  type RefObject,
} from "react";

import { cn } from "@/lib/cn";

import { TeaserProgress } from "./teaser-progress";

/**
 * StickyTeaserScroll
 *
 * A split-screen section. Text teasers scroll normally on one side while one
 * panel stays pinned on the other and swaps to the panel of the teaser that is
 * currently active. A panel is either a static `image` or a `visual`, any node
 * such as the interactive stages the landing page passes in "How it works".
 *
 * Everything is derived from `items`: add or remove an item and nothing else
 * needs touching, because the active teaser comes from an IntersectionObserver
 * on the teasers themselves (no offsets, no per-item animation values).
 *
 * Tweaking (see also the note in apps/web/README.md):
 *  - Timing and easing: `SWAP_DURATION` and `EASE` below.
 *  - Where a teaser becomes active: the `activeOffset` prop (0 is the top of
 *    the viewport, 0.5 the middle, 1 the bottom).
 *  - Image shape: the `aspectClassName` prop, any Tailwind `aspect-*` class;
 *    `mobileAspectClassName` does the same for the frame below 992px.
 *  - Height pinned under a fixed header: the `stickyTop` prop, in pixels.
 *
 * Below 992px the pinning is turned off: each teaser stacks with its own panel
 * above its text and fades in as it enters. A panel is rendered twice, once per
 * breakpoint, and `display: none` keeps the hidden one out of the tab order.
 *
 * Layout comes from CSS (`min-[992px]:` variants) so the first paint is right
 * and nothing shifts. JavaScript only decides which teaser is active.
 */

export type StickyTeaserItem = {
  id: string;
  eyebrow?: string;
  title: string;
  description: string;
  href?: string;
  /** Link text for this item; falls back to the component's `linkLabel`. */
  linkLabel?: string;
  /** Static image, used when the item has no `visual`. */
  image?: { src: string; alt: string };
  /**
   * Custom panel content instead of an image. Takes precedence over `image`
   * and is used both in the pinned panel and above the text below 992px.
   */
  visual?: ReactNode;
};

export type StickyTeaserScrollProps = {
  items: readonly StickyTeaserItem[];
  /** Which side the pinned image sits on. */
  imageSide?: "left" | "right";
  /** Viewport fraction, 0 to 1, where a teaser becomes active. Default 0.5. */
  activeOffset?: number;
  /** Map scroll progress straight to image opacity and scale instead of swapping on the active index. */
  scrubbed?: boolean;
  /** Pixels to leave above the pinned panel, for a fixed header. */
  stickyTop?: number;
  /** Aspect ratio of the pinned panel. */
  aspectClassName?: string;
  /** Aspect ratio of the frame above the text below 992px. */
  mobileAspectClassName?: string;
  /** Default link text for items that have an `href`. */
  linkLabel?: string;
  className?: string;
};

/** Duration of an image swap, in seconds. */
const SWAP_DURATION = 0.65;
const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];
const DESKTOP_QUERY = "(min-width: 992px)";

// ---- Breakpoint -------------------------------------------------------------

function subscribeDesktop(onChange: () => void): () => void {
  const query = window.matchMedia(DESKTOP_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/** `null` until the browser has answered, so server and first client render agree. */
function useIsDesktop(): boolean | null {
  return useSyncExternalStore<boolean | null>(
    subscribeDesktop,
    () => window.matchMedia(DESKTOP_QUERY).matches,
    () => null,
  );
}

// ---- Panel layers -----------------------------------------------------------

/**
 * Index-based swap: the incoming panel fades and scales in, the outgoing one
 * fades and shrinks. Images fill their frame; a `visual` keeps its own layout.
 */
function SwapLayer({
  item,
  reduced,
  target,
}: {
  item: StickyTeaserItem;
  reduced: boolean;
  /** The item's teaser, whose scroll progress the panel can play to. */
  target: RefObject<HTMLElement | null>;
}) {
  const transition: Transition = reduced
    ? { duration: 0 }
    : { duration: SWAP_DURATION, ease: EASE };
  const motionProps = {
    initial: { opacity: 0, scale: reduced ? 1 : 1.1 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: reduced ? 1 : 0.95 },
    transition,
    // will-change lives only on the layers that animate, and they unmount after the swap.
    style: { willChange: "transform, opacity" },
    className: "absolute inset-0 size-full",
  };
  if (item.visual) {
    return (
      <motion.div {...motionProps}>
        <TeaserProgress target={target}>{item.visual}</TeaserProgress>
      </motion.div>
    );
  }
  if (!item.image) return null;
  return (
    <motion.img
      src={item.image.src}
      alt={item.image.alt}
      decoding="async"
      draggable={false}
      {...motionProps}
      className={cn(motionProps.className, "object-cover")}
    />
  );
}

/**
 * Scroll-linked layer: opacity and scale follow this teaser's own scroll
 * progress. Progress runs 0 to 1 while the teaser crosses the viewport and is
 * 0.5 when it is centred, so neighbouring teasers always cross-fade to a sum of
 * one. The first panel holds until its teaser is centred, and the last holds after.
 */
function ScrubbedLayer({
  item,
  index,
  count,
  target,
  active,
}: {
  item: StickyTeaserItem;
  index: number;
  count: number;
  target: RefObject<HTMLElement | null>;
  active: boolean;
}) {
  const { scrollYProgress } = useScroll({ target, offset: ["start end", "end start"] });
  const first = index === 0;
  const last = index === count - 1;
  const opacity = useTransform(scrollYProgress, [0, 0.5, 1], [first ? 1 : 0, 1, last ? 1 : 0]);
  const scale = useTransform(scrollYProgress, [0, 0.5, 1], [first ? 1 : 1.1, 1, last ? 1 : 0.95]);
  const style = { opacity, scale, willChange: "transform, opacity" };
  if (item.visual) {
    return (
      <motion.div aria-hidden={!active} style={style} className="absolute inset-0 size-full">
        <TeaserProgress target={target}>{item.visual}</TeaserProgress>
      </motion.div>
    );
  }
  if (!item.image) return null;
  return (
    <motion.img
      src={item.image.src}
      alt={item.image.alt}
      aria-hidden={!active}
      decoding="async"
      draggable={false}
      style={style}
      className="absolute inset-0 size-full object-cover"
    />
  );
}

// ---- Component --------------------------------------------------------------

export function StickyTeaserScroll({
  items,
  imageSide = "right",
  activeOffset = 0.5,
  scrubbed = false,
  stickyTop = 0,
  aspectClassName = "aspect-[4/5]",
  mobileAspectClassName = "aspect-[4/3]",
  linkLabel = "View project",
  className,
}: StickyTeaserScrollProps) {
  const isDesktop = useIsDesktop();
  const reduced = useReducedMotion() ?? false;
  const [active, setActive] = useState(0);
  const count = items.length;

  // One stable ref per teaser; the observer and the scrubbed layers both read them.
  const teaserRefs = useMemo(
    () =>
      Array.from({ length: count }, () => ({ current: null }) as { current: HTMLElement | null }),
    [count],
  );

  // Active teaser: whichever one crosses the line at `activeOffset`. The
  // observer's root is collapsed to that line with rootMargin, so the browser
  // reports crossings and nothing reads layout while scrolling.
  useEffect(() => {
    if (isDesktop !== true || count === 0) return;
    const offset = Math.min(1, Math.max(0, activeOffset));
    const crossing = new Set<number>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const index = Number((entry.target as HTMLElement).dataset.index);
          if (entry.isIntersecting) crossing.add(index);
          else crossing.delete(index);
        }
        // At the instant two teasers meet, the one entering wins.
        if (crossing.size > 0) setActive(Math.max(...crossing));
      },
      { rootMargin: `${-offset * 100}% 0px ${-(1 - offset) * 100}% 0px`, threshold: 0 },
    );
    for (const ref of teaserRefs) if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [isDesktop, activeOffset, count, teaserRefs]);

  // Decode every image up front, so a swap never shows an unpainted frame.
  useEffect(() => {
    if (isDesktop !== true) return;
    const held = items.flatMap((item) => {
      if (!item.image) return [];
      const image = new Image();
      image.decoding = "async";
      image.src = item.image.src;
      image.decode().catch(() => undefined);
      return [image];
    });
    return () => {
      held.length = 0;
    };
  }, [isDesktop, items]);

  if (count === 0) return null;
  const safeActive = Math.min(active, count - 1);
  const current = items[safeActive];
  const fadeIn = isDesktop === false && !reduced;
  const scrub = scrubbed && !reduced;
  const imageColumn = imageSide === "right" ? "min-[992px]:col-start-2" : "min-[992px]:col-start-1";
  const textColumn = imageSide === "right" ? "min-[992px]:col-start-1" : "min-[992px]:col-start-2";

  return (
    <div
      className={cn(
        "mx-auto grid w-full max-w-[1260px] grid-cols-1 px-5 min-[992px]:grid-cols-2 min-[992px]:gap-x-20 sm:px-8",
        className,
      )}
      style={{ ["--sticky-top" as string]: `${stickyTop}px` }}
    >
      {/* Teasers: normal scroll. */}
      <div className={cn("min-w-0 min-[992px]:row-start-1", textColumn)}>
        {items.map((item, index) => {
          const isActive = index === safeActive;
          const external = item.href?.startsWith("http") ?? false;
          return (
            <motion.article
              key={item.id}
              ref={teaserRefs[index]}
              data-index={index}
              data-active={isActive}
              // Keyboard focus anywhere inside a teaser activates its image.
              onFocusCapture={() => setActive(index)}
              tabIndex={item.href ? undefined : 0}
              initial={fadeIn ? { opacity: 0, y: 24 } : false}
              whileInView={fadeIn ? { opacity: 1, y: 0 } : undefined}
              viewport={{ once: true, margin: "0px 0px -10% 0px" }}
              transition={{ duration: 0.6, ease: EASE }}
              className={cn(
                "group flex flex-col justify-center rounded-xl py-12 outline-none focus-visible:ring-2 focus-visible:ring-accent/60 min-[992px]:min-h-screen min-[992px]:py-24",
                "motion-reduce:transition-none min-[992px]:transition-opacity min-[992px]:duration-500 min-[992px]:data-[active=false]:opacity-35",
              )}
            >
              {/* Below 992px each teaser carries its own panel; the pinned panel is hidden. */}
              <div
                className={cn(
                  "mb-7 w-full overflow-hidden rounded-2xl bg-surface-sunken min-[992px]:hidden",
                  mobileAspectClassName,
                )}
              >
                {item.visual ? (
                  <div className="size-full">
                    <TeaserProgress target={teaserRefs[index] as RefObject<HTMLElement | null>}>
                      {item.visual}
                    </TeaserProgress>
                  </div>
                ) : item.image ? (
                  /* eslint-disable-next-line @next/next/no-img-element -- remote or static, sized by its frame */
                  <img
                    src={item.image.src}
                    alt={item.image.alt}
                    loading={index === 0 ? "eager" : "lazy"}
                    decoding="async"
                    className="size-full object-cover"
                  />
                ) : null}
              </div>

              {item.eyebrow ? (
                <p className="font-mono text-[11px] tracking-[0.22em] text-accent uppercase">
                  {item.eyebrow}
                </p>
              ) : null}
              <h3
                className={cn(
                  "mt-3 text-[clamp(1.7rem,3vw,2.6rem)] leading-[1.08] font-semibold tracking-[-0.03em] text-ink",
                  "motion-reduce:transition-none min-[992px]:transition-transform min-[992px]:duration-500 min-[992px]:ease-[cubic-bezier(0.22,1,0.36,1)] min-[992px]:group-data-[active=false]:translate-y-2",
                )}
              >
                {item.title}
              </h3>
              <p className="mt-4 max-w-[46ch] text-[15px] leading-7 text-dim">{item.description}</p>
              {item.href ? (
                <Link
                  href={item.href}
                  {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                  className="mt-6 inline-flex w-fit items-center gap-1.5 rounded-sm text-[14px] font-medium text-accent underline decoration-accent/40 underline-offset-4 transition-colors hover:decoration-accent focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
                >
                  {item.linkLabel ?? linkLabel}
                  <ArrowUpRight aria-hidden="true" className="size-4" />
                </Link>
              ) : null}
            </motion.article>
          );
        })}
      </div>

      {/* Pinned panel: desktop only; each panel is an image or a visual node. */}
      <div
        className={cn(
          "hidden min-w-0 self-start min-[992px]:row-start-1 min-[992px]:flex",
          "min-[992px]:sticky min-[992px]:top-[var(--sticky-top)] min-[992px]:h-[calc(100vh_-_var(--sticky-top))]",
          "items-center justify-center gap-5",
          imageColumn,
          imageSide === "left" && "flex-row-reverse",
        )}
      >
        {/* Thin vertical progress track, filled to the active teaser. */}
        <div
          aria-hidden="true"
          className="relative h-[min(60vh,32rem)] w-px shrink-0 overflow-hidden bg-line-strong"
        >
          <motion.span
            className="absolute inset-x-0 top-0 h-full origin-top bg-accent"
            initial={false}
            animate={{ scaleY: (safeActive + 1) / count }}
            transition={reduced ? { duration: 0 } : { duration: SWAP_DURATION, ease: EASE }}
          />
        </div>

        <div className="w-full max-w-[min(34rem,calc((100vh_-_var(--sticky-top)_-_8rem)_*_0.8))]">
          <div
            className={cn(
              "relative w-full overflow-hidden rounded-2xl bg-surface-sunken ring-1 ring-white/10",
              aspectClassName,
            )}
          >
            {scrub ? (
              items.map((item, index) => (
                <ScrubbedLayer
                  key={item.id}
                  item={item}
                  index={index}
                  count={count}
                  target={teaserRefs[index] as RefObject<HTMLElement | null>}
                  active={index === safeActive}
                />
              ))
            ) : (
              <AnimatePresence initial={false}>
                {current ? (
                  <SwapLayer
                    key={current.id}
                    item={current}
                    reduced={reduced}
                    target={teaserRefs[safeActive] as RefObject<HTMLElement | null>}
                  />
                ) : null}
              </AnimatePresence>
            )}
          </div>
          <p
            aria-hidden="true"
            className="mt-4 font-mono text-[12px] tracking-[0.18em] text-dim tabular-nums"
          >
            {String(safeActive + 1).padStart(2, "0")} / {String(count).padStart(2, "0")}
          </p>
        </div>
      </div>
    </div>
  );
}
