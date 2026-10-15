/** Shared loading, error, and empty states for workbench pages. */

interface StatusPanelProps {
  title: string;
  message: string;
  label: string;
}

export function LoadingPanel({ title, message, label }: StatusPanelProps) {
  return (
    <section
      aria-label={label}
      aria-busy="true"
      className="rounded-lg border border-[#292936] bg-[#12121A] p-8"
    >
      <div role="status" className="flex flex-col items-center gap-3 text-center">
        <span
          aria-hidden="true"
          className="h-6 w-6 animate-spin rounded-full border-2 border-[#292936] border-t-[#B68CFF]"
        />
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-[#9693A8]">{message}</p>
      </div>
    </section>
  );
}

interface ErrorPanelProps extends StatusPanelProps {
  onRetry: () => void;
}

export function ErrorPanel({ title, message, label, onRetry }: ErrorPanelProps) {
  return (
    <section
      aria-label={label}
      className="rounded-lg border border-[#5c2b2b] bg-[#12121A] p-8 text-center"
    >
      <div role="alert" className="flex flex-col items-center gap-3">
        <p className="text-sm font-medium text-[#F87171]">{title}</p>
        <p className="max-w-md text-xs leading-5 text-[#9693A8]">{message}</p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-1 rounded-md border border-[#292936] bg-[#191923] px-4 py-2 text-sm font-medium text-[#F2F0F8] transition-colors hover:border-[#B68CFF] focus-visible:outline-2 focus-visible:outline-[#B68CFF]"
        >
          Retry
        </button>
      </div>
    </section>
  );
}

export function EmptyPanel({ title, message, label }: StatusPanelProps) {
  return (
    <section
      aria-label={label}
      className="rounded-lg border border-dashed border-[#292936] bg-[#12121A] p-8 text-center"
    >
      <p className="text-sm font-medium">{title}</p>
      <p className="mt-1 text-xs text-[#9693A8]">{message}</p>
    </section>
  );
}

export function DecisionBadge({ decision }: { decision: "allow" | "review" }) {
  const styles =
    decision === "review"
      ? "border-[#5c4a1e] bg-[#2a2113] text-[#F4B860]"
      : "border-[#1e4a32] bg-[#12291b] text-[#56D6A0]";
  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-0.5 font-mono text-xs ${styles}`}
    >
      {decision}
    </span>
  );
}
