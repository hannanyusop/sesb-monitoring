import { describe, expect, it } from "vitest";
import {
  BudgetInputSchema,
  CreateHouseInputSchema,
  CreateReadingInputSchema,
  CyclePreviewInputSchema,
  StartCycleInputSchema,
} from "./index.js";

describe("shared contracts", () => {
  it("requires a house and meter label", () => {
    expect(CreateHouseInputSchema.safeParse({ name: "", meterLabel: "" }).success).toBe(false);
  });

  it("accepts decimal strings and offset timestamps", () => {
    const parsed = CreateReadingInputSchema.parse({
      valueKwh: "12345.6",
      captureTimestamp: "2026-10-03T08:30:00+08:00",
    });
    expect(parsed.valueKwh).toBe("12345.6");
  });

  it("rejects JavaScript numbers for persisted decimals", () => {
    expect(CreateReadingInputSchema.safeParse({
      valueKwh: 12345.6,
      captureTimestamp: "2026-10-03T08:30:00+08:00",
    }).success).toBe(false);
  });

  it("requires a custom starting reading in custom cycle mode", () => {
    expect(CyclePreviewInputSchema.safeParse({
      mode: "CUSTOM",
      startTimestamp: "2026-10-03T08:30:00+08:00",
    }).success).toBe(false);
    expect(StartCycleInputSchema.parse({
      mode: "CUSTOM",
      startTimestamp: "2026-10-03T08:30:00+08:00",
      customStartKwh: "13000",
      acknowledgedGap: true,
    }).customStartKwh).toBe("13000");
  });

  it("accepts positive kWh or RM budgets and an explicit removal", () => {
    expect(BudgetInputSchema.parse({ type: "KWH", value: "450" })).toEqual({ type: "KWH", value: "450" });
    expect(BudgetInputSchema.parse({ type: "RM", value: "180.50" })).toEqual({ type: "RM", value: "180.50" });
    expect(BudgetInputSchema.parse({ type: null, value: null })).toEqual({ type: null, value: null });
    expect(BudgetInputSchema.safeParse({ type: "RM", value: "0" }).success).toBe(false);
  });
});
