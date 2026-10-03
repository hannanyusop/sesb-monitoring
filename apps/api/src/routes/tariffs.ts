import type { PrismaClient } from "@sesb/database";
import type { FastifyInstance } from "fastify";
import { DomainError } from "../errors.js";

export function registerTariffRoutes(app: FastifyInstance, prisma: PrismaClient): void {
  app.get("/tariffs/active", async () => {
    const now = new Date();
    const tariff = await prisma.tariff.findFirst({
      where: {
        active: true,
        effectiveStartDate: { lte: now },
        OR: [{ effectiveEndDate: null }, { effectiveEndDate: { gt: now } }],
      },
      include: { tiers: { orderBy: { order: "asc" } } },
      orderBy: { effectiveStartDate: "desc" },
    });
    if (!tariff) throw new DomainError(404, "ACTIVE_TARIFF_NOT_FOUND", "No active tariff was found");
    return {
      id: tariff.id,
      name: tariff.name,
      effectiveStartDate: tariff.effectiveStartDate.toISOString(),
      effectiveEndDate: tariff.effectiveEndDate?.toISOString() ?? null,
      tiers: tariff.tiers.map((tier) => ({
        id: tier.id,
        lowerKwh: tier.lowerKwh.toString(),
        upperKwh: tier.upperKwh?.toString() ?? null,
        rateSenPerKwh: tier.rateSenPerKwh.toString(),
        order: tier.order,
      })),
    };
  });
}
