import { PrismaClient } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { seedTariffs } from "../prisma/seed.js";

process.env.DATABASE_URL ??= "postgresql://sesb:sesb@localhost:55432/sesb_monitoring_test";
const prisma = new PrismaClient();

beforeEach(async () => {
  await prisma.cycleAction.deleteMany();
  await prisma.billingCycle.updateMany({ data: { startingReadingId: null, endingReadingId: null } });
  await prisma.meterReading.deleteMany();
  await prisma.billingCycle.deleteMany();
  await prisma.meter.deleteMany();
  await prisma.house.deleteMany();
  await prisma.tariffTier.deleteMany();
  await prisma.tariff.deleteMany();
});

afterAll(async () => prisma.$disconnect());

describe("database foundation", () => {
  it("seeds the approved tariff idempotently", async () => {
    await seedTariffs(prisma);
    await seedTariffs(prisma);
    const tariffs = await prisma.tariff.findMany({
      include: { tiers: { orderBy: { order: "asc" } } },
    });
    expect(tariffs).toHaveLength(1);
    expect(tariffs[0]?.tiers.map((tier) => tier.rateSenPerKwh.toString())).toEqual([
      "22.02", "37.76", "49.26", "51.49", "54.69", "59.85",
    ]);
  });

  it("enforces one active meter per house", async () => {
    const house = await prisma.house.create({ data: { name: "Home" } });
    await prisma.meter.create({ data: { houseId: house.id, label: "A" } });
    await expect(prisma.meter.create({ data: { houseId: house.id, label: "B" } })).rejects.toThrow();
  });

  it("enforces one active cycle per house", async () => {
    const house = await prisma.house.create({ data: { name: "Home" } });
    const meter = await prisma.meter.create({ data: { houseId: house.id, label: "A" } });
    await prisma.billingCycle.create({ data: { houseId: house.id, meterId: meter.id } });
    await expect(prisma.billingCycle.create({ data: { houseId: house.id, meterId: meter.id } })).rejects.toThrow();
  });
});
