import type { Metadata } from "next";

import { PageHeader } from "@/components/layout/page-header";
import { PerformanceView } from "@/components/performance/performance-view";

export const metadata: Metadata = { title: "Performance" };

export default function PerformancePage() {
  return (
    <>
      <PageHeader
        title="Performance"
        description="How well the models detect laundering on held-out data, and how fast and costly scoring and investigation are. Every figure comes from a recorded benchmark run."
      />
      <div className="px-4 pb-10 md:px-8">
        <PerformanceView />
      </div>
    </>
  );
}
