"use client";

import { useState } from "react";

import { AlertPeekDrawer } from "@/components/overview/alert-peek-drawer";
import { AlertQueue } from "@/components/overview/alert-queue";
import { OperationalStatus } from "@/components/overview/operational-status";
import type { AlertItem } from "@/lib/api-schemas";

export function OverviewView() {
  const [selectedAlert, setSelectedAlert] = useState<AlertItem | null>(null);

  return (
    <div className="grid gap-4 px-4 pb-6 md:px-8 xl:min-h-0 xl:flex-1 xl:grid-cols-[minmax(0,1fr)_340px] xl:grid-rows-[minmax(0,1fr)]">
      <AlertQueue
        className="h-[75dvh] xl:h-full"
        selectedAlertId={selectedAlert?.transaction_id}
        onSelectAlert={setSelectedAlert}
      />
      <div className="xl:min-h-0 xl:overflow-y-auto">
        {selectedAlert ? (
          <AlertPeekDrawer alert={selectedAlert} onClose={() => setSelectedAlert(null)} />
        ) : (
          <OperationalStatus />
        )}
      </div>
    </div>
  );
}
