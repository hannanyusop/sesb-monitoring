import { expect, test, type Page } from "@playwright/test";

async function createHouse(page: Page): Promise<void> {
  const suffix = `${Date.now()}-${test.info().project.name}`;
  await page.goto("/");
  await page.getByRole("link", { name: /add house/i }).first().click();
  await page.getByLabel("House name").fill(`Cycle home ${suffix}`);
  await page.getByLabel("Meter label").fill(`MTR-${suffix}`);
  await page.getByRole("button", { name: "Create house" }).click();
}

async function addReading(page: Page, value: string, date: string): Promise<void> {
  await page.getByLabel("Meter reading (kWh)").fill(value);
  await page.getByLabel("Backdate reading").check();
  await page.getByLabel("Reading date").fill(date);
  await page.getByLabel("Reading time").fill("08:00");
  await page.getByRole("button", { name: "Save reading" }).click();
  await expect(page.getByRole("status")).toHaveText("Reading saved");
}

async function startCarryForward(page: Page): Promise<void> {
  await page.getByRole("button", { name: /start new bill cycle/i }).click();
  await page.getByLabel("Start date").fill("2026-09-04");
  await page.getByLabel("Start time").fill("08:00");
  await page.getByRole("button", { name: "Review new cycle" }).click();
  await expect(page.getByText("New starting value")).toBeVisible();
  await page.getByRole("button", { name: "Confirm and start cycle" }).click();
}

test("manages budget, cycle undo, custom boundary, chart and comparison", async ({ page }) => {
  await createHouse(page);
  await addReading(page, "1000", "2026-09-01");
  await addReading(page, "1250", "2026-09-03");

  await page.getByRole("button", { name: "Add budget" }).click();
  await page.getByRole("button", { name: "RM", exact: true }).click();
  await page.getByLabel("Budget value").fill("100");
  await page.getByRole("button", { name: "Save budget" }).click();
  await expect(page.getByLabel(/RM remaining/)).toBeVisible();

  await startCarryForward(page);
  await expect(page.getByText("New cycle started")).toBeVisible();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.getByRole("button", { name: /start new bill cycle/i })).toBeVisible();
  await expect(page.getByText("New cycle started")).toHaveCount(0);

  await page.getByRole("button", { name: /start new bill cycle/i }).click();
  await page.getByRole("button", { name: "Custom start" }).click();
  await page.getByLabel("Start date").fill("2026-09-04");
  await page.getByLabel("Start time").fill("08:00");
  await page.getByLabel("Starting meter (kWh)").fill("1300");
  await page.getByRole("button", { name: "Review new cycle" }).click();
  await expect(page.getByText(/Confirm 50 kWh gap/)).toBeVisible();
  await page.getByText(/Confirm 50 kWh gap/).click();
  await page.getByRole("button", { name: "Confirm and start cycle" }).click();

  await addReading(page, "1360", "2026-09-06");
  await expect(page.getByText("30.00")).toBeVisible();
  await expect(page.getByRole("img", { name: /average 30.00 kWh per day/ })).toBeVisible();
  await expect(page.getByText("Cycle comparison")).toBeVisible();
  await expect(page.getByText("60 vs 250 kWh")).toBeVisible();

  const closedCycleId = await page.getByLabel("View billing cycle").locator("option").filter({ hasText: "Closed cycle" }).first().getAttribute("value");
  await page.getByLabel("View billing cycle").selectOption(closedCycleId!);
  await expect(page.getByText("Viewing a closed cycle")).toBeVisible();
  await expect(page.getByRole("button", { name: /start new bill cycle/i })).toHaveCount(0);
});
