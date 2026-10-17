import Link from "next/link";
import type { Route } from "next";
import type {
  AnchorHTMLAttributes,
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
} from "react";
import { cx } from "./card";

type Variant = "primary" | "secondary" | "ghost" | "danger";

const VARIANT: Record<Variant, string> = {
  primary: "bg-accent text-accent-ink hover:brightness-110 font-semibold",
  secondary: "border border-line-strong text-ink hover:bg-hover",
  ghost: "text-dim hover:bg-hover hover:text-ink",
  danger: "border border-critical/50 text-critical hover:bg-critical/10",
};

export function buttonClass(variant: Variant = "secondary", extra?: string): string {
  return cx(
    "inline-flex items-center justify-center gap-1.5 rounded-control px-3 py-1.5 text-xs font-medium transition-[background-color,filter] duration-[var(--motion-fast)] disabled:cursor-not-allowed disabled:opacity-40",
    VARIANT[variant],
    extra,
  );
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

export function Button({ variant = "secondary", className, type = "button", ...rest }: ButtonProps) {
  return <button type={type} className={buttonClass(variant, className)} {...rest} />;
}

interface LinkButtonProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> {
  href: string;
  variant?: Variant;
}

export function LinkButton({ href, variant = "secondary", className, ...rest }: LinkButtonProps) {
  return <Link href={href as Route} className={buttonClass(variant, className)} {...rest} />;
}

export function IconButton({
  label,
  children,
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cx(
        "inline-flex h-8 w-8 items-center justify-center rounded-control text-dim transition-colors hover:bg-hover hover:text-ink disabled:opacity-40",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

export const inputClass =
  "w-full rounded-control border border-line-strong bg-raised px-3 py-1.5 text-xs text-ink placeholder:text-dim";

export function TextInput({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cx(inputClass, className)} {...rest} />;
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs text-dim">
      <span className="font-medium text-ink">{label}</span>
      {children}
      {hint ? <span className="text-[11px]">{hint}</span> : null}
    </label>
  );
}
