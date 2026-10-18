import type { Metadata } from "next";

import { PageHeader } from "@/components/layout/page-header";
import { OverviewKpis } from "@/components/overview/overview-kpis";
import { OverviewView } from "@/components/overview/overview-view";

export const metadata: Metadata = { title: "Overview" };

/**
 * From xl up the screen is exactly one viewport tall: header and counts keep
 * their height, and the queue takes the rest and scrolls inside itself. Below
 * xl the page scrolls normally and the queue is a fixed share of the viewport.
 */
export default function OverviewPage() {
  return (
    <div className="flex flex-col xl:h-dvh">
      <PageHeader
        compact
        title="Overview"
        description="Scored transactions from the synthetic replay, highest risk first. Open an alert to investigate its graph evidence."
      />
      <div className="px-4 pb-3 md:px-8">
        <OverviewKpis />
      </div>
      <OverviewView />
    </div>
  );
}
