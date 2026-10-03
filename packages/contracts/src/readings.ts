import { z } from "zod";

export const DecimalStringSchema = z.string().regex(/^\d+(\.\d+)?$/, "Enter a non-negative number");
export const OffsetDateTimeSchema = z.string().datetime({ offset: true });

export const CreateReadingInputSchema = z.object({
  valueKwh: DecimalStringSchema,
  captureTimestamp: OffsetDateTimeSchema,
});

export const ReadingSchema = z.object({
  id: z.string().uuid(),
  meterId: z.string().uuid(),
  billingCycleId: z.string().uuid(),
  valueKwh: DecimalStringSchema,
  rawOcrValue: DecimalStringSchema.nullable(),
  manualCorrection: z.boolean(),
  ocrStatus: z.enum(["not_applicable", "pending", "succeeded", "failed"]),
  photographPath: z.string().nullable(),
  captureTimestamp: OffsetDateTimeSchema,
  createdAt: OffsetDateTimeSchema,
  updatedAt: OffsetDateTimeSchema,
});

export const ReadingPageSchema = z.object({
  items: z.array(ReadingSchema),
  nextCursor: z.string().nullable(),
});

export const ReadingCreatedResponseSchema = z.object({
  reading: ReadingSchema,
  activeCycle: z.object({
    id: z.string().uuid(),
    startingReadingId: z.string().uuid().nullable(),
    openingTimestamp: OffsetDateTimeSchema.nullable(),
    consumptionKwh: DecimalStringSchema,
    estimatedChargeRm: DecimalStringSchema,
  }),
});

export type CreateReadingInput = z.infer<typeof CreateReadingInputSchema>;
export type Reading = z.infer<typeof ReadingSchema>;
export type ReadingPage = z.infer<typeof ReadingPageSchema>;
export type ReadingCreatedResponse = z.infer<typeof ReadingCreatedResponseSchema>;
