import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Eyebrow, title and lead paragraph shared by the landing sections. */
export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "left",
  className,
}: {
  eyebrow: string;
  title: ReactNode;
  description?: ReactNode;
  align?: "left" | "center";
  className?: string;
}) {
  return (
    <header
      className={cn("max-w-3xl", align === "center" && "mx-auto max-w-2xl text-center", className)}
    >
      <p
        className={cn(
          "flex items-center gap-2.5 text-[11px] font-medium tracking-[0.2em] text-accent uppercase",
          align === "center" && "justify-center",
        )}
      >
        <span aria-hidden="true" className="h-px w-6 bg-accent/50" />
        {eyebrow}
      </p>
      <h2 className="mt-4 text-[clamp(1.9rem,3.4vw,2.7rem)] leading-[1.08] font-semibold tracking-[-0.03em] text-ink">
        {title}
      </h2>
      {description ? <p className="mt-4 text-[15px] leading-7 text-dim">{description}</p> : null}
    </header>
  );
}
