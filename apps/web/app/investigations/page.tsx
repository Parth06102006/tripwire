export default function InvestigationsPage() {
  return (
    <main className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Investigations</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#9693A8]">
          Future graph investigation workspace. Evidence paths will be rendered
          from backend responses when wired.
        </p>
      </header>
      <section
        aria-label="Investigations empty state"
        className="rounded-lg border border-dashed border-[#292936] bg-[#12121A] p-8 text-center"
      >
        <p className="text-sm font-medium">No investigation selected</p>
        <p className="mt-1 text-xs text-[#9693A8]">
          Graph canvas not initialized. No backend evidence requested.
        </p>
      </section>
    </main>
  );
}
