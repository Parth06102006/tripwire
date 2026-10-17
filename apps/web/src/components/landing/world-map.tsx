import type { CSSProperties } from "react";
import { cn } from "@/lib/cn";
import { WORLD_COLUMNS, WORLD_MASK_URI, WORLD_ROWS } from "./world-dots";

/**
 * Dot-matrix world silhouette behind the product preview.
 *
 * The dot pitch is one per rasterised land cell (see
 * scripts/generate-world-dots.mjs), masked by the land grid itself, so the
 * silhouette stays sharp while the whole layer scales with its container.
 */
export function WorldDotMap({ className }: { className?: string }) {
  const variables = {
    "--world-columns": WORLD_COLUMNS,
    "--world-rows": WORLD_ROWS,
  } as CSSProperties;

  return (
    <div aria-hidden="true" className={cn("absolute inset-x-0 top-0 overflow-hidden", className)}>
      {/* Horizon glow behind the silhouette. */}
      <div className="absolute inset-0 bg-[radial-gradient(58%_76%_at_50%_96%,rgba(242,140,56,0.42),rgba(242,140,56,0.12)_46%,transparent_74%)]" />
      <div className="absolute inset-x-0 top-0 h-24 bg-[linear-gradient(to_bottom,var(--canvas),transparent)] opacity-80" />

      {/* Land dots. */}
      <div
        className="world-dots absolute inset-x-0 top-0 aspect-[120/46] w-full"
        style={{
          ...variables,
          maskImage: `url("${WORLD_MASK_URI}")`,
          WebkitMaskImage: `url("${WORLD_MASK_URI}")`,
          maskSize: "100% 100%",
          WebkitMaskSize: "100% 100%",
          maskRepeat: "no-repeat",
          WebkitMaskRepeat: "no-repeat",
        }}
      />

      {/* Brightness falloff so the matrix reads as atmosphere, not a chart. */}
      <div className="absolute inset-0 bg-[radial-gradient(70%_70%_at_50%_52%,transparent,rgba(8,9,9,0.55)_84%,var(--canvas))]" />
      <div className="absolute inset-x-0 bottom-0 h-32 bg-[linear-gradient(to_top,var(--canvas),transparent)]" />
    </div>
  );
}
