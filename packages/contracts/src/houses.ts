import { z } from "zod";
import { DecimalStringSchema, OffsetDateTimeSchema, ReadingSchema } from "./readings.js";

export const CreateHouseInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  address: z.string().trim().max(500).optional(),
  notes: z.string().trim().max(2000).optional(),
  meterLabel: z.string().trim().min(1).max(120),
});

export const UpdateHouseInputSchema = CreateHouseInputSchema.omit({ meterLabel: true })
  .partial()
  .extend({ active: z.boolean().optional() })
  .refine((value) => Object.keys(value).length > 0, "At least one field is required");

export const MeterSchema = z.object({
  id: z.string().uuid(),
  label: z.string(),
  active: z.boolean(),
});

export const CycleSummarySchema = z.object({
  id: z.string().uuid(),
  startingReadingId: z.string().uuid().nullable(),
  openingTimestamp: OffsetDateTimeSchema.nullable(),
  consumptionKwh: DecimalStringSchema,
  estimatedChargeRm: DecimalStringSchema,
});

export const HouseSummarySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  address: z.string().nullable(),
  notes: z.string().nullable(),
  active: z.boolean(),
  latestReading: ReadingSchema.nullable(),
  activeCycle: CycleSummarySchema,
});

export const HouseDetailSchema = HouseSummarySchema.extend({
  meter: MeterSchema,
  recentReadings: z.array(ReadingSchema),
});

export type CreateHouseInput = z.infer<typeof CreateHouseInputSchema>;
export type UpdateHouseInput = z.infer<typeof UpdateHouseInputSchema>;
export type CycleSummary = z.infer<typeof CycleSummarySchema>;
export type HouseSummary = z.infer<typeof HouseSummarySchema>;
export type HouseDetail = z.infer<typeof HouseDetailSchema>;
