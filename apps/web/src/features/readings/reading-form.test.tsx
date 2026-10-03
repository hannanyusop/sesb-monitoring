import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiClientError } from "../../lib/api.js";
import { ReadingForm } from "./reading-form.js";

afterEach(() => vi.useRealTimers());

describe("ReadingForm", () => {
  it("submits an explicit backdated date and time", async () => {
    vi.useFakeTimers({ now: new Date("2026-10-03T04:00:00Z"), shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<ReadingForm onSave={onSave} />);
    await user.click(screen.getByLabelText("Backdate reading"));
    await user.clear(screen.getByLabelText("Reading date"));
    await user.type(screen.getByLabelText("Reading date"), "2026-09-02");
    await user.clear(screen.getByLabelText("Reading time"));
    await user.type(screen.getByLabelText("Reading time"), "09:30");
    await user.type(screen.getByLabelText("Meter reading (kWh)"), "1100");
    await user.click(screen.getByRole("button", { name: "Save reading" }));
    expect(onSave).toHaveBeenCalledWith({ valueKwh: "1100", captureTimestamp: "2026-09-02T01:30:00.000Z" });
  });

  it("preserves values after an API validation error", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockRejectedValue(new ApiClientError(422, "READING_SEQUENCE_INVALID", "Reading does not fit", { valueKwh: "Enter at least 1000 kWh" }));
    render(<ReadingForm onSave={onSave} />);
    await user.type(screen.getByLabelText("Meter reading (kWh)"), "999");
    await user.click(screen.getByRole("button", { name: "Save reading" }));
    expect(await screen.findByText("Enter at least 1000 kWh")).toBeVisible();
    expect(screen.getByLabelText("Meter reading (kWh)")).toHaveValue("999");
  });
});
