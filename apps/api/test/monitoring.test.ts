import { PrismaClient } from "@sesb/database";
import { seedTariffs } from "@sesb/database";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";

process.env.DATABASE_URL ??= "postgresql://sesb:sesb@localhost:55432/sesb_monitoring_test";
const prisma = new PrismaClient();

async function resetDatabase(): Promise<void> {
  await prisma.cycleAction.deleteMany();
  await prisma.billingCycle.updateMany({ data: { startingReadingId: null, endingReadingId: null } });
  await prisma.meterReading.deleteMany();
  await prisma.billingCycle.deleteMany();
  await prisma.meter.deleteMany();
  await prisma.house.deleteMany();
  await prisma.tariffTier.deleteMany();
  await prisma.tariff.deleteMany();
  await seedTariffs(prisma);
}

beforeEach(resetDatabase);
afterAll(async () => prisma.$disconnect());

async function createHouse(app: Awaited<ReturnType<typeof buildApp>>): Promise<string> {
  const response = await app.inject({
    method: "POST",
    url: "/houses",
    payload: { name: "Family home", meterLabel: "SESB-01" },
  });
  expect(response.statusCode).toBe(201);
  return response.json().id as string;
}

describe("monitoring API", () => {
  it("creates a house, meter, and uninitialised cycle atomically", async () => {
    const app = await buildApp({ prisma });
    const houseId = await createHouse(app);
    const response = await app.inject({ method: "GET", url: `/houses/${houseId}` });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      name: "Family home",
      meter: { label: "SESB-01", active: true },
      activeCycle: { startingReadingId: null, consumptionKwh: "0", estimatedChargeRm: "0.00" },
      latestReading: null,
    });
    await app.close();
  });

  it("returns the seeded active tariff in tier order", async () => {
    const app = await buildApp({ prisma });
    const response = await app.inject({ method: "GET", url: "/tariffs/active" });
    expect(response.statusCode).toBe(200);
    expect(response.json().tiers.map((tier: { rateSenPerKwh: string }) => tier.rateSenPerKwh)).toEqual([
      "22.02", "37.76", "49.26", "51.49", "54.69", "59.85",
    ]);
    await app.close();
  });

  it("keeps latest totals after inserting a valid backdated reading", async () => {
    const app = await buildApp({ prisma });
    const houseId = await createHouse(app);
    const post = (valueKwh: string, captureTimestamp: string) => app.inject({
      method: "POST",
      url: `/houses/${houseId}/readings`,
      payload: { valueKwh, captureTimestamp },
    });

    expect((await post("1000", "2026-09-01T08:00:00+08:00")).statusCode).toBe(201);
    const latest = await post("1250", "2026-09-03T08:00:00+08:00");
    expect(latest.json().activeCycle).toMatchObject({ consumptionKwh: "250", estimatedChargeRm: "62.92" });

    const backdated = await post("1100", "2026-09-02T08:00:00+08:00");
    expect(backdated.statusCode).toBe(201);
    expect(backdated.json().activeCycle).toMatchObject({ consumptionKwh: "250", estimatedChargeRm: "62.92" });

    const history = await app.inject({ method: "GET", url: `/houses/${houseId}/readings` });
    expect(history.json().items.map((item: { valueKwh: string }) => item.valueKwh)).toEqual(["1250", "1100", "1000"]);
    await app.close();
  });

  it("rejects a backdated value that does not fit its neighbours", async () => {
    const app = await buildApp({ prisma });
    const houseId = await createHouse(app);
    const post = (valueKwh: string, captureTimestamp: string) => app.inject({
      method: "POST",
      url: `/houses/${houseId}/readings`,
      payload: { valueKwh, captureTimestamp },
    });
    await post("1000", "2026-09-01T08:00:00+08:00");
    await post("1250", "2026-09-03T08:00:00+08:00");
    const invalid = await post("999", "2026-09-02T08:00:00+08:00");
    expect(invalid.statusCode).toBe(422);
    expect(invalid.json()).toMatchObject({ error: { code: "READING_SEQUENCE_INVALID", fields: { valueKwh: expect.any(String) } } });
    await app.close();
  });
});
