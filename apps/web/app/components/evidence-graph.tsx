"use client";

import cytoscape from "cytoscape";
import type { ElementDefinition } from "cytoscape";
import { useEffect, useRef } from "react";
import type { InvestigationEvidence } from "../lib/api";

export interface SelectedElement {
  kind: "account" | "transaction";
  id: string;
}

interface EvidenceGraphProps {
  evidence: InvestigationEvidence;
  /** Changes when a new investigation payload arrives; rebuilds the canvas. */
  resetKey: string;
  onSelect: (selection: SelectedElement | null) => void;
}

function buildElements(evidence: InvestigationEvidence): ElementDefinition[] {
  const elements: ElementDefinition[] = [];
  const seen = new Set<string>();
  const evidenceTxIds = new Set<string>();
  const evidenceAccountKeys = new Set<string>();
  for (const path of evidence.paths) {
    for (const id of path.transaction_ids) evidenceTxIds.add(id);
    for (const key of path.account_keys) evidenceAccountKeys.add(key);
  }

  const addNode = (
    id: string,
    label: string,
    kind: "account" | "transaction",
    highlighted: boolean,
  ) => {
    if (seen.has(id)) return;
    seen.add(id);
    elements.push({
      data: { id, label, kind, highlighted: highlighted ? 1 : 0 },
    });
  };

  for (const account of evidence.accounts) {
    addNode(
      `acc:${account.account_key}`,
      account.account_key,
      "account",
      evidenceAccountKeys.has(account.account_key),
    );
  }
  for (const tx of evidence.transactions) {
    const highlighted = evidenceTxIds.has(tx.transaction_id);
    addNode(`tx:${tx.transaction_id}`, tx.transaction_id, "transaction", highlighted);
    addNode(`acc:${tx.source_account_key}`, tx.source_account_key, "account", evidenceAccountKeys.has(tx.source_account_key));
    addNode(
      `acc:${tx.destination_account_key}`,
      tx.destination_account_key,
      "account",
      evidenceAccountKeys.has(tx.destination_account_key),
    );
    const edgeId = (from: string, to: string, relation: string) =>
      `edge:${relation}:${from}->${to}:${highlighted ? 1 : 0}`;
    elements.push({
      data: {
        id: edgeId(`acc:${tx.source_account_key}`, `tx:${tx.transaction_id}`, "SENT"),
        source: `acc:${tx.source_account_key}`,
        target: `tx:${tx.transaction_id}`,
        relation: "SENT",
        highlighted: highlighted ? 1 : 0,
      },
    });
    elements.push({
      data: {
        id: edgeId(`tx:${tx.transaction_id}`, `acc:${tx.destination_account_key}`, "RECEIVED"),
        source: `tx:${tx.transaction_id}`,
        target: `acc:${tx.destination_account_key}`,
        relation: "RECEIVED",
        highlighted: highlighted ? 1 : 0,
      },
    });
  }
  return elements;
}

export default function EvidenceGraph({ evidence, resetKey, onSelect }: EvidenceGraphProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const cy = cytoscape({
      container,
      elements: buildElements(evidence),
      layout: { name: "cose", animate: false, fit: true, padding: 24 },
      minZoom: 0.2,
      maxZoom: 3,
      style: [
        {
          selector: "node",
          style: {
            "background-color": "#292936",
            "border-width": 1,
            "border-color": "#9693A8",
            label: "data(label)",
            color: "#F2F0F8",
            "font-size": 9,
            "text-wrap": "ellipsis",
            "text-max-width": "120px",
            width: 28,
            height: 28,
          },
        },
        {
          selector: 'node[kind = "transaction"]',
          style: { shape: "diamond", "background-color": "#191923" },
        },
        {
          selector: 'node[highlighted = 1]',
          style: {
            "background-color": "#B68CFF",
            "border-color": "#C7A9FF",
            "border-width": 2,
          },
        },
        {
          selector: "edge",
          style: {
            width: 1,
            "line-color": "#3a3a4d",
            "target-arrow-shape": "triangle",
            "target-arrow-color": "#3a3a4d",
            "curve-style": "bezier",
            label: "data(relation)",
            color: "#9693A8",
            "font-size": 8,
          },
        },
        {
          selector: 'edge[highlighted = 1]',
          style: {
            width: 2.5,
            "line-color": "#F4B860",
            "target-arrow-color": "#F4B860",
          },
        },
        {
          selector: ":selected",
          style: {
            "border-color": "#F2F0F8",
            "border-width": 2,
          },
        },
      ],
    });
    cy.on("tap", "node", (event) => {
      const node = event.target;
      const kind = node.data("kind") as "account" | "transaction";
      const rawId = node.id() as string;
      onSelect({
        kind,
        id: rawId.replace(/^(acc|tx):/, ""),
      });
    });
    cy.on("tap", (event) => {
      if (event.target === cy) onSelect(null);
    });
    return () => {
      cy.destroy();
    };
  }, [resetKey, evidence, onSelect]);

  return (
    <div className="flex flex-col gap-2">
      <div
        ref={containerRef}
        role="img"
        aria-label="Graph canvas of returned evidence. Use the transaction table below for an equivalent text listing."
        className="h-[420px] w-full rounded-lg border border-[#292936] bg-[#0B0B10]"
      />
      <ul aria-label="Graph legend" className="flex flex-wrap gap-4 text-xs text-[#9693A8]">
        <li className="flex items-center gap-1.5">
          <span aria-hidden="true" className="inline-block h-3 w-3 rounded-full bg-[#292936] ring-1 ring-[#9693A8]" />
          Account
        </li>
        <li className="flex items-center gap-1.5">
          <span aria-hidden="true" className="inline-block h-3 w-3 rotate-45 bg-[#191923] ring-1 ring-[#9693A8]" />
          Transaction
        </li>
        <li className="flex items-center gap-1.5">
          <span aria-hidden="true" className="inline-block h-3 w-3 rounded-full bg-[#B68CFF]" />
          Returned evidence path
        </li>
      </ul>
    </div>
  );
}
