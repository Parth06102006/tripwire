import { describe, expect, it } from "vitest";

import { activeFilterCount, DEFAULT_DRAFT, EMPTY_DRAFT, resolveFilters } from "./alert-filters";

describe("resolveFilters", () => {
  it("sends nothing for an empty draft", () => {
    const { params, problems } = resolveFilters(EMPTY_DRAFT);
    expect(params).toEqual({});
    expect(problems).toEqual({ score: null, date: null });
    expect(activeFilterCount(params)).toBe(0);
  });

  it("defaults to flagged_for_review in DEFAULT_DRAFT", () => {
    const { params, problems } = resolveFilters(DEFAULT_DRAFT);
    expect(params.routes).toEqual(["flagged_for_review"]);
    expect(problems).toEqual({ score: null, date: null });
    expect(activeFilterCount(params)).toBe(1);
  });

  it("keeps routes in queue order and trims the text", () => {
    const { params } = resolveFilters({
      ...EMPTY_DRAFT,
      routes: ["standard_path", "blocked_by_rule"],
      text: "  tx-12  ",
    });
    expect(params.routes).toEqual(["blocked_by_rule", "standard_path"]);
    expect(params.text).toBe("tx-12");
    expect(activeFilterCount(params)).toBe(2);
  });

  it("accepts one-sided score and date ranges", () => {
    const { params } = resolveFilters({ ...EMPTY_DRAFT, minScore: "0.5", dateTo: "2022-09-10" });
    expect(params).toEqual({ minScore: 0.5, dateTo: "2022-09-10" });
    expect(activeFilterCount(params)).toBe(2);
  });

  it.each([
    ["not a number", { minScore: "abc" }],
    ["above one", { maxScore: "1.5" }],
    ["below zero", { minScore: "-0.1" }],
    ["inverted", { minScore: "0.9", maxScore: "0.2" }],
  ])("leaves out a score range that is %s", (_name, fields) => {
    const { params, problems } = resolveFilters({ ...EMPTY_DRAFT, ...fields });
    expect(params.minScore).toBeUndefined();
    expect(params.maxScore).toBeUndefined();
    expect(problems.score).not.toBeNull();
  });

  it("leaves out an inverted date range", () => {
    const { params, problems } = resolveFilters({
      ...EMPTY_DRAFT,
      dateFrom: "2022-09-10",
      dateTo: "2022-09-01",
    });
    expect(params.dateFrom).toBeUndefined();
    expect(problems.date).toBe("The start date is after the end date.");
  });
});
