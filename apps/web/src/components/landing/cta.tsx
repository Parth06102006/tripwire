import { ArrowRight } from "lucide-react";
import Link from "next/link";
import type { Route } from "next";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "quiet";
type Size = "sm" | "md" | "lg";

const VARIANT: Record<Variant, string> = {
  primary:
    "bg-accent text-accent-ink font-semibold shadow-[0_14px_40px_-18px_rgba(242,140,56,0.85)] hover:brightness-[1.07] hover:shadow-[0_18px_48px_-16px_rgba(242,140,56,0.9)]",
  secondary:
    "border border-line-strong bg-white/[0.02] text-ink hover:border-white/25 hover:bg-white/[0.06]",
  quiet: "text-dim hover:text-ink",
};

const SIZE: Record<Size, string> = {
  sm: "px-3.5 py-2 text-[13px]",
  md: "px-5 py-2.5 text-sm",
  lg: "px-6 py-3 text-[15px]",
};

interface CtaLinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> {
  href: string;
  variant?: Variant;
  size?: Size;
  children: ReactNode;
}

/** Landing page call to action. Rounder and larger than the workbench controls. */
export function CtaLink({
  href,
  variant = "primary",
  size = "md",
  className,
  children,
  ...rest
}: CtaLinkProps) {
  const external = href.startsWith("http");
  return (
    <Link
      href={href as Route}
      className={cn(
        "group inline-flex items-center justify-center gap-2 rounded-full transition-[background-color,color,box-shadow,border-color,filter] duration-[var(--motion-standard)] ease-[var(--ease-out)]",
        VARIANT[variant],
        SIZE[size],
        className,
      )}
      {...(external ? { target: "_blank", rel: "noreferrer" } : {})}
      {...rest}
    >
      {children}
    </Link>
  );
}

export function CtaArrow({ className }: { className?: string }) {
  return (
    <ArrowRight
      aria-hidden="true"
      className={cn(
        "h-4 w-4 transition-transform duration-[var(--motion-standard)] ease-[var(--ease-out)] group-hover:translate-x-0.5",
        className,
      )}
    />
  );
}
