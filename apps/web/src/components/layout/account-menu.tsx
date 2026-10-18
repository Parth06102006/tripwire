"use client";

import { ChevronUp, Keyboard, LogOut, UserRound } from "lucide-react";
import { useState } from "react";

import { OPEN_SHORTCUTS_EVENT } from "@/components/layout/keyboard-shortcuts-modal";
import { ServiceIndicator } from "@/components/layout/service-indicator";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useHealth } from "@/hooks/use-health";
import { useMe } from "@/hooks/use-me";
import { formatWait } from "@/lib/api-client";
import type { Usage } from "@/lib/api-schemas";
import { LOGIN_PATH } from "@/lib/auth/fetch";
import { signOutAndLeave } from "@/lib/auth/sign-out";
import { useAuthSession } from "@/lib/auth/use-auth-status";
import { cn } from "@/lib/cn";
import { secondsUntilNext } from "@/lib/usage";

type Window = Usage["hour"];

/** Green while there is room, amber when nearly used up, red at zero. */
function meterTone(window: Window): { bar: string; text: string } {
  if (window.remaining === 0) return { bar: "bg-critical", text: "text-critical" };
  if (window.remaining <= Math.max(1, Math.floor(window.limit * 0.2))) {
    return { bar: "bg-warning", text: "text-warning" };
  }
  return { bar: "bg-safe", text: "text-fg" };
}

function UsageRow({ label, window }: { label: string; window: Window }) {
  const tone = meterTone(window);
  const fraction = window.limit > 0 ? window.remaining / window.limit : 0;
  const returns =
    window.used === 0
      ? "Nothing used"
      : window.resets_in_seconds === null
        ? null
        : window.remaining === 0
          ? `Next slot in ${formatWait(window.resets_in_seconds)}`
          : `Oldest frees up in ${formatWait(window.resets_in_seconds)}`;
  return (
    <div data-testid={`usage-${label.toLowerCase()}`}>
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="text-fg-secondary">{label}</span>
        <span className={cn("font-mono tabular-nums", tone.text)}>
          {window.remaining} of {window.limit} left
        </span>
      </div>
      <div
        role="meter"
        aria-label={`${label} investigations left`}
        aria-valuemin={0}
        aria-valuemax={window.limit}
        aria-valuenow={window.remaining}
        className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-sunken"
      >
        <div
          className={cn("h-full rounded-full transition-[width] duration-300", tone.bar)}
          style={{ width: `${Math.round(fraction * 100)}%` }}
        />
      </div>
      {returns ? <p className="mt-1 text-2xs text-fg-muted">{returns}</p> : null}
    </div>
  );
}

function Avatar({ initial, tone }: { initial: string | null; tone: string }) {
  return (
    <span className="relative flex size-8 shrink-0 items-center justify-center rounded-full border border-border-strong bg-surface-elevated text-xs font-semibold text-fg uppercase">
      {initial ?? <UserRound className="size-4" aria-hidden />}
      <span
        aria-hidden
        className={cn(
          "absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full border-2 border-sidebar",
          tone,
        )}
      />
    </span>
  );
}

/**
 * The account button, and the menu it opens: who is signed in, how many
 * investigations are left this hour and today, the service status, the
 * shortcuts guide, and sign out.
 *
 * Who is signed in comes from the web app's session; the allowance comes from
 * the API. They can differ: with the API's token check off (local work) a
 * person can still be signed in, so Sign out stays available and the menu says
 * the limits are not enforced. With sign-in itself off there is no user.
 */
export function AccountMenu({ compact = false }: { compact?: boolean }) {
  const me = useMe();
  const session = useAuthSession();
  const health = useHealth();
  const [open, setOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const signedIn = session.status === "signed-in";
  const user = session.user ?? me.data?.user ?? null;
  const usage = me.data?.usage ?? null;
  // The API enforces limits only when it checks tokens.
  const limitsOff = me.data?.auth === "off";
  // "Local session" only once the server has said sign-in is off, never while loading.
  const label =
    user?.name || user?.email || (session.status === "off" ? "Local session" : "Account");
  const initial = signedIn ? label.trim().charAt(0) || null : null;

  const statusTone = health.isError
    ? "bg-critical"
    : health.data?.falkordb === "unavailable"
      ? "bg-warning"
      : health.data
        ? "bg-safe"
        : "bg-fg-muted";

  const lowest = usage ? Math.min(usage.hour.remaining, usage.day.remaining) : null;
  const wait = secondsUntilNext(usage);

  const onOpenChange = (next: boolean) => {
    setOpen(next);
    // The allowance changes whenever a review starts, so read it fresh on open.
    if (next && signedIn) void me.refetch();
  };

  const signOut = async () => {
    setLeaving(true);
    await signOutAndLeave(LOGIN_PATH);
  };

  const trigger = compact ? (
    <button
      type="button"
      aria-label={`Account menu, ${label}`}
      className="rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      <Avatar initial={initial} tone={statusTone} />
    </button>
  ) : (
    <button
      type="button"
      aria-label={`Account menu, ${label}`}
      className="group flex w-full items-center gap-2.5 rounded-lg border border-border bg-surface/60 p-2 text-left transition-colors hover:border-border-strong hover:bg-surface data-[state=open]:border-border-strong data-[state=open]:bg-surface"
    >
      <Avatar initial={initial} tone={statusTone} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-medium text-fg">{label}</span>
        <span
          className={cn(
            "block truncate text-2xs",
            lowest === 0 ? "text-critical" : "text-fg-muted",
          )}
        >
          {session.loading || (!me.data && !me.isError)
            ? "Loading"
            : usage
              ? lowest === 0
                ? "Limit reached"
                : `${usage.hour.remaining} left this hour`
              : signedIn
                ? "Signed in"
                : "Sign-in off"}
        </span>
      </span>
      <ChevronUp
        className="size-4 shrink-0 text-fg-muted transition-transform group-data-[state=open]:rotate-180"
        aria-hidden
      />
    </button>
  );

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent side={compact ? "bottom" : "top"} align={compact ? "end" : "start"}>
        <div className="border-b border-border px-4 py-3">
          <p className="truncate text-sm font-medium text-fg" title={label}>
            {label}
          </p>
          {user?.email && user.email !== label ? (
            <p className="truncate text-xs text-fg-muted" title={user.email}>
              {user.email}
            </p>
          ) : null}
          {session.status === "off" ? (
            <p className="text-xs text-fg-muted">
              Sign-in is off on this server, so there is no account and no limit.
            </p>
          ) : null}
        </div>

        {usage ? (
          <section
            aria-label="Investigations left"
            className="space-y-3.5 border-b border-border px-4 py-3"
          >
            <h2 className="text-2xs font-semibold tracking-wider text-fg-muted uppercase">
              Investigations left
            </h2>
            <UsageRow label="Hourly" window={usage.hour} />
            <UsageRow label="Daily" window={usage.day} />
            {lowest === 0 && wait !== null ? (
              <p role="status" className="text-xs text-warning">
                Limit reached. You can start another in {formatWait(wait)}.
              </p>
            ) : null}
          </section>
        ) : signedIn && limitsOff ? (
          <p className="border-b border-border px-4 py-3 text-xs text-fg-muted">
            Investigation limits are not enforced: the API on this server runs without its token
            check.
          </p>
        ) : me.isError ? (
          <p className="border-b border-border px-4 py-3 text-xs text-fg-muted">
            Your allowance could not be loaded.
          </p>
        ) : null}

        <div className="border-b border-border px-4 py-3">
          <ServiceIndicator />
        </div>

        <div className="p-1.5">
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              window.dispatchEvent(new CustomEvent(OPEN_SHORTCUTS_EVENT));
            }}
            className="flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-2 text-xs text-fg-secondary transition-colors hover:bg-surface hover:text-fg"
          >
            <span className="flex items-center gap-2">
              <Keyboard className="size-4" aria-hidden /> Keyboard shortcuts
            </span>
            <kbd className="rounded border border-border-strong px-1.5 font-mono text-2xs text-fg-muted">
              ?
            </kbd>
          </button>
          {signedIn ? (
            <button
              type="button"
              onClick={signOut}
              disabled={leaving}
              className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-xs text-fg-secondary transition-colors hover:bg-surface hover:text-critical disabled:opacity-50"
            >
              <LogOut className="size-4" aria-hidden /> Sign out
            </button>
          ) : null}
        </div>

        <p className="border-t border-border px-4 py-2.5 text-2xs leading-relaxed text-fg-muted">
          Synthetic IBM AMLworld replay. No real accounts, and no payment is ever blocked.
        </p>
      </PopoverContent>
    </Popover>
  );
}
