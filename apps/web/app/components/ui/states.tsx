import { CircleDashed, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { Card, cx } from "./card";

interface StateProps {
  title: string;
  message: string;
  label: string;
  className?: string;
  children?: ReactNode;
}

export function LoadingState({
  label,
  className,
  lines = 3,
}: {
  label: string;
  className?: string;
  lines?: number;
}) {
  return (
    <Card aria-label={label} aria-busy="true" className={className}>
      <div role="status" className="flex flex-col gap-3">
        <span className="sr-only">{label}</span>
        {Array.from({ length: lines }, (_, index) => (
          <div
            key={index}
            aria-hidden="true"
            className="skeleton h-4"
            style={{ width: `${90 - index * 18}%` }}
          />
        ))}
      </div>
    </Card>
  );
}

export function ErrorState({
  title,
  message,
  label,
  className,
  onRetry,
}: StateProps & { onRetry?: () => void }) {
  return (
    <Card aria-label={label} className={cx("border-critical/30", className)}>
      <div role="alert" className="flex flex-col items-start gap-2">
        <div className="flex items-center gap-2 text-sm font-medium text-critical">
          <TriangleAlert aria-hidden="true" className="h-4 w-4" />
          {title}
        </div>
        <p className="max-w-xl text-xs leading-5 text-dim">{message}</p>
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="mt-1 rounded-control border border-line-strong px-3 py-1.5 text-xs font-medium text-ink hover:bg-hover"
          >
            Retry
          </button>
        ) : null}
      </div>
    </Card>
  );
}

export function EmptyState({ title, message, label, className, children }: StateProps) {
  return (
    <Card aria-label={label} className={cx("border-dashed", className)}>
      <div className="flex flex-col items-start gap-1">
        <p className="text-sm font-medium text-ink">{title}</p>
        <p className="max-w-xl text-xs leading-5 text-dim">{message}</p>
        {children}
      </div>
    </Card>
  );
}

/** For capabilities the backend does not expose. Never implies a result. */
export function UnavailableState({ title, message, label, className, children }: StateProps) {
  return (
    <Card aria-label={label} className={cx("border-dashed", className)}>
      <div className="flex items-start gap-3">
        <CircleDashed aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-dim" />
        <div>
          <p className="text-sm font-medium text-ink">{title}</p>
          <p className="mt-1 max-w-xl text-xs leading-5 text-dim">{message}</p>
          {children}
        </div>
      </div>
    </Card>
  );
}
