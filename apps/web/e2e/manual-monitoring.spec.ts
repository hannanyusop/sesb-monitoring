import { expect, test, type Page } from "@playwright/test";

async function addReading(page: Page, value: string, date: string, time: string): Promise<void> {
  await page.getByLabel("Meter reading (kWh)").fill(value);
  await page.getByLabel("Backdate reading").check();
  await page.getByLabel("Reading date").fill(date);
  await page.getByLabel("Reading time").fill(time);
  await page.getByRole("button", { name: "Save reading" }).click();
  await expect(page.getByRole("status")).toHaveText("Reading saved");
}

test("creates a house and preserves totals after a backdated insertion", async ({ page }) => {
  const suffix = `${Date.now()}-${test.info().project.name}`;
  const houseName = `Family home ${suffix}`;
  await page.goto("/");
  await page.getByRole("link", { name: /add house/i }).first().click();
  await page.getByLabel("House name").fill(houseName);
  await page.getByLabel("Meter label").fill(`SESB-${suffix}`);
  await page.getByRole("button", { name: "Create house" }).click();

  const houseNavigation = page.getByRole("navigation", { name: "House navigation" });
  await expect(houseNavigation).toBeVisible();
  await expect(houseNavigation.getByRole("link", { name: "Overview" })).toHaveAttribute("aria-current", "page");
  await houseNavigation.getByRole("link", { name: "Readings" }).click();
  await expect(page).toHaveURL(/#readings$/);
  await expect(houseNavigation.getByRole("link", { name: "Readings" })).toHaveAttribute("aria-current", "page");
  await houseNavigation.getByRole("link", { name: "Edit" }).click();
  await expect(page.getByRole("heading", { name: `Edit ${houseName}` })).toBeVisible();
  await page.getByRole("navigation", { name: "House navigation" }).getByRole("link", { name: "Overview" }).click();
  await expect(page.getByRole("heading", { name: houseName })).toBeVisible();

  await addReading(page, "1000", "2026-09-01", "08:00");
  await addReading(page, "1250", "2026-09-03", "08:00");
  await expect(page.getByText("RM62.92")).toBeVisible();
  await addReading(page, "1100", "2026-09-02", "08:00");

  const readings = page.getByTestId("reading-history").locator("li");
  await expect(readings).toHaveCount(3);
  await expect(readings.nth(0)).toContainText("1250");
  await expect(readings.nth(1)).toContainText("1100");
  await expect(readings.nth(2)).toContainText("1000");
  await expect(page.getByText("RM62.92")).toBeVisible();
});
