import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { HouseCard } from "./house-card.js";

const baseHouse = {
  id: "d6046da5-d481-4aa6-849f-3ce89c09f95e",
  name: "Family home",
  address: null,
  notes: null,
  active: true,
  latestReading: null,
  activeCycle: {
    id: "88107b0d-a48b-48a8-822a-08ce60f6fc73",
    startingReadingId: null,
    openingTimestamp: null,
    consumptionKwh: "0",
    estimatedChargeRm: "0.00",
  },
};

describe("HouseCard", () => {
  it("prompts for a first reading", () => {
    render(<MemoryRouter><HouseCard house={baseHouse} /></MemoryRouter>);
    expect(screen.getByRole("link", { name: /add first reading/i })).toBeVisible();
    expect(screen.getByText("RM0.00")).toBeVisible();
  });

  it("shows the current estimate", () => {
    render(<MemoryRouter><HouseCard house={{ ...baseHouse, activeCycle: { ...baseHouse.activeCycle, consumptionKwh: "250", estimatedChargeRm: "62.92" } }} /></MemoryRouter>);
    expect(screen.getByText("RM62.92")).toBeVisible();
    expect(screen.getByText("250", { exact: true })).toBeVisible();
  });
});
