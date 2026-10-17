"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useId, useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { ErrorState } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Input, Label, Textarea } from "@/components/ui/input";
import { useOpenCase, useReviewCase } from "@/hooks/use-cases";
import { describeApiError } from "@/lib/api-client";

// The analyst ID is a convenience default for the next form, nothing more.
const ANALYST_KEY = "traceaml.analyst-id";

function readAnalystId(): string {
  try {
    return window.localStorage.getItem(ANALYST_KEY) ?? "";
  } catch {
    return "";
  }
}

function rememberAnalystId(value: string) {
  try {
    window.localStorage.setItem(ANALYST_KEY, value);
  } catch {
    // Storage can be unavailable (private mode); the form still works.
  }
}

const optionalText = (max: number) =>
  z
    .string()
    .max(max, `Keep this under ${max} characters`)
    .transform((value) => (value.trim() ? value.trim() : null));

const analystId = z
  .string()
  .trim()
  .min(1, "Enter your analyst ID")
  .max(64, "At most 64 characters");

const openSchema = z.object({ opened_by: analystId, notes: optionalText(4000) });
type OpenInput = z.input<typeof openSchema>;
type OpenOutput = z.output<typeof openSchema>;

const reviewSchema = z.object({
  reviewer_id: analystId,
  pattern_type: optionalText(64),
  notes: optionalText(4000),
});
type ReviewInput = z.input<typeof reviewSchema>;
type ReviewOutput = z.output<typeof reviewSchema>;

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="mt-1 text-[11px] text-critical">
      {message}
    </p>
  );
}

export function OpenCaseDialog({
  transactionId,
  trigger,
}: {
  transactionId: string;
  trigger: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const mutation = useOpenCase();
  const ids = { analyst: useId(), notes: useId() };
  const form = useForm<OpenInput, unknown, OpenOutput>({
    resolver: zodResolver(openSchema),
    defaultValues: { opened_by: "", notes: "" },
  });

  const submit = form.handleSubmit(async (values) => {
    try {
      const item = await mutation.mutateAsync({ transaction_id: transactionId, ...values });
      rememberAnalystId(values.opened_by);
      toast.success("Case opened", {
        description: `${item.case_id} is suspected and waiting for review.`,
      });
      setOpen(false);
    } catch {
      // The error is rendered in the dialog from mutation state.
    }
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          mutation.reset();
          form.reset({ opened_by: readAnalystId(), notes: "" });
        }
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent
        title="Open a case"
        description="Opens a suspected case for this transaction under your analyst ID. Only a later confirm or dismiss changes its status."
      >
        <form onSubmit={submit} className="space-y-3" noValidate>
          <div>
            <Label htmlFor={ids.analyst}>Analyst ID</Label>
            <Input
              id={ids.analyst}
              className="mt-1"
              autoComplete="off"
              aria-invalid={Boolean(form.formState.errors.opened_by)}
              aria-describedby={`${ids.analyst}-error`}
              {...form.register("opened_by")}
            />
            <FieldError
              id={`${ids.analyst}-error`}
              message={form.formState.errors.opened_by?.message}
            />
          </div>
          <div>
            <Label htmlFor={ids.notes}>Notes (optional)</Label>
            <Textarea id={ids.notes} className="mt-1" {...form.register("notes")} />
            <FieldError id={`${ids.notes}-error`} message={form.formState.errors.notes?.message} />
          </div>
          {mutation.isError ? (
            <ErrorState
              title="The case was not opened"
              message={describeApiError(mutation.error)}
            />
          ) : null}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={mutation.isPending}>
              {mutation.isPending ? "Opening" : "Open case"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ReviewCaseDialog({
  caseId,
  action,
  trigger,
}: {
  caseId: string;
  action: "confirm" | "dismiss";
  trigger: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const mutation = useReviewCase();
  const ids = { reviewer: useId(), pattern: useId(), notes: useId() };
  const form = useForm<ReviewInput, unknown, ReviewOutput>({
    resolver: zodResolver(reviewSchema),
    defaultValues: { reviewer_id: "", pattern_type: "", notes: "" },
  });
  const verb = action === "confirm" ? "Confirm" : "Dismiss";

  const submit = form.handleSubmit(async (values) => {
    try {
      await mutation.mutateAsync({ caseId, request: { action, ...values } });
      rememberAnalystId(values.reviewer_id);
      toast.success(action === "confirm" ? "Case confirmed" : "Case dismissed", {
        description: `${caseId} now records your decision.`,
      });
      setOpen(false);
    } catch {
      // Rendered from mutation state.
    }
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          mutation.reset();
          form.reset({ reviewer_id: readAnalystId(), pattern_type: "", notes: "" });
        }
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent
        title={`${verb} case`}
        description={
          action === "confirm"
            ? "Confirming promotes this case to confirmed memory. The decision is final and recorded with your ID."
            : "Dismissing closes this case. The history and audit record are kept, and a new case can be opened later."
        }
      >
        <form onSubmit={submit} className="space-y-3" noValidate>
          <div>
            <Label htmlFor={ids.reviewer}>Reviewer ID</Label>
            <Input
              id={ids.reviewer}
              className="mt-1"
              autoComplete="off"
              aria-invalid={Boolean(form.formState.errors.reviewer_id)}
              aria-describedby={`${ids.reviewer}-error`}
              {...form.register("reviewer_id")}
            />
            <FieldError
              id={`${ids.reviewer}-error`}
              message={form.formState.errors.reviewer_id?.message}
            />
          </div>
          {action === "confirm" ? (
            <div>
              <Label htmlFor={ids.pattern}>Pattern you identified (optional)</Label>
              <Input
                id={ids.pattern}
                className="mt-1"
                placeholder="For example fan-out"
                {...form.register("pattern_type")}
              />
              <FieldError
                id={`${ids.pattern}-error`}
                message={form.formState.errors.pattern_type?.message}
              />
            </div>
          ) : null}
          <div>
            <Label htmlFor={ids.notes}>Notes (optional)</Label>
            <Textarea id={ids.notes} className="mt-1" {...form.register("notes")} />
            <FieldError id={`${ids.notes}-error`} message={form.formState.errors.notes?.message} />
          </div>
          {mutation.isError ? (
            <ErrorState
              title={`The case was not ${action === "confirm" ? "confirmed" : "dismissed"}`}
              message={describeApiError(mutation.error)}
            />
          ) : null}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant={action === "confirm" ? "danger" : "secondary"}
              disabled={mutation.isPending}
            >
              {mutation.isPending ? `${verb}ing` : `${verb} case`}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
