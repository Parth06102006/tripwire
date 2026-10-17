import type { PerformanceSummary } from "../../lib/api";
import { formatCount } from "../../lib/format";
import { Card, CardHeader } from "../ui/card";

function milliseconds(value: number): string {
  return value >= 1000 ? `${(value / 1000).toFixed(2)} s` : `${value.toFixed(2)} ms`;
}

const th = "py-2 pr-4 font-medium";

export default function PerformanceSection({ performance }: { performance: PerformanceSummary }) {
  const queryRows = [
    ["Trace funds", performance.graph_queries.trace_funds],
    ["Inspect counterparties", performance.graph_queries.inspect_counterparties],
    ["Fan-out pattern", performance.graph_queries.fan_out],
    ["Fan-in pattern", performance.graph_queries.fan_in],
    ["Pass-through pattern", performance.graph_queries.pass_through],
  ] as const;
  const measurements = [
    ["Prepared-row model inference", performance.model_inference.single_prepared_row],
    ["Alerts API, 50 rows", performance.api.alerts_limit_50],
    ["Benchmark API", performance.api.benchmarks],
    ["Full investigation API", performance.api.investigation],
  ] as const;

  return (
    <Card aria-label="Recorded runtime measurements">
      <CardHeader
        title="Recorded runtime measurements"
        description={`${performance.measured_on} · ${performance.dataset_label} · ${performance.hardware}`}
      />
      <p className="mb-4 text-xs leading-5 text-dim">
        {performance.execution_mode}. Graph scope: {performance.graph_scope}. These are recorded
        benchmark runs, not live measurements of this deployment.
      </p>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[460px] border-collapse text-left text-xs">
            <caption className="pb-2 text-left text-dim">
              Endpoint and prepared-model latency. API rates are serial, not concurrent capacity.
            </caption>
            <thead>
              <tr className="border-b border-line text-dim">
                <th scope="col" className={th}>Operation</th>
                <th scope="col" className={th}>P50</th>
                <th scope="col" className={th}>P95</th>
                <th scope="col" className="py-2 font-medium">Rate</th>
              </tr>
            </thead>
            <tbody className="font-mono">
              {measurements.map(([label, stats]) => (
                <tr key={label} className="border-b border-line last:border-0">
                  <td className="py-2 pr-4 font-sans">{label}</td>
                  <td className="py-2 pr-4">{milliseconds(stats.p50_ms)}</td>
                  <td className="py-2 pr-4">{milliseconds(stats.p95_ms)}</td>
                  <td className="py-2">
                    {"serial_requests_per_second" in stats
                      ? `${stats.serial_requests_per_second.toFixed(3)} req/s`
                      : "model only"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[380px] border-collapse text-left text-xs">
            <caption className="pb-2 text-left text-dim">Direct FalkorDB query time</caption>
            <thead>
              <tr className="border-b border-line text-dim">
                <th scope="col" className={th}>Query</th>
                <th scope="col" className={th}>P50</th>
                <th scope="col" className="py-2 font-medium">P95</th>
              </tr>
            </thead>
            <tbody className="font-mono">
              {queryRows.map(([label, stats]) => (
                <tr key={label} className="border-b border-line last:border-0">
                  <td className="py-2 pr-4 font-sans">{label}</td>
                  <td className="py-2 pr-4">{milliseconds(stats.p50_ms)}</td>
                  <td className="py-2">{milliseconds(stats.p95_ms)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="mt-4 font-mono text-xs text-dim">
        Full-cohort model throughput:{" "}
        {formatCount(performance.model_inference.full_test_cohort.transactions_per_second)} transactions/s (
        {formatCount(performance.model_inference.full_test_cohort.rows)} rows,{" "}
        {performance.model_inference.full_test_cohort.threads} thread
        {performance.model_inference.full_test_cohort.threads === 1 ? "" : "s"}).
      </p>
      <p className="mt-2 text-xs leading-5 text-dim">
        Cost per 1,000 decisions: {performance.cost.cost_per_1000_decisions}.{" "}
        {performance.cost.external_llm_cost}. Dollar-weighted recall: {performance.cost.dollar_weighted_recall}.
      </p>
    </Card>
  );
}
