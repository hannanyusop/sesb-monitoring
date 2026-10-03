import { describe, expect, it } from "vitest";
import { allocateEstimatedDailyUsage, calculateBudgetProgress, calculateComparison } from "./insights.js";

describe("estimated daily usage", () => {
  it("distributes an interval over Kuching calendar days", () => {
    const result = allocateEstimatedDailyUsage([
      { valueKwh: "100", captureTimestamp: "2026-09-01T16:00:00Z" },
      { valueKwh: "130", captureTimestamp: "2026-09-04T08:00:00Z" },
    ]);
    expect(result.points.map((point) => [point.date, point.displayUsageKwh])).toEqual([
      ["2026-09-03", "15.00"], ["2026-09-04", "15.00"],
    ]);
    expect(result.averageDailyKwh).toBe("15");
  });

  it("assigns same-day usage to that local date", () => {
    expect(allocateEstimatedDailyUsage([
      { valueKwh: "10", captureTimestamp: "2026-09-01T01:00:00Z" },
      { valueKwh: "12.5", captureTimestamp: "2026-09-01T04:00:00Z" },
    ]).points[0]).toMatchObject({ date: "2026-09-01", usageKwh: "2.5" });
  });

  it("returns an empty result with fewer than two readings", () => {
    expect(allocateEstimatedDailyUsage([])).toMatchObject({ points: [], representedDays: 0, averageDailyKwh: "0" });
  });
});

describe("budget progress", () => {
  it("reports green, amber, and over-budget states", () => {
    expect(calculateBudgetProgress("KWH", "100", "20", "0").state).toBe("green");
    expect(calculateBudgetProgress("KWH", "100", "70", "0").state).toBe("amber");
    expect(calculateBudgetProgress("RM", "50", "0", "55")).toMatchObject({ state: "red", overBudget: true, percentUsed: "110" });
  });
});

describe("comparison", () => {
  it("returns null percent for a zero baseline", () => expect(calculateComparison("10", "0").percentChange).toBeNull());
  it("returns signed change", () => expect(calculateComparison("75", "100")).toMatchObject({ difference: "-25", percentChange: "-25" }));
});
