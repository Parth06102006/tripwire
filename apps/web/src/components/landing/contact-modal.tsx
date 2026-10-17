"use client";

import { useState } from "react";
import { CheckCircle2, ArrowRight } from "lucide-react";
import { Modal } from "./modal";

interface ContactModalProps {
  open: boolean;
  onClose: () => void;
}

export function ContactModal({ open, onClose }: ContactModalProps) {
  const [submitted, setSubmitted] = useState<boolean>(false);
  const [email, setEmail] = useState<string>("");
  const [message, setMessage] = useState<string>("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  const handleReset = () => {
    setSubmitted(false);
    onClose();
  };

  return (
    <Modal
      open={open}
      title={submitted ? "Message Received" : "Contact the Tripwire Team"}
      onClose={onClose}
    >
      {submitted ? (
        <div className="flex flex-col items-center py-4 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-safe/10 text-safe ring-1 ring-safe/30">
            <CheckCircle2 aria-hidden="true" className="h-6 w-6" />
          </div>
          <h3 className="mt-4 text-[17px] font-semibold text-white">Inquiry dispatched</h3>
          <p className="mt-2 max-w-sm text-[13px] leading-6 text-dim">
            Thank you. An engineering owner from the TraceAML architecture group will reply to{" "}
            <span className="font-medium text-accent">{email}</span> within 24 hours.
          </p>
          <button
            type="button"
            onClick={handleReset}
            className="mt-6 rounded-control border border-line px-4 py-2 text-[12px] text-white hover:bg-white/[0.04]"
          >
            Dismiss
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <p className="text-[12px] leading-5 text-dim">
            Direct channel to Tripwire’s frontend, FalkorDB engineering, ML evaluation and backend
            team.
          </p>

          <div className="flex flex-col gap-1.5 text-xs text-dim">
            <label htmlFor="contact-email" className="font-medium text-ink">
              Your email address
            </label>
            <input
              id="contact-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="analyst@organization.org"
              className="w-full rounded-control border border-line-strong bg-raised px-3 py-1.5 text-xs text-ink outline-none placeholder:text-dim/60 focus:border-accent"
            />
          </div>

          <div className="flex flex-col gap-1.5 text-xs text-dim">
            <label htmlFor="contact-message" className="font-medium text-ink">
              Message or inquiry
            </label>
            <textarea
              id="contact-message"
              required
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Tell us about your AML evaluation cohort, topology requirements, or deployment queries..."
              className="w-full resize-none rounded-control border border-line-strong bg-raised px-3 py-2 text-xs text-ink outline-none placeholder:text-dim/60 focus:border-accent"
            />
          </div>

          <div className="mt-2 flex items-center justify-end gap-3 border-t border-line pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-control px-3.5 py-1.5 text-xs text-dim hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-control bg-accent px-4 py-1.5 text-xs font-semibold text-accent-ink shadow-sm hover:brightness-110"
            >
              Send Message
              <ArrowRight aria-hidden="true" className="h-3 w-3" />
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
