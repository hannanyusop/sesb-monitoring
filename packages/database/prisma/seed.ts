import { PrismaClient } from "@prisma/client";

const DEFAULT_TARIFF_NAME = "SESB Domestic Tiered Tariff";
const DEFAULT_EFFECTIVE_START = new Date("1970-01-01T00:00:00.000Z");

const tiers = [
  { order: 1, lowerKwh: "0", upperKwh: "200", rateSenPerKwh: "22.02" },
  { order: 2, lowerKwh: "200", upperKwh: "300", rateSenPerKwh: "37.76" },
  { order: 3, lowerKwh: "300", upperKwh: "600", rateSenPerKwh: "49.26" },
  { order: 4, lowerKwh: "600", upperKwh: "1000", rateSenPerKwh: "51.49" },
  { order: 5, lowerKwh: "1000", upperKwh: "1500", rateSenPerKwh: "54.69" },
  { order: 6, lowerKwh: "1500", upperKwh: null, rateSenPerKwh: "59.85" },
] as const;

export async function seedTariffs(client: PrismaClient = new PrismaClient()): Promise<void> {
  const ownsClient = arguments.length === 0;
  try {
    await client.$transaction(async (tx) => {
      const tariff = await tx.tariff.upsert({
        where: {
          name_effectiveStartDate: {
            name: DEFAULT_TARIFF_NAME,
            effectiveStartDate: DEFAULT_EFFECTIVE_START,
          },
        },
        create: {
          name: DEFAULT_TARIFF_NAME,
          effectiveStartDate: DEFAULT_EFFECTIVE_START,
        },
        update: { active: true },
      });

      for (const tier of tiers) {
        await tx.tariffTier.upsert({
          where: { tariffId_order: { tariffId: tariff.id, order: tier.order } },
          create: { tariffId: tariff.id, ...tier },
          update: {
            lowerKwh: tier.lowerKwh,
            upperKwh: tier.upperKwh,
            rateSenPerKwh: tier.rateSenPerKwh,
          },
        });
      }
    });
  } finally {
    if (ownsClient) await client.$disconnect();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await seedTariffs();
}
