import { z } from "zod";
import { DecimalStringSchema, OffsetDateTimeSchema } from "./readings.js";

export const TariffTierSchema = z.object({
  id: z.string().uuid(),
  lowerKwh: DecimalStringSchema,
  upperKwh: DecimalStringSchema.nullable(),
  rateSenPerKwh: DecimalStringSchema,
  order: z.number().int().positive(),
});

export const TariffSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  effectiveStartDate: OffsetDateTimeSchema,
  effectiveEndDate: OffsetDateTimeSchema.nullable(),
  tiers: z.array(TariffTierSchema),
});

export type Tariff = z.infer<typeof TariffSchema>;
export type TariffTier = z.infer<typeof TariffTierSchema>;
