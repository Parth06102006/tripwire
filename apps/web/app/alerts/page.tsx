export default function AlertsPage() {
  return (
    <main className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Alerts</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#9693A8]">
          Future triage queue for replayed transactions. This scaffold renders
          structure only and fetches no data.
        </p>
      </header>
      <section
        aria-label="Alerts empty state"
        className="rounded-lg border border-dashed border-[#292936] bg-[#12121A] p-8 text-center"
      >
        <p className="text-sm font-medium">No alerts loaded</p>
        <p className="mt-1 text-xs text-[#9693A8]">
          Queue API not wired yet. No placeholder rows are shown.
        </p>
      </section>
    </main>
  );
}
