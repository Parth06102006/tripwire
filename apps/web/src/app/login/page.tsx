import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import { LoginForm } from "@/components/auth/login-form";
import { BrandLockup } from "@/components/landing/brand";
import { ALLOW_ANYONE } from "@/lib/auth/config";
import { safeNext } from "@/lib/auth/next";
import { authConfig, getAuth } from "@/lib/auth/server";

export const metadata: Metadata = { title: "Sign in", robots: { index: false, follow: false } };

/** The same page signs people in and up: Google and GitHub create the account on first use. */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string; mode?: string }>;
}) {
  const { next, error, mode } = await searchParams;
  const destination = safeNext(next);
  const config = authConfig();
  const signUp = mode === "signup";
  const open = config.allowList.includes(ALLOW_ANYONE);
  const other = new URLSearchParams({ next: destination });
  if (!signUp) other.set("mode", "signup");

  if (config.mode === "off") redirect(destination);
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (session) redirect(destination);

  return (
    <main className="relative flex min-h-dvh items-center justify-center bg-canvas px-5 py-12">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_70%_45%_at_50%_-10%,rgba(242,140,56,0.16),transparent_70%)]"
      />
      <div className="relative w-full max-w-sm">
        <BrandLockup subtitle="Workbench" />
        <h1 className="mt-8 text-2xl font-semibold tracking-tight text-ink">
          {signUp ? "Create your account" : "Sign in"}
        </h1>
        <p className="mt-2 text-[14px] leading-6 text-dim">
          {signUp
            ? "Continue with Google or GitHub. Your account is created the first time you sign in."
            : "Welcome back. Continue with the account you signed up with."}{" "}
          {open
            ? "Each person can start 10 investigations an hour and 20 a day."
            : "Access is limited to people on the access list; each can start 10 investigations an hour and 20 a day."}
        </p>
        {error ? (
          <p
            role="alert"
            className="mt-5 rounded-md border border-critical/40 bg-critical/10 px-3 py-2 text-[13px] leading-5 text-critical"
          >
            {open
              ? "Sign-in was refused. The provider must share a verified email address; check it in your Google or GitHub settings, then try again."
              : "Sign-in was refused. If this account should have access, ask an administrator to add it to the access list, then try again."}
          </p>
        ) : null}
        <LoginForm
          next={destination}
          google={config.google !== null}
          github={config.github !== null}
          devLogin={config.mode === "dev"}
          submitLabel={signUp ? "Create account" : "Sign in"}
        />
        <p className="mt-5 text-[13px] text-dim">
          {signUp ? "Already have an account? " : "New to Tripwire? "}
          <Link
            href={`/login?${other.toString()}`}
            className="font-medium text-accent underline-offset-4 hover:underline"
          >
            {signUp ? "Sign in" : "Create an account"}
          </Link>
        </p>
        <p className="mt-8 text-[12px] leading-5 text-dim">
          Tripwire runs on synthetic IBM AMLworld data. No real accounts, and no payment is ever
          blocked.
        </p>
      </div>
    </main>
  );
}
