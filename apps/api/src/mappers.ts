import { formatRm } from "@sesb/billing";
import type { BillingCycle, MeterReading } from "@sesb/database";
import type { CycleSummary, Reading } from "@sesb/contracts";

const iso = (value: Date): string => value.toISOString();

export function mapReading(reading: MeterReading): Reading {
  return {
    id: reading.id,
    meterId: reading.meterId,
    billingCycleId: reading.billingCycleId,
    valueKwh: reading.valueKwh.toString(),
    rawOcrValue: reading.rawOcrValue?.toString() ?? null,
    manualCorrection: reading.manualCorrection,
    ocrStatus: reading.ocrStatus.toLowerCase() as Reading["ocrStatus"],
    photographPath: reading.photographPath,
    captureTimestamp: iso(reading.captureTimestamp),
    createdAt: iso(reading.createdAt),
    updatedAt: iso(reading.updatedAt),
  };
}

export function mapCycle(cycle: BillingCycle): CycleSummary {
  return {
    id: cycle.id,
    startingReadingId: cycle.startingReadingId,
    openingTimestamp: cycle.openingTimestamp?.toISOString() ?? null,
    consumptionKwh: cycle.consumptionKwh.toString(),
    estimatedChargeRm: formatRm(cycle.calculatedAmountRm.toString()),
  };
}
