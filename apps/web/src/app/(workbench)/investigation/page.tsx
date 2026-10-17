import { Waypoints } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/layout/page-header";
import { TransactionLookup } from "@/components/overview/transaction-lookup";

export const metadata: Metadata = { title: "Investigation" };

export default function InvestigationIndexPage() {
  return (
    <>
      <PageHeader
        title="Investigation"
        description="Each investigation runs bounded graph queries around one scored transaction, then shows the returned evidence, a verified report, and its case."
      />
      <div className="px-4 pb-10 md:px-8">
        <section className="max-w-2xl rounded-lg border border-border bg-surface p-5">
          <Waypoints className="size-5 text-accent" aria-hidden />
          <h2 className="mt-3 text-base font-semibold">Choose a transaction to investigate</h2>
          <p className="mt-1 text-sm text-fg-secondary">
            Pick an alert from the{" "}
            <Link href="/overview" className="text-accent underline-offset-2 hover:underline">
              Overview queue
            </Link>
            , or enter a transaction ID you already have.
          </p>
          <div className="mt-4">
            <TransactionLookup autoFocus />
          </div>
        </section>
      </div>
    </>
  );
}
