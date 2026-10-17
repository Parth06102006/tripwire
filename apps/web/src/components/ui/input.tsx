import type { ComponentProps } from "react";

import { cn } from "@/lib/cn";

const fieldClass =
  "w-full rounded-md border border-border-strong bg-surface-sunken px-2.5 text-sm text-fg placeholder:text-fg-muted transition-colors hover:border-fg-muted focus-visible:border-accent focus-visible:outline-none aria-invalid:border-critical";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(fieldClass, "h-8", className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn(fieldClass, "min-h-20 py-1.5", className)} {...props} />;
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select className={cn(fieldClass, "h-8 pr-7", className)} {...props} />;
}

export function Label({ className, ...props }: ComponentProps<"label">) {
  return <label className={cn("text-xs font-medium text-fg-secondary", className)} {...props} />;
}
