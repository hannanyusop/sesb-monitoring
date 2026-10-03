import { describe, expect, it } from "vitest";
import { calculateTieredCharge } from "./calculate.js";

const tiers = [
  { lowerKwh: "0", upperKwh: "200", rateSenPerKwh: "22.02" },
  { lowerKwh: "200", upperKwh: "300", rateSenPerKwh: "37.76" },
  { lowerKwh: "300", upperKwh: "600", rateSenPerKwh: "49.26" },
  { lowerKwh: "600", upperKwh: "1000", rateSenPerKwh: "51.49" },
  { lowerKwh: "1000", upperKwh: "1500", rateSenPerKwh: "54.69" },
  { lowerKwh: "1500", upperKwh: null, rateSenPerKwh: "59.85" },
];

describe("calculateTieredCharge", () => {
  it.each([
    ["0", "0.00"], ["200", "44.04"], ["201", "44.42"],
    ["250", "62.92"], ["300", "81.80"], ["301", "82.29"],
    ["600", "229.58"], ["601", "230.09"], ["1000", "435.54"],
    ["1001", "436.09"], ["1500", "708.99"], ["1501", "709.59"],
  ])("prices %s kWh", (kwh, expected) => {
    expect(calculateTieredCharge(kwh, tiers).displayAmountRm).toBe(expected);
  });

  it("uses half-up monetary rounding", () => {
    expect(calculateTieredCharge("0.25", tiers).displayAmountRm).toBe("0.06");
  });

  it("rejects negative consumption", () => {
    expect(() => calculateTieredCharge("-1", tiers)).toThrow("cannot be negative");
  });
});
