import {
  CircleCheck,
  CircleDashed,
  CircleHelp,
  CircleMinus,
  CircleX,
  Loader,
} from "lucide-react";
import type { Stage, StageState } from "../../lib/stages";
import { Card, cx } from "../ui/card";

const STATE_META: Record<StageState, { label: string; icon: typeof CircleCheck; tone: string }> = {
  pending: { label: "Pending", icon: CircleDashed, tone: "text-dim" },
  running: { label: "Running", icon: Loader, tone: "text-accent" },
  completed: { label: "Completed", icon: CircleCheck, tone: "text-safe" },
  failed: { label: "Failed", icon: CircleX, tone: "text-critical" },
  skipped: { label: "Skipped", icon: CircleMinus, tone: "text-dim" },
  unavailable: { label: "Unavailable", icon: CircleHelp, tone: "text-warning" },
};

export default function ExecutionRail({ stages, note }: { stages: Stage[]; note: string }) {
  return (
    <Card aria-label="Execution rail" className="p-4">
      <ol className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-8">
        {stages.map((stage, index) => {
          const meta = STATE_META[stage.state];
          const Icon = meta.icon;
          return (
            <li
              key={stage.id}
              className={cx(
                "min-w-0 rounded-control border border-line bg-raised/60 p-2.5",
                stage.state === "failed" && "border-critical/40",
              )}
            >
              <div className="flex items-center gap-1.5 text-[11px] text-dim">
                <span className="font-mono">{index + 1}</span>
                <Icon
                  key={stage.state}
                  aria-hidden="true"
                  className={cx("icon-swap h-3.5 w-3.5", meta.tone)}
                />
                <span className={meta.tone}>{meta.label}</span>
              </div>
              <p className="mt-1 text-sm font-medium text-ink">{stage.label}</p>
              <p className="mt-0.5 line-clamp-3 text-[11px] leading-4 text-dim" title={stage.detail}>
                {stage.detail}
              </p>
            </li>
          );
        })}
      </ol>
      <p className="mt-3 text-[11px] text-dim">{note}</p>
    </Card>
  );
}
