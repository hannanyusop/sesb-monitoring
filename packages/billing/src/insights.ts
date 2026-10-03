import { Decimal } from "decimal.js";

export type InsightReading = { valueKwh: string; captureTimestamp: string };
export type DailyUsagePoint = {
  date: string;
  usageKwh: string;
  displayUsageKwh: string;
  sourceStart: string;
  sourceEnd: string;
};
export type DailyUsageResult = {
  points: DailyUsagePoint[];
  representedDays: number;
  representedUsageKwh: string;
  averageDailyKwh: string;
};
export type BudgetProgress = {
  type: "KWH" | "RM";
  budget: string;
  used: string;
  remaining: string;
  percentUsed: string;
  percentRemaining: string;
  state: "green" | "amber" | "red";
  overBudget: boolean;
};

const KUC_OFFSET_MS = 8 * 60 * 60 * 1000;
const localDate = (iso: string): string => new Date(new Date(iso).getTime() + KUC_OFFSET_MS).toISOString().slice(0, 10);

function dateRangeAfter(start: string, end: string): string[] {
  if (start === end) return [end];
  const dates: string[] = [];
  const cursor = new Date(`${start}T00:00:00Z`);
  const last = new Date(`${end}T00:00:00Z`);
  cursor.setUTCDate(cursor.getUTCDate() + 1);
  while (cursor <= last) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

export function allocateEstimatedDailyUsage(readings: InsightReading[]): DailyUsageResult {
  const ordered = [...readings].sort((a, b) => new Date(a.captureTimestamp).getTime() - new Date(b.captureTimestamp).getTime());
  const allocated = new Map<string, { usage: Decimal; sourceStart: string; sourceEnd: string }>();
  for (let index = 1; index < ordered.length; index += 1) {
    const previous = ordered[index - 1];
    const current = ordered[index];
    if (!previous || !current) continue;
    const difference = new Decimal(current.valueKwh).minus(previous.valueKwh);
    if (difference.isNegative()) throw new Error("Readings must be cumulative");
    const dates = dateRangeAfter(localDate(previous.captureTimestamp), localDate(current.captureTimestamp));
    const perDay = difference.dividedBy(dates.length);
    for (const date of dates) {
      const existing = allocated.get(date);
      allocated.set(date, {
        usage: (existing?.usage ?? new Decimal(0)).plus(perDay),
        sourceStart: existing?.sourceStart ?? previous.captureTimestamp,
        sourceEnd: current.captureTimestamp,
      });
    }
  }
  const points = [...allocated.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, value]) => ({
    date,
    usageKwh: value.usage.toString(),
    displayUsageKwh: value.usage.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2),
    sourceStart: value.sourceStart,
    sourceEnd: value.sourceEnd,
  }));
  const total = points.reduce((sum, point) => sum.plus(point.usageKwh), new Decimal(0));
  return {
    points,
    representedDays: points.length,
    representedUsageKwh: total.toString(),
    averageDailyKwh: points.length === 0 ? "0" : total.dividedBy(points.length).toDecimalPlaces(4).toString(),
  };
}

export function calculateBudgetProgress(
  type: "KWH" | "RM",
  value: string,
  consumptionKwh: string,
  amountRm: string,
): BudgetProgress {
  const budget = new Decimal(value);
  if (budget.lessThanOrEqualTo(0)) throw new Error("Budget must be greater than zero");
  const used = new Decimal(type === "KWH" ? consumptionKwh : amountRm);
  const remaining = budget.minus(used);
  const percentUsed = used.dividedBy(budget).times(100);
  const percentRemaining = new Decimal(100).minus(percentUsed);
  const state = percentRemaining.lessThanOrEqualTo(0) ? "red" : percentRemaining.lessThanOrEqualTo(40) ? "amber" : "green";
  return {
    type,
    budget: budget.toString(),
    used: used.toString(),
    remaining: remaining.toString(),
    percentUsed: percentUsed.toDecimalPlaces(2).toString(),
    percentRemaining: percentRemaining.toDecimalPlaces(2).toString(),
    state,
    overBudget: used.greaterThan(budget),
  };
}

export function calculateComparison(current: string, previous: string) {
  const currentValue = new Decimal(current);
  const previousValue = new Decimal(previous);
  return {
    current: currentValue.toString(),
    previous: previousValue.toString(),
    difference: currentValue.minus(previousValue).toString(),
    percentChange: previousValue.isZero()
      ? null
      : currentValue.minus(previousValue).dividedBy(previousValue).times(100).toDecimalPlaces(2).toString(),
  };
}
