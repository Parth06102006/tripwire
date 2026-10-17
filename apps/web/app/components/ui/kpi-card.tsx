"use client";

import Link from "next/link";
import type { Route } from "next";
import type { ReactNode } from "react";
import { Card, cx } from "./card";
import { AnimatedValue } from "./motion";

export type KpiState =
  | { kind: "ready"; value: string }
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "unavailable"; message: string };

interface KpiCardProps {
  label: string;
  state: KpiState;
  note?: ReactNode;
  href?: string;
  icon?: ReactNode;
}

export function KpiCard({ label, state, note, href, icon }: KpiCardProps) {
  const body = (
    <>
      <div className="flex items-center justify-between gap-2 text-xs text-dim">
        <span>{label}</span>
        {icon}
      </div>
      <div className="mt-2 min-h-9 text-[28px] leading-9 font-semibold tracking-tight text-ink tabular-nums">
        {state.kind === "ready" ? (
          <AnimatedValue value={state.value} />
        ) : state.kind === "loading" ? (
          <div role="status" aria-label={`${label} loading`} className="skeleton mt-1 h-7 w-20" />
        ) : (
          <span className="text-base font-medium text-dim">
            {state.kind === "error" ? "Error" : "Unavailable"}
          </span>
        )}
      </div>
      <p className="mt-1 text-xs text-dim">
        {state.kind === "error" || state.kind === "unavailable" ? state.message : note}
      </p>
    </>
  );

  return (
    <Card
      as="div"
      className={cx(
        "selectable",
        href && "hover:border-line-strong hover:bg-raised focus-within:border-line-strong",
      )}
    >
      {href ? (
        <Link href={href as Route} className="block rounded-control">
          {body}
        </Link>
      ) : (
        body
      )}
    </Card>
  );
}
