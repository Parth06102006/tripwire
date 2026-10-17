import { describe, expect, it } from "vitest";

import { batch, investigation } from "@/test/fixtures";

import {
  highlightFor,
  highlightStyles,
  toFlowEdges,
  toFlowNodes,
  withLabels,
  type Selection,
} from "./flow";
import { layoutGraph } from "./layout";
import { buildInvestigationGraph } from "./model";

const graph = buildInvestigationGraph([batch(1, investigation())]);
const positions = layoutGraph(buildInvestigationGraph([batch(1, investigation())]));
const paths = new Map(graph.paths.map((p) => [p.id, p]));
const highlight = (selection: Selection) => highlightFor(graph, selection, paths);

describe("toFlowNodes", () => {
  const nodes = toFlowNodes({ graph, positions, verifiedIds: new Set(["tx-b"]) });

  it("renders the anchor as an alert node and flags verified evidence", () => {
    expect(nodes.find((n) => n.id === "tx:tx-a")?.type).toBe("alert");
    const verified = nodes.find((n) => n.id === "tx:tx-b");
    expect(verified?.type).toBe("transaction");
    expect(verified?.data).toMatchObject({ verified: true });
  });

  it("declares fixed node sizes so React Flow does not need to re-measure", () => {
    for (const node of nodes) {
      expect(node.measured?.width).toBe(node.width);
      expect(node.measured?.height).toBe(node.height);
    }
  });
});

describe("selection emphasis", () => {
  const base = toFlowEdges(graph);

  it("focuses every element of a selected path without labelling edges", () => {
    const selected = highlight({ kind: "path", id: graph.paths[0]?.id ?? "" });
    expect(withLabels(base, selected)).toBe(base);
    const css = highlightStyles("[s]", selected);
    for (const id of ["sent:tx-a", "received:tx-a", "sent:tx-b", "received:tx-b"]) {
      expect(css).toContain(`.react-flow__edge[data-id="${id}"] .react-flow__edge-path`);
    }
  });

  it("labels only the two edges of a selected transaction and keeps other edges identical", () => {
    const edges = withLabels(base, highlight({ kind: "node", id: "tx:tx-a" }));
    expect(
      edges
        .filter((e) => e.data?.labelled)
        .map((e) => e.id)
        .sort(),
    ).toEqual(["received:tx-a", "sent:tx-a"]);
    const untouched = edges.find((e) => e.id === "sent:tx-b");
    expect(untouched).toBe(base.find((e) => e.id === "sent:tx-b"));
  });

  it("styles node emphasis by data-id and leaves no stylesheet without a selection", () => {
    expect(highlightStyles("[s]", highlight(null))).toBe("");
    const css = highlightStyles("[s]", highlight({ kind: "node", id: "tx:tx-a" }));
    expect(css).toContain("[s] .react-flow__node { opacity: 0.3; }");
    expect(css).toContain('.react-flow__node[data-id="tx:tx-a"]');
    expect(css).toContain('.react-flow__node[data-id="account:1::A"]');
    expect(css).not.toContain('.react-flow__node[data-id="sent:');
  });
});
