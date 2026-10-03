import { calculateTieredCharge, type TariffTier } from "@sesb/billing";
import type { CreateReadingInput, ReadingCreatedResponse, ReadingPage } from "@sesb/contracts";
import { CycleStatus, OcrStatus, Prisma, type PrismaClient } from "@sesb/database";
import { Decimal } from "decimal.js";
import { DomainError } from "../errors.js";
import { mapCycle, mapReading } from "../mappers.js";

type Snapshot = {
  tariffId: string;
  name: string;
  effectiveStartDate: string;
  tiers: Array<TariffTier & { order: number }>;
};

function parseSnapshot(value: Prisma.JsonValue): Snapshot {
  if (!value || typeof value !== "object" || Array.isArray(value) || !("tiers" in value)) {
    throw new DomainError(500, "TARIFF_SNAPSHOT_INVALID", "The billing cycle tariff is unavailable");
  }
  return value as unknown as Snapshot;
}

export function createReadingService(prisma: PrismaClient) {
  return {
    async createManualReading(
      houseId: string,
      input: CreateReadingInput,
      now: Date = new Date(),
    ): Promise<ReadingCreatedResponse> {
      const capturedAt = new Date(input.captureTimestamp);
      if (capturedAt.getTime() > now.getTime()) {
        throw new DomainError(422, "READING_FUTURE_TIMESTAMP", "Reading time cannot be in the future", {
          captureTimestamp: "Choose the current time or a past date and time",
        });
      }

      try {
        return await prisma.$transaction(async (tx) => {
          const house = await tx.house.findFirst({
            where: { id: houseId, active: true },
            include: {
              meters: { where: { active: true }, take: 1 },
              cycles: { where: { status: CycleStatus.ACTIVE }, take: 1 },
            },
          });
          const meter = house?.meters[0];
          let cycle = house?.cycles[0];
          if (!house || !meter || !cycle) {
            throw new DomainError(404, "HOUSE_NOT_FOUND", "Active house was not found");
          }

          const proposed = new Decimal(input.valueKwh);
          let snapshot: Snapshot;
          if (!cycle.startingReadingId) {
            const tariff = await tx.tariff.findFirst({
              where: {
                active: true,
                effectiveStartDate: { lte: capturedAt },
                OR: [{ effectiveEndDate: null }, { effectiveEndDate: { gt: capturedAt } }],
              },
              include: { tiers: { orderBy: { order: "asc" } } },
              orderBy: { effectiveStartDate: "desc" },
            });
            if (!tariff) throw new DomainError(422, "ACTIVE_TARIFF_NOT_FOUND", "No tariff applies to this reading date");
            snapshot = {
              tariffId: tariff.id,
              name: tariff.name,
              effectiveStartDate: tariff.effectiveStartDate.toISOString(),
              tiers: tariff.tiers.map((tier) => ({
                lowerKwh: tier.lowerKwh.toString(),
                upperKwh: tier.upperKwh?.toString() ?? null,
                rateSenPerKwh: tier.rateSenPerKwh.toString(),
                order: tier.order,
              })),
            };
          } else {
            const starting = await tx.meterReading.findUnique({ where: { id: cycle.startingReadingId } });
            if (!starting || capturedAt < starting.captureTimestamp) {
              throw new DomainError(422, "READING_BEFORE_CYCLE", "Reading cannot be earlier than the cycle starting reading", {
                captureTimestamp: "Choose a date and time on or after the cycle start",
              });
            }
            const [previous, next] = await Promise.all([
              tx.meterReading.findFirst({
                where: { meterId: meter.id, captureTimestamp: { lt: capturedAt } },
                orderBy: { captureTimestamp: "desc" },
              }),
              tx.meterReading.findFirst({
                where: { meterId: meter.id, captureTimestamp: { gt: capturedAt } },
                orderBy: { captureTimestamp: "asc" },
              }),
            ]);
            if (previous && proposed.lessThan(previous.valueKwh.toString())) {
              throw new DomainError(422, "READING_SEQUENCE_INVALID", "Reading is lower than the preceding reading", {
                valueKwh: `Enter a value of at least ${previous.valueKwh.toString()} kWh`,
              });
            }
            if (next && proposed.greaterThan(next.valueKwh.toString())) {
              throw new DomainError(422, "READING_SEQUENCE_INVALID", "Reading is higher than the following reading", {
                valueKwh: `Enter a value no greater than ${next.valueKwh.toString()} kWh`,
              });
            }
            snapshot = parseSnapshot(cycle.tariffSnapshot as Prisma.JsonValue);
          }

          const reading = await tx.meterReading.create({
            data: {
              meterId: meter.id,
              billingCycleId: cycle.id,
              valueKwh: input.valueKwh,
              captureTimestamp: capturedAt,
              ocrStatus: OcrStatus.NOT_APPLICABLE,
              manualCorrection: false,
            },
          });

          if (!cycle.startingReadingId) {
            cycle = await tx.billingCycle.update({
              where: { id: cycle.id },
              data: {
                startingReadingId: reading.id,
                openingTimestamp: capturedAt,
                tariffSnapshot: snapshot as unknown as Prisma.InputJsonValue,
              },
            });
          } else {
            const starting = await tx.meterReading.findUniqueOrThrow({ where: { id: cycle.startingReadingId } });
            const latest = await tx.meterReading.findFirstOrThrow({
              where: { billingCycleId: cycle.id },
              orderBy: [{ captureTimestamp: "desc" }, { id: "desc" }],
            });
            const consumption = new Decimal(latest.valueKwh.toString()).minus(starting.valueKwh.toString());
            const charge = calculateTieredCharge(consumption.toString(), snapshot.tiers);
            cycle = await tx.billingCycle.update({
              where: { id: cycle.id },
              data: { consumptionKwh: consumption.toString(), calculatedAmountRm: charge.amountRm },
            });
          }

          return { reading: mapReading(reading), activeCycle: mapCycle(cycle) };
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      } catch (error) {
        if (error instanceof DomainError) throw error;
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
          throw new DomainError(409, "READING_TIMESTAMP_CONFLICT", "A reading already exists at this date and time", {
            captureTimestamp: "Choose a different date or time",
          });
        }
        throw error;
      }
    },

    async listReadings(houseId: string, cursor?: string, requestedLimit = 20): Promise<ReadingPage> {
      const limit = Math.max(1, Math.min(100, requestedLimit));
      const meter = await prisma.meter.findFirst({ where: { houseId, active: true } });
      if (!meter) throw new DomainError(404, "HOUSE_NOT_FOUND", "House was not found");
      const readings = await prisma.meterReading.findMany({
        where: { meterId: meter.id },
        orderBy: [{ captureTimestamp: "desc" }, { id: "desc" }],
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        take: limit + 1,
      });
      const hasMore = readings.length > limit;
      const items = readings.slice(0, limit);
      return { items: items.map(mapReading), nextCursor: hasMore ? items.at(-1)?.id ?? null : null };
    },
  };
}
