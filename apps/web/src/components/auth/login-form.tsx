"use client";

import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { authClient } from "@/lib/auth/client";

type Provider = "google" | "github";

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
      <path
        fill="currentColor"
        d="M21.35 11.1H12v2.98h5.35c-.23 1.4-1.6 4.1-5.35 4.1a5.96 5.96 0 1 1 0-11.92c1.9 0 3.17.8 3.9 1.5l2.66-2.57C16.9 3.6 14.7 2.6 12 2.6a9.4 9.4 0 1 0 0 18.8c5.43 0 9.03-3.82 9.03-9.2 0-.62-.07-1.1-.16-1.1z"
      />
    </svg>
  );
}

function GithubMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-4 fill-current" aria-hidden>
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0 0 22 12.017C22 6.484 17.522 2 12 2z"
      />
    </svg>
  );
}

export function LoginForm({
  next,
  google,
  github,
  devLogin,
  submitLabel = "Sign in",
}: {
  next: string;
  google: boolean;
  github: boolean;
  devLogin: boolean;
  /** "Sign in" or "Create account": the same flow, worded for the page it is on. */
  submitLabel?: string;
}) {
  const [busy, setBusy] = useState<Provider | "dev" | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const social = async (provider: Provider) => {
    setBusy(provider);
    setProblem(null);
    const { error } = await authClient.signIn.social({
      provider,
      callbackURL: next,
      errorCallbackURL: `/login?error=1&next=${encodeURIComponent(next)}`,
    });
    // On success the browser is already leaving for the provider.
    if (error) {
      setProblem(error.message ?? "Sign-in could not be started.");
      setBusy(null);
    }
  };

  const devSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "");
    const password = String(form.get("password") ?? "");
    setBusy("dev");
    setProblem(null);
    let failure = (await authClient.signIn.email({ email, password })).error;
    if (failure) {
      // Local convenience: the first sign-in with a new address creates it.
      failure = (
        await authClient.signUp.email({ email, password, name: email.split("@")[0] ?? email })
      ).error;
    }
    if (failure) {
      setProblem(failure.message ?? "Sign-in failed.");
      setBusy(null);
      return;
    }
    window.location.href = next;
  };

  return (
    <div className="mt-6 space-y-3">
      {google ? (
        <Button
          type="button"
          variant="secondary"
          className="h-10 w-full text-[14px]"
          disabled={busy !== null}
          onClick={() => social("google")}
        >
          <GoogleMark /> Continue with Google
        </Button>
      ) : null}
      {github ? (
        <Button
          type="button"
          variant="secondary"
          className="h-10 w-full text-[14px]"
          disabled={busy !== null}
          onClick={() => social("github")}
        >
          <GithubMark /> Continue with GitHub
        </Button>
      ) : null}

      {devLogin ? (
        <form
          onSubmit={devSubmit}
          className="space-y-3 border-t border-border pt-4"
          aria-label="Development sign-in"
        >
          <p className="text-[12px] text-warning">
            Development sign-in. Not available in production.
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="dev-email">Email</Label>
            <Input id="dev-email" name="email" type="email" required autoComplete="email" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dev-password">Password</Label>
            <Input
              id="dev-password"
              name="password"
              type="password"
              required
              minLength={8}
              autoComplete="current-password"
            />
          </div>
          <Button type="submit" variant="primary" className="h-10 w-full" disabled={busy !== null}>
            {submitLabel}
          </Button>
        </form>
      ) : null}

      {problem ? (
        <p role="alert" className="text-[13px] text-critical">
          {problem}
        </p>
      ) : null}
      {!google && !github && !devLogin ? (
        <p className="text-[13px] text-warning">No sign-in method is configured on this server.</p>
      ) : null}
    </div>
  );
}
