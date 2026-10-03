import { describe, expect, it } from "vitest";
import { formatKuchingDateTime, fromKuchingInput, kuchingInputParts } from "./datetime.js";

describe("Kuching date helpers", () => {
  it("creates local input parts independently of machine timezone", () => {
    expect(kuchingInputParts(new Date("2026-10-03T00:30:00Z"))).toEqual({ date: "2026-10-03", time: "08:30" });
  });

  it("converts local inputs to an absolute timestamp", () => {
    expect(fromKuchingInput("2026-09-02", "09:30")).toBe("2026-09-02T01:30:00.000Z");
  });

  it("formats a timestamp in Asia/Kuching", () => {
    expect(formatKuchingDateTime("2026-10-03T00:30:00Z")).toContain("8:30");
  });
});
