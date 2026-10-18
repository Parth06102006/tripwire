import type { Metadata } from "next";
import { DocsView } from "@/components/docs/docs-view";

export const metadata: Metadata = {
  title: "Complete Guide & Architecture Documentation",
  description:
    "A comprehensive engineering guide to graph-powered anti-money laundering detection with FalkorDB, LightGBM scoring, and autonomous LLM investigation agents.",
};

export default function DocsPage() {
  return <DocsView />;
}
