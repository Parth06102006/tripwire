export default function SystemPage() {
  return (
    <main className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">System</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#9693A8]">
          Future diagnostics for API, graph database, and provider status.
          Health checks are not called from this scaffold.
        </p>
      </header>
      <section
        aria-label="System empty state"
        className="rounded-lg border border-dashed border-[#292936] bg-[#12121A] p-8 text-center"
      >
        <p className="text-sm font-medium">Status unavailable</p>
        <p className="mt-1 text-xs text-[#9693A8]">
          Health endpoints not wired. No status is inferred.
        </p>
      </section>
    </main>
  );
}
