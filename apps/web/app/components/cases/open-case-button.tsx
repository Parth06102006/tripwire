"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { FolderPlus } from "lucide-react";
import Link from "next/link";
import type { Route } from "next";
import { useState } from "react";
import { ApiError, postCase, type CaseItem } from "../../lib/api";
import { useAnalystId } from "../../lib/analyst";
import { Button, Field, TextInput } from "../ui/controls";
import { Modal } from "../ui/modal";

/**
 * Opens a suspected case. A suspected case is not a fraud determination: only
 * an explicit confirm in Cases promotes it.
 */
export default function OpenCaseButton({ transactionId }: { transactionId: string }) {
  const [open, setOpen] = useState(false);
  const [analyst, setAnalyst] = useAnalystId();
  const [notes, setNotes] = useState("");
  const queryClient = useQueryClient();
  const mutation = useMutation<CaseItem, Error, void>({
    mutationFn: () =>
      postCase({
        transaction_id: transactionId,
        opened_by: analyst.trim(),
        notes: notes.trim() || null,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["cases"] });
      void queryClient.invalidateQueries({ queryKey: ["case"] });
    },
  });

  const close = () => {
    setOpen(false);
    mutation.reset();
  };

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <FolderPlus aria-hidden="true" className="h-3.5 w-3.5" />
        Open case
      </Button>
      <Modal open={open} title="Open a suspected case" onClose={close}>
        {mutation.isSuccess ? (
          <div className="flex flex-col gap-3 text-sm">
            <p>
              Case <span className="font-mono">{mutation.data.case_id}</span> opened as{" "}
              <span className="font-mono">{mutation.data.status}</span>.
            </p>
            <div className="flex gap-2">
              <Link
                href={`/cases?case=${encodeURIComponent(mutation.data.case_id)}` as Route}
                className="rounded-control bg-accent px-3 py-1.5 text-xs font-semibold text-accent-ink"
              >
                Go to case
              </Link>
              <Button onClick={close}>Close</Button>
            </div>
          </div>
        ) : (
          <form
            className="flex flex-col gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              mutation.mutate();
            }}
          >
            <p className="text-xs leading-5 text-dim">
              Opens a case for <span className="font-mono text-ink">{transactionId}</span> with status
              suspected. It records who opened it and does not confirm fraud.
            </p>
            <Field label="Analyst identifier" hint="Recorded in the case history. Stored in this browser only.">
              <TextInput
                required
                maxLength={64}
                value={analyst}
                onChange={(event) => setAnalyst(event.target.value)}
              />
            </Field>
            <Field label="Notes (optional)">
              <TextInput maxLength={4000} value={notes} onChange={(event) => setNotes(event.target.value)} />
            </Field>
            {mutation.isError ? (
              <p role="alert" className="text-xs text-critical">
                {mutation.error instanceof ApiError ? mutation.error.detail : "Could not open the case."}
              </p>
            ) : null}
            <div className="flex justify-end gap-2">
              <Button onClick={close}>Cancel</Button>
              <Button type="submit" variant="primary" disabled={mutation.isPending || analyst.trim() === ""}>
                {mutation.isPending ? "Opening" : "Open case"}
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}
