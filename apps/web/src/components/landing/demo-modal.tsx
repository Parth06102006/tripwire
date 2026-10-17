"use client";

import { useState } from "react";
import { CheckCircle2, ArrowRight } from "lucide-react";
import { Modal } from "./modal";

interface DemoModalProps {
  open: boolean;
  onClose: () => void;
}

export function DemoModal({ open, onClose }: DemoModalProps) {
  const [submitted, setSubmitted] = useState<boolean>(false);
  const [name, setName] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [org, setOrg] = useState<string>("");
  const [tier, setTier] = useState<string>("10m-100m");
  const [deployment, setDeployment] = useState<string>("vpc");

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
      title={submitted ? "Demo Requested" : "Request a Demo of Tripwire"}
      onClose={onClose}
    >
      {submitted ? (
        <div className="flex flex-col items-center py-4 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-safe/10 text-safe ring-1 ring-safe/30">
            <CheckCircle2 aria-hidden="true" className="h-6 w-6" />
          </div>
          <h3 className="mt-4 text-[17px] font-semibold text-white">Briefing scheduled</h3>
          <p className="mt-2 max-w-sm text-[13px] leading-6 text-dim">
            Thank you, <span className="font-medium text-white">{name || "Analyst"}</span>. Our
            financial crime intelligence engineering team will contact{" "}
            <span className="font-medium text-accent">{email}</span> within 4 business hours with
            replay sandbox credentials.
          </p>

          <div className="mt-6 flex w-full flex-col gap-2.5">
            <a
              href="/overview"
              className="inline-flex items-center justify-center gap-2 rounded-control bg-accent px-4 py-2 text-[13px] font-semibold text-accent-ink hover:brightness-110"
            >
              Explore Live Workbench Now
              <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
            </a>
            <button
              type="button"
              onClick={handleReset}
              className="rounded-control border border-line px-4 py-2 text-[12px] text-dim hover:text-white"
            >
              Close
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <p className="text-[12px] leading-5 text-dim">
            See how Tripwire executes bounded Cypher investigations over IBM AMLworld data with zero
            LLM hallucination.
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5 text-xs text-dim">
              <label htmlFor="demo-name" className="font-medium text-ink">
                Full name
              </label>
              <input
                id="demo-name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Jane Doe"
                className="w-full rounded-control border border-line-strong bg-raised px-3 py-1.5 text-xs text-ink outline-none placeholder:text-dim/60 focus:border-accent"
              />
            </div>

            <div className="flex flex-col gap-1.5 text-xs text-dim">
              <label htmlFor="demo-email" className="font-medium text-ink">
                Work email
              </label>
              <input
                id="demo-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="jane@bank.com"
                className="w-full rounded-control border border-line-strong bg-raised px-3 py-1.5 text-xs text-ink outline-none placeholder:text-dim/60 focus:border-accent"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5 text-xs text-dim">
            <label htmlFor="demo-org" className="font-medium text-ink">
              Institution or firm
            </label>
            <input
              id="demo-org"
              required
              value={org}
              onChange={(e) => setOrg(e.target.value)}
              placeholder="e.g. Tier-1 Commercial Bank, Digital Bank, or FIU"
              className="w-full rounded-control border border-line-strong bg-raised px-3 py-1.5 text-xs text-ink outline-none placeholder:text-dim/60 focus:border-accent"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5 text-xs text-dim">
              <label htmlFor="demo-volume" className="font-medium text-ink">
                Monthly transactions
              </label>
              <select
                id="demo-volume"
                value={tier}
                onChange={(e) => setTier(e.target.value)}
                className="w-full rounded-control border border-line-strong bg-raised px-3 py-1.5 text-xs text-ink outline-none focus:border-accent"
              >
                <option value="under-1m">&lt; 1M tx / month</option>
                <option value="1m-10m">1M – 10M tx / month</option>
                <option value="10m-100m">10M – 100M tx / month</option>
                <option value="over-100m">100M+ tx / month</option>
              </select>
            </div>

            <div className="flex flex-col gap-1.5 text-xs text-dim">
              <label htmlFor="demo-deploy" className="font-medium text-ink">
                Target deployment
              </label>
              <select
                id="demo-deploy"
                value={deployment}
                onChange={(e) => setDeployment(e.target.value)}
                className="w-full rounded-control border border-line-strong bg-raised px-3 py-1.5 text-xs text-ink outline-none focus:border-accent"
              >
                <option value="vpc">Private Cloud / VPC</option>
                <option value="airgap">Air-Gapped On-Premises</option>
                <option value="falkor">FalkorDB Dedicated Cluster</option>
              </select>
            </div>
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
              Submit Request
              <ArrowRight aria-hidden="true" className="h-3 w-3" />
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
