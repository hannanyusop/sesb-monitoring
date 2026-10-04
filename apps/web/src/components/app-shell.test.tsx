import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { AppShell } from "./app-shell.js";

describe("AppShell", () => {
  it("renders page content without the former top bar", () => {
    render(<MemoryRouter><AppShell><p>Dashboard content</p></AppShell></MemoryRouter>);
    expect(screen.getByText("Dashboard content")).toBeVisible();
    expect(screen.queryByRole("banner")).not.toBeInTheDocument();
    expect(screen.queryByText("Electric usage monitor")).not.toBeInTheDocument();
  });
});
