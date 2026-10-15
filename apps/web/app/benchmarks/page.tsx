export default function BenchmarksPage() {
  return (
    <main className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Benchmarks</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#9693A8]">
          Future reproducible benchmark view. No results exist in this scaffold,
          so none are displayed.
        </p>
      </header>
      <section
        aria-label="Benchmarks empty state"
        className="rounded-lg border border-dashed border-[#292936] bg-[#12121A] p-8 text-center"
      >
        <p className="text-sm font-medium">No benchmark runs</p>
        <p className="mt-1 text-xs text-[#9693A8]">
          Results will appear only after real evaluation runs are wired.
        </p>
      </section>
    </main>
  );
}
