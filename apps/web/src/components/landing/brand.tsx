import Link from "next/link";
import { cn } from "@/lib/cn";

/**
 * Brand mark: a faceted diamond wireframe whose vertices are account nodes.
 * Drawn as a single inline SVG so it stays crisp at every size and inherits
 * the accent colour from the surrounding text colour.
 */
export function BrandGlyph({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      aria-hidden="true"
      className={cn("text-accent", className)}
      fill="none"
    >
      <path d="M16 2.6 29.4 16 16 29.4 2.6 16 16 2.6Z" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M16 10.4 21.6 16 16 21.6 10.4 16 16 10.4Z"
        stroke="currentColor"
        strokeOpacity="0.55"
        strokeWidth="1.1"
      />
      <path
        d="M16 2.6v7.8M29.4 16h-7.8M16 29.4v-7.8M2.6 16h7.8"
        stroke="currentColor"
        strokeOpacity="0.4"
      />
      <circle cx="16" cy="16" r="2.5" fill="currentColor" />
      <circle cx="16" cy="2.6" r="1.7" fill="currentColor" />
      <circle cx="29.4" cy="16" r="1.7" fill="currentColor" />
      <circle cx="16" cy="29.4" r="1.7" fill="currentColor" />
      <circle cx="2.6" cy="16" r="1.7" fill="currentColor" />
    </svg>
  );
}

export function BrandLockup({
  href = "/",
  className,
  subtitle,
}: {
  href?: string;
  className?: string;
  subtitle?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group inline-flex items-center gap-2.5 rounded-control outline-offset-4",
        className,
      )}
    >
      <BrandGlyph className="h-6 w-6 transition-transform duration-[var(--motion-standard)] ease-[var(--ease-out)] group-hover:rotate-45" />
      <span className="flex flex-col leading-none">
        <span className="text-[13px] font-semibold tracking-[0.26em] text-ink uppercase">
          Tripwire
        </span>
        {subtitle ? (
          <span className="mt-1 text-[10px] tracking-[0.16em] text-dim uppercase">{subtitle}</span>
        ) : null}
      </span>
    </Link>
  );
}
