import { ArrowUpRight, BookOpen } from "lucide-react";

interface ReferenceMetric {
  value: string;
  label: string;
}

interface DocsReferenceProps {
  title: string;
  source: string;
  published?: string;
  href: string;
  summary: string;
  metrics?: ReferenceMetric[];
  notes?: string[];
}

/**
 * External reading card for the guide. Used to point at public engineering
 * write-ups that build the same kind of system, with their numbers shown as
 * the author's results, not ours.
 */
export function DocsReference({
  title,
  source,
  published,
  href,
  summary,
  metrics = [],
  notes = [],
}: DocsReferenceProps) {
  return (
    <div className="my-8 overflow-hidden rounded-xl border border-border-strong bg-surface shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-strong bg-surface-sunken px-5 py-3">
        <span className="flex items-center gap-2 font-mono text-2xs font-semibold tracking-wider text-fg-muted uppercase">
          <BookOpen className="size-3.5 text-accent" aria-hidden />
          Field notes
        </span>
        <span className="text-2xs text-fg-muted">
          {source}
          {published ? ` | ${published}` : ""}
        </span>
      </div>

      <div className="space-y-4 p-5">
        <h4 className="text-sm font-semibold text-fg sm:text-base">{title}</h4>
        <p className="text-xs leading-relaxed text-fg-secondary sm:text-sm">{summary}</p>

        {metrics.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-3">
            {metrics.map((metric) => (
              <div
                key={metric.label}
                className="rounded-lg border border-border-strong bg-surface-sunken p-3.5"
              >
                <span className="font-mono text-lg font-semibold text-accent">{metric.value}</span>
                <p className="mt-1 text-2xs leading-relaxed text-fg-muted">{metric.label}</p>
              </div>
            ))}
          </div>
        ) : null}

        {notes.length > 0 ? (
          <ul className="space-y-1.5 text-xs text-fg-secondary">
            {notes.map((note) => (
              <li key={note} className="flex items-start gap-2">
                <span className="mt-1.5 size-1 shrink-0 rounded-full bg-accent" aria-hidden />
                <span>{note}</span>
              </li>
            ))}
          </ul>
        ) : null}

        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 rounded-full border border-border-strong px-3.5 py-1.5 text-xs font-semibold text-accent transition-colors hover:border-accent hover:bg-accent-soft/40"
        >
          Read the full write-up
          <ArrowUpRight className="size-3.5" aria-hidden />
        </a>
      </div>
    </div>
  );
}
