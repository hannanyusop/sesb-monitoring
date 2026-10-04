import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { HouseNavigation } from "./house-navigation.js";

function renderNavigation(path: string) {
  render(<MemoryRouter initialEntries={[path]}><HouseNavigation houseId="house-1" /></MemoryRouter>);
}

describe("HouseNavigation", () => {
  it("links to every approved house destination", () => {
    renderNavigation("/houses/house-1");
    expect(screen.getByRole("link", { name: "All Houses" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "Overview" })).toHaveAttribute("href", "/houses/house-1#overview");
    expect(screen.getByRole("link", { name: "Readings" })).toHaveAttribute("href", "/houses/house-1#readings");
    expect(screen.getByRole("link", { name: "Edit" })).toHaveAttribute("href", "/houses/house-1/edit");
  });

  it.each([
    ["/houses/house-1", "Overview"],
    ["/houses/house-1#overview", "Overview"],
    ["/houses/house-1#readings", "Readings"],
    ["/houses/house-1/edit", "Edit"],
  ])("marks %s as %s", (path, label) => {
    renderNavigation(path);
    expect(screen.getByRole("link", { name: label })).toHaveAttribute("aria-current", "page");
  });
});
