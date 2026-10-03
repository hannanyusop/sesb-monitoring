import { Decimal } from "decimal.js";
import type { ChargeResult, TariffTier, TierAllocation } from "./types.js";

function validateTiers(tiers: TariffTier[]): void {
  if (tiers.length === 0 || !new Decimal(tiers[0]?.lowerKwh ?? -1).equals(0)) {
    throw new Error("Tariffs must begin at 0 kWh");
  }

  let expectedLower = new Decimal(0);
  let openEnded = false;
  for (const tier of tiers) {
    const lower = new Decimal(tier.lowerKwh);
    const rate = new Decimal(tier.rateSenPerKwh);
    if (openEnded || !lower.equals(expectedLower) || rate.isNegative()) {
      throw new Error("Tariff tiers must be ordered, contiguous, and non-negative");
    }
    if (tier.upperKwh === null) {
      openEnded = true;
      continue;
    }
    const upper = new Decimal(tier.upperKwh);
    if (upper.lessThanOrEqualTo(lower)) {
      throw new Error("Tariff upper boundary must exceed its lower boundary");
    }
    expectedLower = upper;
  }
  if (!openEnded) throw new Error("Final tariff tier must be open ended");
}

export function calculateTieredCharge(consumptionKwh: string, tiers: TariffTier[]): ChargeResult {
  const consumption = new Decimal(consumptionKwh);
  if (consumption.isNegative()) throw new Error("Consumption cannot be negative");
  validateTiers(tiers);

  const allocations: TierAllocation[] = [];
  let total = new Decimal(0);
  for (const tier of tiers) {
    const lower = new Decimal(tier.lowerKwh);
    const upper = tier.upperKwh === null ? consumption : Decimal.min(consumption, tier.upperKwh);
    const allocated = Decimal.max(0, upper.minus(lower));
    const amount = allocated.times(tier.rateSenPerKwh).dividedBy(100);
    total = total.plus(amount);
    allocations.push({ ...tier, allocatedKwh: allocated.toString(), amountRm: amount.toString() });
  }

  return {
    consumptionKwh: consumption.toString(),
    amountRm: total.toString(),
    displayAmountRm: total.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2),
    allocations,
  };
}

export function formatRm(amountRm: string): string {
  return new Decimal(amountRm).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2);
}
