import { cn } from "@/lib/cn";

/**
 * Hatched divider band from the reference artwork: thin rules top and bottom,
 * diagonal hatching between them, faded out at both ends, with technical
 * drafting crosshairs at the margins.
 */
export function HatchRule({
  className,
  density = 1,
  showCrosshairs = true,
}: {
  className?: string;
  /** Number of stacked hatch bands. */
  density?: number;
  /** Show technical blueprint crosshairs at margins. */
  showCrosshairs?: boolean;
}) {
  return (
    <div aria-hidden="true" className={cn("relative border-y border-line/70", className)}>
      {showCrosshairs ? (
        <>
          {/* Left margin crosshair and hairline extension */}
          <div className="pointer-events-none absolute -top-2 left-6 flex items-center gap-1.5 text-line-strong select-none sm:left-10">
            <span className="font-mono text-[11px] leading-none text-dim/50">+</span>
            <span className="h-px w-8 bg-line-strong/40" />
          </div>
          {/* Right margin crosshair and hairline extension */}
          <div className="pointer-events-none absolute -top-2 right-6 flex items-center gap-1.5 text-line-strong select-none sm:right-10">
            <span className="h-px w-8 bg-line-strong/40" />
            <span className="font-mono text-[11px] leading-none text-dim/50">+</span>
          </div>
        </>
      ) : null}

      <div className="flex h-8 flex-col justify-center gap-1 px-4 sm:px-12">
        {Array.from({ length: density }, (_, index) => (
          <span key={index} className="hatch-rule block h-3" />
        ))}
      </div>
    </div>
  );
}
