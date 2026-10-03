import { describe, expect, it } from "vitest";
import { CreateHouseInputSchema, CreateReadingInputSchema } from "./index.js";

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
});
