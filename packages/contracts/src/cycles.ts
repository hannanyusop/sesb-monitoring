import { z } from "zod";
import { DecimalStringSchema, OffsetDateTimeSchema } from "./readings.js";

export const BudgetTypeSchema = z.enum(["KWH", "RM"]);
export const CycleModeSchema = z.enum(["CARRY_FORWARD", "CUSTOM"]);

export const CyclePreviewInputSchema = z.object({
  startTimestamp: OffsetDateTimeSchema,
  mode: CycleModeSchema,
  customStartKwh: DecimalStringSchema.optional(),
}).superRefine((value, context) => {
  if (value.mode === "CUSTOM" && value.customStartKwh === undefined) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["customStartKwh"], message: "Enter the custom starting kWh" });
  }
});

export const StartCycleInputSchema = CyclePreviewInputSchema.and(z.object({
  acknowledgedGap: z.boolean().default(false),
  reason: z.string().trim().max(500).optional(),
}));

export const BudgetInputSchema = z.union([
  z.object({ type: BudgetTypeSchema, value: DecimalStringSchema.refine((value) => Number(value) > 0, "Budget must be greater than zero") }),
  z.object({ type: z.null(), value: z.null() }),
]);

export const BudgetSnapshotSchema = z.object({
  type: BudgetTypeSchema,
  value: DecimalStringSchema,
}).nullable();

export const CycleSummaryDetailSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["active", "closed"]),
  openingTimestamp: OffsetDateTimeSchema.nullable(),
  closingTimestamp: OffsetDateTimeSchema.nullable(),
  startingReadingId: z.string().uuid().nullable(),
  endingReadingId: z.string().uuid().nullable(),
  startKwh: DecimalStringSchema.nullable(),
  endKwh: DecimalStringSchema.nullable(),
  consumptionKwh: DecimalStringSchema,
  estimatedChargeRm: DecimalStringSchema,
  budget: BudgetSnapshotSchema,
});

export const CyclePreviewSchema = z.object({
  currentCycle: CycleSummaryDetailSchema,
  latestReading: z.object({ id: z.string().uuid(), valueKwh: DecimalStringSchema, captureTimestamp: OffsetDateTimeSchema }),
  proposedStartTimestamp: OffsetDateTimeSchema,
  proposedStartKwh: DecimalStringSchema,
  excludedKwh: DecimalStringSchema,
  requiresGapAcknowledgement: z.boolean(),
  budget: BudgetSnapshotSchema,
  tariffName: z.string(),
});

export const StartCycleResponseSchema = z.object({
  closedCycle: CycleSummaryDetailSchema,
  activeCycle: CycleSummaryDetailSchema,
  undoExpiresAt: OffsetDateTimeSchema,
});

export const UndoCycleResponseSchema = z.object({ restoredCycle: CycleSummaryDetailSchema });

export const DailyUsagePointSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  usageKwh: DecimalStringSchema,
  displayUsageKwh: DecimalStringSchema,
  sourceStart: OffsetDateTimeSchema,
  sourceEnd: OffsetDateTimeSchema,
});

export const ComparisonMetricSchema = z.object({
  current: DecimalStringSchema,
  previous: DecimalStringSchema,
  difference: z.string(),
  percentChange: z.string().nullable(),
});

export const CycleInsightsSchema = z.object({
  cycle: CycleSummaryDetailSchema,
  dailyUsage: z.array(DailyUsagePointSchema),
  representedDays: z.number().int().nonnegative(),
  representedUsageKwh: DecimalStringSchema,
  averageDailyKwh: DecimalStringSchema,
  budgetProgress: z.object({
    type: BudgetTypeSchema,
    budget: DecimalStringSchema,
    used: DecimalStringSchema,
    remaining: z.string(),
    percentUsed: DecimalStringSchema,
    percentRemaining: z.string(),
    state: z.enum(["green", "amber", "red"]),
    overBudget: z.boolean(),
  }).nullable(),
  comparison: z.object({
    cycleId: z.string().uuid(),
    consumption: ComparisonMetricSchema,
    charge: ComparisonMetricSchema,
    dailyAverage: ComparisonMetricSchema,
    cycleDays: ComparisonMetricSchema,
  }).nullable(),
  undo: z.object({ eligible: z.boolean(), expiresAt: OffsetDateTimeSchema, reasonCode: z.string().nullable() }).nullable(),
});

export type CyclePreviewInput = z.infer<typeof CyclePreviewInputSchema>;
export type StartCycleInput = z.infer<typeof StartCycleInputSchema>;
export type BudgetInput = z.infer<typeof BudgetInputSchema>;
export type CycleSummaryDetail = z.infer<typeof CycleSummaryDetailSchema>;
export type CyclePreview = z.infer<typeof CyclePreviewSchema>;
export type StartCycleResponse = z.infer<typeof StartCycleResponseSchema>;
export type UndoCycleResponse = z.infer<typeof UndoCycleResponseSchema>;
export type CycleInsights = z.infer<typeof CycleInsightsSchema>;
