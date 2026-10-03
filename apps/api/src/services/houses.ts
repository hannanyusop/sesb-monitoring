import type { CreateHouseInput, HouseDetail, HouseSummary, UpdateHouseInput } from "@sesb/contracts";
import { CycleStatus, type PrismaClient } from "@sesb/database";
import { DomainError } from "../errors.js";
import { mapCycle, mapReading } from "../mappers.js";

const detailInclude = {
  meters: { where: { active: true }, take: 1 },
  cycles: { where: { status: CycleStatus.ACTIVE }, take: 1 },
  // Latest and recent reads are fetched separately to keep relation filters explicit.
} as const;

export function createHouseService(prisma: PrismaClient) {
  async function assemble(houseId: string): Promise<HouseDetail> {
    const house = await prisma.house.findUnique({ where: { id: houseId }, include: detailInclude });
    const meter = house?.meters[0];
    const cycle = house?.cycles[0];
    if (!house || !meter || !cycle) throw new DomainError(404, "HOUSE_NOT_FOUND", "House was not found");
    const recentReadings = await prisma.meterReading.findMany({
      where: { meterId: meter.id },
      orderBy: [{ captureTimestamp: "desc" }, { id: "desc" }],
      take: 20,
    });
    return {
      id: house.id,
      name: house.name,
      address: house.address,
      notes: house.notes,
      active: house.active,
      meter: { id: meter.id, label: meter.label, active: meter.active },
      latestReading: recentReadings[0] ? mapReading(recentReadings[0]) : null,
      activeCycle: mapCycle(cycle),
      recentReadings: recentReadings.map(mapReading),
    };
  }

  return {
    async createHouse(input: CreateHouseInput): Promise<HouseDetail> {
      const houseId = await prisma.$transaction(async (tx) => {
        const house = await tx.house.create({
          data: { name: input.name, address: input.address || null, notes: input.notes || null },
        });
        const meter = await tx.meter.create({
          data: { houseId: house.id, label: input.meterLabel },
        });
        await tx.billingCycle.create({
          data: { houseId: house.id, meterId: meter.id },
        });
        return house.id;
      });
      return assemble(houseId);
    },

    async listActiveHouses(): Promise<HouseSummary[]> {
      const houses = await prisma.house.findMany({
        where: { active: true },
        orderBy: { name: "asc" },
        select: { id: true },
      });
      return Promise.all(houses.map(async ({ id }) => {
        const detail = await assemble(id);
        const { meter: _meter, recentReadings: _recentReadings, ...summary } = detail;
        return summary;
      }));
    },

    getHouse: assemble,

    async updateHouse(id: string, input: UpdateHouseInput): Promise<HouseDetail> {
      const existing = await prisma.house.findUnique({ where: { id }, select: { id: true } });
      if (!existing) throw new DomainError(404, "HOUSE_NOT_FOUND", "House was not found");
      await prisma.house.update({
        where: { id },
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.address !== undefined ? { address: input.address || null } : {}),
          ...(input.notes !== undefined ? { notes: input.notes || null } : {}),
          ...(input.active !== undefined ? { active: input.active } : {}),
        },
      });
      return assemble(id);
    },
  };
}
