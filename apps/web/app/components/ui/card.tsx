import type { HTMLAttributes, ReactNode } from "react";

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

interface CardProps extends HTMLAttributes<HTMLElement> {
  as?: "section" | "div" | "article" | "aside";
  padded?: boolean;
}

export function Card({ as: Tag = "section", padded = true, className, ...rest }: CardProps) {
  return (
    <Tag
      className={cx(
        "min-w-0 rounded-card border border-line bg-card",
        padded && "p-4 sm:p-6",
        className,
      )}
      {...rest}
    />
  );
}

interface CardHeaderProps {
  title: string;
  id?: string;
  description?: ReactNode;
  actions?: ReactNode;
}

export function CardHeader({ title, id, description, actions }: CardHeaderProps) {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        <h2 id={id} className="text-base font-semibold tracking-tight text-ink">
          {title}
        </h2>
        {description ? <p className="mt-1 text-xs text-dim">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function Metadata({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-dim">{label}</dt>
      <dd className="mt-0.5 break-words font-mono text-xs text-ink">{children}</dd>
    </div>
  );
}
