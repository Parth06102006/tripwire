"use client";

export function DocsArticleHeader() {
  return (
    <header className="border-b border-border-strong pb-8">
      {/* Publication badge */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-accent-soft px-3 py-1 font-mono text-2xs font-semibold tracking-wider text-accent uppercase">
          Architecture & Investigation Guide
        </span>
        <span className="rounded-full border border-border-strong px-2.5 py-0.5 text-2xs text-fg-muted">
          Updated for Iteration 2
        </span>
      </div>

      {/* Main Headline */}
      <h1 className="text-2xl font-bold tracking-tight text-fg sm:text-3xl md:text-4xl lg:text-[42px] lg:leading-[1.15]">
        Securing the Transaction Network: The ML Model, the Agent Pass, and the Graph
      </h1>

      {/* Editorial Subtitle */}
      <p className="mt-4 text-base leading-relaxed font-normal text-fg-secondary sm:text-lg">
        Start from the bank’s side of the counter. A machine learning model scores every transfer; a
        bounded LLM agent adds a second pass over flagged alerts; and every claim the agent makes
        has to be backed by graph evidence retrieved from FalkorDB.
      </p>
    </header>
  );
}
