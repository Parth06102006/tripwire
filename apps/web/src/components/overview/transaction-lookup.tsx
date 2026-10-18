"use client";

import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function investigationHref(transactionId: string): string {
  return `/investigation/${encodeURIComponent(transactionId)}`;
}

/** Jump straight to an investigation when the analyst already has an ID. */
export function TransactionLookup({ autoFocus = false }: { autoFocus?: boolean }) {
  const router = useRouter();
  const [value, setValue] = useState("");

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const id = value.trim();
    if (id) router.push(investigationHref(id));
  };

  return (
    <form onSubmit={submit} role="search" className="flex w-full max-w-md items-center gap-2">
      <label htmlFor="transaction-lookup" className="sr-only">
        Transaction ID
      </label>
      <div className="relative flex-1">
        <Search
          className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-fg-muted"
          aria-hidden
        />
        <Input
          id="transaction-lookup"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="Open by transaction ID"
          className="pl-8 font-mono text-xs"
          autoComplete="off"
          spellCheck={false}
          autoFocus={autoFocus}
        />
      </div>
      <Button type="submit" disabled={!value.trim()}>
        Investigate
      </Button>
    </form>
  );
}
