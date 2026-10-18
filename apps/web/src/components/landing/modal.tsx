"use client";

import { X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";

interface ModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}

/**
 * Native modal dialog: the browser provides the focus trap, Escape handling
 * and focus return to the opener.
 */
export function Modal({ open, title, onClose, children }: ModalProps) {
  const ref = useRef<HTMLDialogElement | null>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-label={title}
      onClose={onClose}
      className="m-auto w-[min(92vw,460px)] rounded-card border border-line-strong bg-card p-0 text-ink"
    >
      {open ? (
        <div className="flex flex-col gap-4 p-5">
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-base font-semibold">{title}</h2>
            <button
              type="button"
              aria-label="Close dialog"
              title="Close dialog"
              onClick={onClose}
              className="inline-flex h-8 w-8 items-center justify-center rounded-control text-dim transition-colors hover:bg-hover hover:text-ink"
            >
              <X aria-hidden="true" className="h-4 w-4" />
            </button>
          </div>
          {children}
        </div>
      ) : null}
    </dialog>
  );
}
