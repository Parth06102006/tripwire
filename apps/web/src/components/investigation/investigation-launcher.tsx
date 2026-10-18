"use client";

import {
  ArrowRight,
  ArrowRightLeft,
  Flame,
  GitFork,
  Layers,
  RotateCw,
  Search,
  ShieldAlert,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { investigationHref } from "@/components/overview/transaction-lookup";
import { RouteBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useAlerts } from "@/hooks/use-alerts";
import { cn } from "@/lib/cn";
import { formatScore, formatSourceTimestamp } from "@/lib/formatters";

interface TypologyScenario {
  id: string;
  name: string;
  pattern: string;
  description: string;
  icon: LucideIcon;
  accent: string;
  badgeTone: "critical" | "review" | "verified";
  riskTier: string;
  queryParamText: string;
}

const TYPOLOGY_SCENARIOS: readonly TypologyScenario[] = [
  {
    id: "fan-out",
    name: "Layered Fan-Out",
    pattern: "fan_out",
    description:
      "A single origin account rapidly scatters funds to 10+ dispersed recipient accounts across disparate banks to fragment detection.",
    icon: GitFork,
    accent: "text-critical",
    badgeTone: "critical",
    riskTier: "High Velocity",
    queryParamText: "fan_out",
  },
  {
    id: "fan-in",
    name: "Structuring & Smurfing",
    pattern: "fan_in",
    description:
      "Multiple sub-$10,000 cash deposits converging into an aggregator hub to systematically evade regulatory CTR reporting thresholds.",
    icon: Layers,
    accent: "text-warning",
    badgeTone: "review",
    riskTier: "Threshold Evading",
    queryParamText: "fan_in",
  },
  {
    id: "pass-through",
    name: "Rapid Pass-Through",
    pattern: "pass_through",
    description:
      "Intermediary transit accounts with near-zero holding duration, routing funds through offshore gateways with 98%+ transfer velocity.",
    icon: ArrowRightLeft,
    accent: "text-accent",
    badgeTone: "review",
    riskTier: "Zero Retention",
    queryParamText: "pass_through",
  },
  {
    id: "cycle",
    name: "Circular Round-Tripping",
    pattern: "cycle",
    description:
      "Complex multi-hop circular flows where capital traverses intermediary shell entities and returns to the originating beneficiary.",
    icon: RotateCw,
    accent: "text-critical",
    badgeTone: "critical",
    riskTier: "Circular Flow",
    queryParamText: "cycle",
  },
];

export function InvestigationLauncher() {
  const router = useRouter();
  const [searchValue, setSearchValue] = useState("");
  const alerts = useAlerts({ limit: 4, offset: 0 });

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    const id = searchValue.trim();
    if (id) router.push(investigationHref(id));
  };

  const highPriorityItems = alerts.data?.items ?? [];

  return (
    <div className="space-y-8">
      {/* Hero Lookup Section */}
      <section
        aria-labelledby="lookup-heading"
        className="relative overflow-hidden rounded-xl border border-border bg-gradient-to-br from-surface via-card to-surface-sunken p-6 shadow-md md:p-8"
      >
        <div className="pointer-events-none absolute -top-24 -right-24 size-96 rounded-full bg-accent/5 blur-3xl" />
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent-soft px-3 py-1 text-2xs font-semibold text-accent uppercase">
            <Sparkles className="size-3" aria-hidden />
            FalkorDB Graph Investigation Engine
          </div>
          <h2
            id="lookup-heading"
            className="mt-3 text-xl font-bold tracking-tight text-fg sm:text-2xl"
          >
            Inspect money movement and network typology
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-fg-secondary">
            Execute bounded graph queries in FalkorDB around any scored anchor transaction. The AI
            investigator discovers counterparties, validates evidence paths, and recommends policy
            action proposals.
          </p>

          <form
            onSubmit={onSubmit}
            role="search"
            className="mt-6 flex flex-col gap-2.5 sm:flex-row sm:items-center"
          >
            <div className="relative flex-1">
              <Search
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-fg-muted"
                aria-hidden
              />
              <Input
                aria-label="Transaction ID to investigate"
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                placeholder="Paste transaction ID (e.g. 981290)"
                className="h-10 pl-9 font-mono text-xs sm:text-sm"
                autoFocus
              />
            </div>
            <Button
              type="submit"
              disabled={!searchValue.trim()}
              className="h-10 px-5 text-xs font-semibold"
            >
              <span>Start Investigation</span>
              <ArrowRight className="size-3.5" aria-hidden />
            </Button>
          </form>
        </div>
      </section>

      {/* Live Priority Queue Quick Start */}
      <section aria-labelledby="priority-heading" className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Flame className="size-4 text-critical" aria-hidden />
            <h3 id="priority-heading" className="text-sm font-semibold text-fg">
              Highest-Risk Priority Alerts
            </h3>
          </div>
          <Link
            href="/overview"
            className="inline-flex items-center gap-1 text-xs text-accent hover:underline"
          >
            <span>View entire queue</span>
            <ArrowRight className="size-3" aria-hidden />
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {alerts.isPending
            ? Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="rounded-lg border border-border bg-surface p-4">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="mt-2 h-6 w-16" />
                  <Skeleton className="mt-4 h-4 w-full" />
                </div>
              ))
            : highPriorityItems.map((item) => (
                <Link
                  key={item.transaction_id}
                  href={investigationHref(item.transaction_id)}
                  className="group flex flex-col justify-between rounded-lg border border-border bg-surface p-4 transition-all hover:border-accent/60 hover:bg-surface-elevated hover:shadow-sm"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-medium text-fg group-hover:text-accent">
                        {item.transaction_id}
                      </span>
                      <span className="font-mono text-xs font-bold text-critical">
                        {formatScore(item.score)}
                      </span>
                    </div>
                    <div className="mt-2.5 flex items-center gap-1.5">
                      <RouteBadge route={item.route} />
                    </div>
                  </div>
                  <div className="mt-4 flex items-center justify-between border-t border-border/50 pt-2 text-2xs text-fg-muted">
                    <span>{formatSourceTimestamp(item.timestamp)}</span>
                    <span className="inline-flex items-center gap-0.5 text-accent opacity-0 transition-opacity group-hover:opacity-100">
                      Investigate <ArrowRight className="size-2.5" />
                    </span>
                  </div>
                </Link>
              ))}
        </div>
      </section>

      {/* Typology Scenarios Gallery */}
      <section aria-labelledby="typologies-heading" className="space-y-3">
        <div className="flex items-center gap-2">
          <ShieldAlert className="size-4 text-accent" aria-hidden />
          <h3 id="typologies-heading" className="text-sm font-semibold text-fg">
            Explore Synthetic IBM AMLworld Typologies
          </h3>
        </div>
        <p className="text-xs text-fg-secondary">
          Select an archetypal money laundering typology pattern to trace its counterparty flow in
          the graph.
        </p>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {TYPOLOGY_SCENARIOS.map((typology) => {
            const Icon = typology.icon;
            // Target the highest-risk item if available, or fall back to first item
            const targetId = highPriorityItems[0]?.transaction_id ?? "981290";

            return (
              <div
                key={typology.id}
                className="flex flex-col justify-between rounded-lg border border-border bg-surface p-5 transition-all hover:border-line-strong hover:bg-surface-elevated"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="rounded-md border border-border bg-surface-sunken p-2">
                        <Icon className={cn("size-4", typology.accent)} aria-hidden />
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-fg">{typology.name}</h4>
                        <span className="font-mono text-2xs text-fg-muted">{typology.pattern}</span>
                      </div>
                    </div>
                    <Badge tone={typology.badgeTone}>{typology.riskTier}</Badge>
                  </div>
                  <p className="mt-3 text-xs leading-relaxed text-fg-secondary">
                    {typology.description}
                  </p>
                </div>

                <div className="mt-4 border-t border-border/50 pt-3">
                  <Link
                    href={investigationHref(targetId)}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-accent hover:underline"
                  >
                    <span>Launch typology scenario</span>
                    <ArrowRight className="size-3" aria-hidden />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
