import { describe, expect, it } from "vitest";

import { batch, investigation, tx } from "@/test/fixtures";

import { layoutGraph } from "./layout";
import { buildInvestigationGraph, graphCounts, verifiedTransactionIds } from "./model";

describe("buildInvestigationGraph", () => {
  it("models transactions as nodes joined by SENT and RECEIVED edges", () => {
    const graph = buildInvestigationGraph([batch(1, investigation())]);

    expect(graphCounts(graph)).toEqual({ accounts: 3, transactions: 2, edges: 4, paths: 1 });
    expect(graph.edges.get("sent:tx-a")).toMatchObject({
      source: "account:1::A",
      target: "tx:tx-a",
    });
    expect(graph.edges.get("received:tx-a")).toMatchObject({
      source: "tx:tx-a",
      target: "account:2::B",
    });
    const anchor = graph.nodes.get("tx:tx-a");
    expect(anchor?.kind === "transaction" && anchor.isAnchor).toBe(true);
  });

  it("merges a later batch by stable ID and marks only new elements as new", () => {
    const first = investigation();
    const second = investigation({
      evidence: {
        ...first.evidence,
        transactions: [...first.evidence.transactions, tx("tx-c", "3::C", "4::D")],
        accounts: [...first.evidence.accounts, { account_key: "4::D" }],
      },
    });

    const graph = buildInvestigationGraph([batch(1, first), batch(2, second)]);

    expect(graphCounts(graph)).toMatchObject({ accounts: 4, transactions: 3, paths: 1 });
    expect(graph.nodes.get("tx:tx-a")?.firstSeq).toBe(1);
    expect(graph.nodes.get("tx:tx-c")?.firstSeq).toBe(2);
    expect(graph.nodes.get("account:4::D")?.firstSeq).toBe(2);
    expect(graph.latestSeq).toBe(2);
  });

  it("adds accounts referenced by a transaction even when the accounts list omits them", () => {
    const response = investigation();
    const graph = buildInvestigationGraph([{ ...batch(1, response), accounts: [] }]);
    expect(graphCounts(graph).accounts).toBe(3);
  });
});

describe("verifiedTransactionIds", () => {
  it("includes supporting IDs, cited claims and cited paths of a validated report", () => {
    const report = investigation().report;
    if (!report) throw new Error("fixture has a report");
    const ids = verifiedTransactionIds({
      ...report,
      supporting_transaction_ids: ["tx-a"],
      cited_claims: [{ transaction_id: "tx-b" }],
      cited_paths: [{ transaction_ids: ["tx-c"], account_keys: [] }],
    });
    expect([...ids].sort()).toEqual(["tx-a", "tx-b", "tx-c"]);
  });

  it("is empty when there is no report", () => {
    expect(verifiedTransactionIds(null).size).toBe(0);
  });
});

describe("layoutGraph", () => {
  it("is deterministic and keeps earlier positions when a batch adds nodes", () => {
    const first = investigation();
    const second = investigation({
      evidence: {
        ...first.evidence,
        transactions: [...first.evidence.transactions, tx("tx-c", "3::C", "4::D")],
      },
    });

    const firstGraph = buildInvestigationGraph([batch(1, first)]);
    const once = layoutGraph(firstGraph);
    expect([...once.entries()]).toEqual([...layoutGraph(firstGraph).entries()]);

    const merged = layoutGraph(buildInvestigationGraph([batch(1, first), batch(2, second)]), once);
    for (const [id, point] of once) expect(merged.get(id)).toEqual(point);
    expect(merged.has("tx:tx-c")).toBe(true);
    expect(merged.has("account:4::D")).toBe(true);
  });
});
