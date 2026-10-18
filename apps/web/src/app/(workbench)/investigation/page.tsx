import type { Metadata } from "next";

import { InvestigationLauncher } from "@/components/investigation/investigation-launcher";
import { PageHeader } from "@/components/layout/page-header";

export const metadata: Metadata = { title: "Investigation" };

export default function InvestigationIndexPage() {
  return (
    <>
      <PageHeader
        title="Investigation"
        description="Each investigation runs bounded graph queries around one scored transaction, then shows the returned evidence, a verified report, and its case."
      />
      <div className="px-4 pb-12 md:px-8">
        <InvestigationLauncher />
      </div>
    </>
  );
}
