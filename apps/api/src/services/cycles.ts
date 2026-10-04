import { allocateEstimatedDailyUsage, calculateBudgetProgress, calculateComparison, formatRm } from "@sesb/billing";
import type {
  BudgetInput,
  CycleInsights,
  CyclePreview,
  CyclePreviewInput,
  CycleSummaryDetail,
  StartCycleInput,
  StartCycleResponse,
  UndoCycleResponse,
} from "@sesb/contracts";
import {
  BudgetType,
  CycleActionType,
  CycleStatus,
  OcrStatus,
  Prisma,
  ReadingSource,
  type BillingCycle,
  type MeterReading,
  type PrismaClient,
} from "@sesb/database";
import { Decimal } from "decimal.js";
import { DomainError } from "../errors.js";

type Snapshot = {
  tariffId: string;
  name: string;
  effectiveStartDate: string;
  tiers: Array<{ lowerKwh: string; upperKwh: string | null; rateSenPerKwh: string; order: number }>;
};

const detail = (
  cycle: BillingCycle,
  start: Pick<MeterReading, "valueKwh"> | null,
  end: Pick<MeterReading, "valueKwh"> | null,
): CycleSummaryDetail => ({
  id: cycle.id,
  status: cycle.status.toLowerCase() as "active" | "closed",
  openingTimestamp: cycle.openingTimestamp?.toISOString() ?? null,
  closingTimestamp: cycle.closingTimestamp?.toISOString() ?? null,
  startingReadingId: cycle.startingReadingId,
  endingReadingId: cycle.endingReadingId,
  startKwh: start?.valueKwh.toString() ?? null,
  endKwh: end?.valueKwh.toString() ?? null,
  consumptionKwh: cycle.consumptionKwh.toString(),
  estimatedChargeRm: formatRm(cycle.calculatedAmountRm.toString()),
  budget: cycle.budgetType && cycle.budgetValue
    ? { type: cycle.budgetType, value: cycle.budgetValue.toString() }
    : null,
});

const cycleWithBoundaries = {
  startingReading: true,
  endingReading: true,
} as const;

const localDate = (value: Date): string => new Date(value.getTime() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
const inclusiveDays = (start: Date | null, end: Date | null): string => {
  if (!start || !end) return "0";
  const first = Date.parse(`${localDate(start)}T00:00:00Z`);
  const last = Date.parse(`${localDate(end)}T00:00:00Z`);
  return String(Math.max(1, Math.floor((last - first) / 86_400_000) + 1));
};

export function createCycleService(prisma: PrismaClient) {
  async function loadContext(client: Prisma.TransactionClient | PrismaClient, houseId: string, at: Date) {
    const house = await client.house.findFirst({
      where: { id: houseId, active: true },
      include: {
        meters: { where: { active: true }, take: 1 },
        cycles: { where: { status: CycleStatus.ACTIVE }, include: cycleWithBoundaries, take: 1 },
      },
    });
    const meter = house?.meters[0];
    const cycle = house?.cycles[0];
    if (!house || !meter || !cycle) throw new DomainError(404, "HOUSE_NOT_FOUND", "Active house was not found");
    const latest = await client.meterReading.findFirst({
      where: { meterId: meter.id },
      orderBy: [{ captureTimestamp: "desc" }, { id: "desc" }],
    });
    if (!latest || !cycle.startingReadingId) {
      throw new DomainError(422, "CYCLE_BASELINE_REQUIRED", "Add a baseline meter reading before starting a new cycle");
    }
    const tariff = await client.tariff.findFirst({
      where: {
        active: true,
        effectiveStartDate: { lte: at },
        OR: [{ effectiveEndDate: null }, { effectiveEndDate: { gt: at } }],
      },
      include: { tiers: { orderBy: { order: "asc" } } },
      orderBy: { effectiveStartDate: "desc" },
    });
    if (!tariff) throw new DomainError(422, "ACTIVE_TARIFF_NOT_FOUND", "No tariff applies to the new cycle date");
    const snapshot: Snapshot = {
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
    return { house, meter, cycle, latest, snapshot };
  }

  function validateStart(input: CyclePreviewInput, latest: MeterReading, now: Date) {
    const start = new Date(input.startTimestamp);
    if (start > now) throw new DomainError(422, "CYCLE_FUTURE_TIMESTAMP", "Cycle start cannot be in the future", { startTimestamp: "Choose the current time or earlier" });
    if (start < latest.captureTimestamp) throw new DomainError(422, "CYCLE_BEFORE_LATEST_READING", "Cycle start cannot be earlier than the latest reading", { startTimestamp: `Choose ${latest.captureTimestamp.toISOString()} or later` });
    const proposed = input.mode === "CUSTOM" ? new Decimal(input.customStartKwh!) : new Decimal(latest.valueKwh.toString());
    if (proposed.lessThan(latest.valueKwh.toString())) {
      throw new DomainError(422, "CYCLE_START_READING_INVALID", "Starting kWh cannot be lower than the latest reading", { customStartKwh: `Enter at least ${latest.valueKwh.toString()} kWh` });
    }
    const gap = proposed.minus(latest.valueKwh.toString());
    return { start, proposed, gap, customBoundary: input.mode === "CUSTOM" && gap.greaterThan(0) };
  }

  async function preview(houseId: string, input: CyclePreviewInput, now = new Date()): Promise<CyclePreview> {
    const at = new Date(input.startTimestamp);
    const context = await loadContext(prisma, houseId, at);
    const validated = validateStart(input, context.latest, now);
    return {
      currentCycle: detail(context.cycle, context.cycle.startingReading, context.cycle.endingReading),
      latestReading: { id: context.latest.id, valueKwh: context.latest.valueKwh.toString(), captureTimestamp: context.latest.captureTimestamp.toISOString() },
      proposedStartTimestamp: validated.start.toISOString(),
      proposedStartKwh: validated.proposed.toString(),
      excludedKwh: validated.gap.toString(),
      requiresGapAcknowledgement: validated.customBoundary,
      budget: context.house.defaultBudgetType && context.house.defaultBudgetValue
        ? { type: context.house.defaultBudgetType, value: context.house.defaultBudgetValue.toString() }
        : null,
      tariffName: context.snapshot.name,
    };
  }

  async function start(houseId: string, input: StartCycleInput, now = new Date(), attempt = 0): Promise<StartCycleResponse> {
    try {
      return await prisma.$transaction(async (tx) => {
        const context = await loadContext(tx, houseId, new Date(input.startTimestamp));
        const validated = validateStart(input, context.latest, now);
        if (validated.customBoundary && !input.acknowledgedGap) {
          throw new DomainError(422, "CYCLE_GAP_ACKNOWLEDGEMENT_REQUIRED", "Confirm the excluded meter gap before starting this cycle", { acknowledgedGap: "Confirmation is required" });
        }
        const closed = await tx.billingCycle.update({
          where: { id: context.cycle.id },
          data: { status: CycleStatus.CLOSED, endingReadingId: context.latest.id, closingTimestamp: validated.start },
          include: cycleWithBoundaries,
        });
        let active = await tx.billingCycle.create({
          data: {
            houseId,
            meterId: context.meter.id,
            status: CycleStatus.ACTIVE,
            openingTimestamp: validated.start,
            tariffSnapshot: context.snapshot as unknown as Prisma.InputJsonValue,
            budgetType: context.house.defaultBudgetType,
            budgetValue: context.house.defaultBudgetValue,
            ...(!validated.customBoundary ? { startingReadingId: context.latest.id } : {}),
          },
        });
        if (validated.customBoundary) {
          const boundary = await tx.meterReading.create({
            data: {
              meterId: context.meter.id,
              billingCycleId: active.id,
              valueKwh: validated.proposed.toString(),
              captureTimestamp: validated.start,
              ocrStatus: OcrStatus.NOT_APPLICABLE,
              source: ReadingSource.CYCLE_START_OVERRIDE,
              overrideReason: input.reason || null,
            },
          });
          active = await tx.billingCycle.update({ where: { id: active.id }, data: { startingReadingId: boundary.id } });
        }
        const actionTimestamp = now;
        await tx.cycleAction.create({
          data: {
            billingCycleId: active.id,
            actionType: CycleActionType.START,
            actionTimestamp,
            previousCycleId: closed.id,
            newCycleId: active.id,
            metadata: {
              mode: validated.customBoundary ? "CUSTOM" : "CARRY_FORWARD",
              excludedKwh: validated.gap.toString(),
              reason: input.reason || null,
            },
          },
        });
        const activeFull = await tx.billingCycle.findUniqueOrThrow({ where: { id: active.id }, include: cycleWithBoundaries });
        return {
          closedCycle: detail(closed, closed.startingReading, closed.endingReading),
          activeCycle: detail(activeFull, activeFull.startingReading, activeFull.endingReading),
          undoExpiresAt: new Date(actionTimestamp.getTime() + 10 * 60_000).toISOString(),
        };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (error instanceof DomainError) throw error;
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034" && attempt < 5) {
        await new Promise((resolve) => setTimeout(resolve, 20 * (attempt + 1)));
        return start(houseId, input, now, attempt + 1);
      }
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new DomainError(409, "CYCLE_START_CONFLICT", "A meter reading already exists at this cycle start time", { startTimestamp: "Choose a different time" });
      }
      throw error;
    }
  }

  async function list(houseId: string): Promise<CycleSummaryDetail[]> {
    const exists = await prisma.house.findUnique({ where: { id: houseId }, select: { id: true } });
    if (!exists) throw new DomainError(404, "HOUSE_NOT_FOUND", "House was not found");
    const cycles = await prisma.billingCycle.findMany({
      where: { houseId }, include: cycleWithBoundaries,
      orderBy: [{ openingTimestamp: "desc" }, { createdAt: "desc" }],
    });
    return cycles.map((cycle) => detail(cycle, cycle.startingReading, cycle.endingReading));
  }

  async function insights(houseId: string, cycleId: string, now = new Date()): Promise<CycleInsights> {
    const cycle = await prisma.billingCycle.findFirst({ where: { id: cycleId, houseId }, include: cycleWithBoundaries });
    if (!cycle) throw new DomainError(404, "CYCLE_NOT_FOUND", "Billing cycle was not found");
    const readings = await prisma.meterReading.findMany({ where: { billingCycleId: cycle.id }, orderBy: { captureTimestamp: "asc" } });
    const usageReadings = cycle.startingReading && !readings.some((reading) => reading.id === cycle.startingReading!.id)
      ? [cycle.startingReading, ...readings]
      : readings;
    const daily = allocateEstimatedDailyUsage(usageReadings.map((reading) => ({ valueKwh: reading.valueKwh.toString(), captureTimestamp: reading.captureTimestamp.toISOString() })));
    const previous = await prisma.billingCycle.findFirst({
      where: { houseId, id: { not: cycle.id }, status: CycleStatus.CLOSED, closingTimestamp: { lte: cycle.openingTimestamp ?? undefined } },
      include: cycleWithBoundaries,
      orderBy: [{ closingTimestamp: "desc" }, { createdAt: "desc" }],
    });
    const cycleEnd = cycle.closingTimestamp ?? usageReadings.at(-1)?.captureTimestamp ?? cycle.openingTimestamp;
    const days = inclusiveDays(cycle.openingTimestamp, cycleEnd);
    const previousEnd = previous?.closingTimestamp ?? previous?.endingReading?.captureTimestamp ?? null;
    const previousDays = previous ? inclusiveDays(previous.openingTimestamp, previousEnd) : "0";
    const previousAverage = previous && new Decimal(previousDays).greaterThan(0)
      ? new Decimal(previous.consumptionKwh.toString()).dividedBy(previousDays).toDecimalPlaces(4).toString()
      : "0";
    const action = cycle.status === CycleStatus.ACTIVE
      ? await prisma.cycleAction.findFirst({ where: { newCycleId: cycle.id, actionType: CycleActionType.START }, orderBy: { actionTimestamp: "desc" } })
      : null;
    const expiresAt = action ? new Date(action.actionTimestamp.getTime() + 10 * 60_000) : null;
    const laterReading = action ? await prisma.meterReading.findFirst({ where: { billingCycleId: cycle.id, id: { not: cycle.startingReadingId ?? undefined } } }) : null;
    return {
      cycle: detail(cycle, cycle.startingReading, cycle.endingReading),
      dailyUsage: daily.points,
      representedDays: daily.representedDays,
      representedUsageKwh: daily.representedUsageKwh,
      averageDailyKwh: daily.averageDailyKwh,
      budgetProgress: cycle.budgetType && cycle.budgetValue
        ? calculateBudgetProgress(cycle.budgetType, cycle.budgetValue.toString(), cycle.consumptionKwh.toString(), cycle.calculatedAmountRm.toString())
        : null,
      comparison: previous ? {
        cycleId: previous.id,
        consumption: calculateComparison(cycle.consumptionKwh.toString(), previous.consumptionKwh.toString()),
        charge: calculateComparison(cycle.calculatedAmountRm.toString(), previous.calculatedAmountRm.toString()),
        dailyAverage: calculateComparison(daily.averageDailyKwh, previousAverage),
        cycleDays: calculateComparison(days, previousDays),
      } : null,
      undo: action && expiresAt ? {
        eligible: now <= expiresAt && !laterReading,
        expiresAt: expiresAt.toISOString(),
        reasonCode: now > expiresAt ? "UNDO_WINDOW_EXPIRED" : laterReading ? "LATER_READING_EXISTS" : null,
      } : null,
    };
  }

  async function setBudget(houseId: string, input: BudgetInput): Promise<CycleSummaryDetail> {
    return prisma.$transaction(async (tx) => {
      const house = await tx.house.findUnique({ where: { id: houseId } });
      if (!house) throw new DomainError(404, "HOUSE_NOT_FOUND", "House was not found");
      await tx.house.update({ where: { id: houseId }, data: { defaultBudgetType: input.type as BudgetType | null, defaultBudgetValue: input.value } });
      const active = await tx.billingCycle.findFirst({ where: { houseId, status: CycleStatus.ACTIVE } });
      if (!active) throw new DomainError(404, "CYCLE_NOT_FOUND", "Active billing cycle was not found");
      const updated = await tx.billingCycle.update({
        where: { id: active.id },
        data: { budgetType: input.type as BudgetType | null, budgetValue: input.value },
        include: cycleWithBoundaries,
      });
      return detail(updated, updated.startingReading, updated.endingReading);
    });
  }

  async function undo(houseId: string, cycleId: string, now = new Date()): Promise<UndoCycleResponse> {
    return prisma.$transaction(async (tx) => {
      const active = await tx.billingCycle.findFirst({ where: { id: cycleId, houseId, status: CycleStatus.ACTIVE }, include: cycleWithBoundaries });
      if (!active) throw new DomainError(404, "CYCLE_NOT_FOUND", "Active billing cycle was not found");
      const action = await tx.cycleAction.findFirst({ where: { newCycleId: active.id, actionType: CycleActionType.START }, orderBy: { actionTimestamp: "desc" } });
      if (!action || !action.previousCycleId) throw new DomainError(422, "CYCLE_UNDO_UNAVAILABLE", "This cycle cannot be undone");
      const expiresAt = new Date(action.actionTimestamp.getTime() + 10 * 60_000);
      if (now > expiresAt) throw new DomainError(422, "CYCLE_UNDO_EXPIRED", "The 10-minute undo window has expired");
      const later = await tx.meterReading.findFirst({ where: { billingCycleId: active.id, id: { not: active.startingReadingId ?? undefined } } });
      if (later) throw new DomainError(422, "CYCLE_UNDO_READING_EXISTS", "Undo is unavailable after a new meter reading has been added");
      await tx.billingCycle.update({ where: { id: active.id }, data: { status: CycleStatus.CLOSED } });
      const previous = await tx.billingCycle.update({
        where: { id: action.previousCycleId },
        data: { status: CycleStatus.ACTIVE, endingReadingId: null, closingTimestamp: null },
      });
      await tx.cycleAction.update({
        where: { id: action.id },
        data: { billingCycleId: previous.id, newCycleId: null, metadata: { ...(action.metadata as object ?? {}), undoneCycleId: active.id } },
      });
      const customBoundary = active.startingReading?.source === ReadingSource.CYCLE_START_OVERRIDE ? active.startingReading : null;
      await tx.billingCycle.update({ where: { id: active.id }, data: { startingReadingId: null } });
      if (customBoundary) await tx.meterReading.delete({ where: { id: customBoundary.id } });
      await tx.billingCycle.delete({ where: { id: active.id } });
      await tx.cycleAction.create({
        data: {
          billingCycleId: previous.id,
          actionType: CycleActionType.UNDO,
          actionTimestamp: now,
          previousCycleId: previous.id,
          metadata: { undoneCycleId: active.id, startActionId: action.id },
        },
      });
      const restored = await tx.billingCycle.findUniqueOrThrow({ where: { id: previous.id }, include: cycleWithBoundaries });
      return { restoredCycle: detail(restored, restored.startingReading, restored.endingReading) };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  return { preview, start, list, insights, setBudget, undo };
}
