import type { CycleInsights, CyclePreview } from "@sesb/contracts";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BudgetIndicator } from "./budget-indicator.js";
import { CycleComparison } from "./cycle-comparison.js";
import { DailyUsageChart } from "./daily-usage-chart.js";
import { StartCycleSheet } from "./start-cycle-sheet.js";

const preview: CyclePreview = {
  currentCycle: { id: "11111111-1111-4111-8111-111111111111", status: "active", openingTimestamp: "2026-10-01T00:00:00.000Z", closingTimestamp: null, startingReadingId: "22222222-2222-4222-8222-222222222222", endingReadingId: null, startKwh: "1000", endKwh: null, consumptionKwh: "100", estimatedChargeRm: "22.02", budget: null },
  latestReading: { id: "33333333-3333-4333-8333-333333333333", valueKwh: "1100", captureTimestamp: "2026-10-02T00:00:00.000Z" },
  proposedStartTimestamp: "2026-10-03T00:00:00.000Z", proposedStartKwh: "1125", excludedKwh: "25", requiresGapAcknowledgement: true, budget: null, tariffName: "Domestic",
};

const insights: CycleInsights = {
  cycle: preview.currentCycle,
  dailyUsage: [{ date: "2026-10-02", usageKwh: "20", displayUsageKwh: "20.00", sourceStart: "2026-10-01T00:00:00.000Z", sourceEnd: "2026-10-02T00:00:00.000Z" }],
  representedDays: 1, representedUsageKwh: "20", averageDailyKwh: "20", budgetProgress: null, comparison: null, undo: null,
};

describe("cycle workspace", () => {
  it("describes remaining RM budget accessibly", () => {
    render(<BudgetIndicator progress={{ type: "RM", budget: "100", used: "25", remaining: "75", percentUsed: "25", percentRemaining: "75", state: "green", overBudget: false }} />);
    expect(screen.getByLabelText("75.00 RM remaining, 75 percent left")).toBeInTheDocument();
  });

  it("keeps chart meaning and average available as text", () => {
    render(<DailyUsageChart insights={insights} />);
    expect(screen.getByText("20.00")).toBeInTheDocument();
    expect(screen.getByRole("img")).toHaveAttribute("aria-label", expect.stringContaining("average 20.00 kWh per day"));
  });

  it("explains when there is no previous cycle", () => {
    render(<CycleComparison comparison={null} />);
    expect(screen.getByText("No comparison yet")).toBeInTheDocument();
  });

  it("retains custom input while previewing and requires gap confirmation", async () => {
    const onPreview = vi.fn().mockResolvedValue(preview);
    render(<StartCycleSheet onPreview={onPreview} onStart={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /start new bill cycle/i }));
    fireEvent.click(screen.getByRole("button", { name: "Custom start" }));
    fireEvent.change(screen.getByLabelText("Starting meter (kWh)"), { target: { value: "1125" } });
    fireEvent.click(screen.getByRole("button", { name: "Review new cycle" }));
    await waitFor(() => expect(onPreview).toHaveBeenCalled());
    expect(screen.getByLabelText("Starting meter (kWh)")).toHaveValue("1125");
    expect(screen.getByRole("button", { name: "Confirm and start cycle" })).toBeDisabled();
    expect(screen.getByText(/Confirm 25 kWh gap/)).toBeInTheDocument();
  });
});
