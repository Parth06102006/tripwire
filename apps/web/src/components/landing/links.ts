/** Shared destinations for the landing surface. */

export const REPO_URL = "https://github.com/PriyanshuSingh9/tripwire";
export const REPO_ISSUES_URL = `${REPO_URL}/issues`;

export const WORKBENCH_HREF = "/overview";
export const DEMO_HREF = "/investigation";
export const PERFORMANCE_HREF = "/performance";

export const NAV_LINKS = [
  { href: "#product", label: "Product" },
  { href: "#how-it-works", label: "How it works" },
  { href: "#typologies", label: "Typologies" },
  { href: "#benchmarks", label: "Benchmarks" },
] as const;
