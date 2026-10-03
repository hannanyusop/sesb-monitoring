CREATE TYPE "CycleStatus" AS ENUM ('ACTIVE', 'CLOSED');
CREATE TYPE "OcrStatus" AS ENUM ('NOT_APPLICABLE', 'PENDING', 'SUCCEEDED', 'FAILED');
CREATE TYPE "CycleActionType" AS ENUM ('START', 'UNDO');

CREATE TABLE "House" (
  "id" UUID NOT NULL,
  "name" VARCHAR(120) NOT NULL,
  "address" VARCHAR(500),
  "notes" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "House_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Meter" (
  "id" UUID NOT NULL,
  "houseId" UUID NOT NULL,
  "label" VARCHAR(120) NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "Meter_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Tariff" (
  "id" UUID NOT NULL,
  "name" VARCHAR(160) NOT NULL,
  "effectiveStartDate" TIMESTAMPTZ(6) NOT NULL,
  "effectiveEndDate" TIMESTAMPTZ(6),
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "Tariff_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TariffTier" (
  "id" UUID NOT NULL,
  "tariffId" UUID NOT NULL,
  "lowerKwh" DECIMAL(20,8) NOT NULL,
  "upperKwh" DECIMAL(20,8),
  "rateSenPerKwh" DECIMAL(12,6) NOT NULL,
  "order" INTEGER NOT NULL,
  CONSTRAINT "TariffTier_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TariffTier_non_negative" CHECK ("lowerKwh" >= 0 AND ("upperKwh" IS NULL OR "upperKwh" > "lowerKwh") AND "rateSenPerKwh" >= 0)
);

CREATE TABLE "BillingCycle" (
  "id" UUID NOT NULL,
  "houseId" UUID NOT NULL,
  "meterId" UUID NOT NULL,
  "status" "CycleStatus" NOT NULL DEFAULT 'ACTIVE',
  "startingReadingId" UUID,
  "endingReadingId" UUID,
  "openingTimestamp" TIMESTAMPTZ(6),
  "closingTimestamp" TIMESTAMPTZ(6),
  "tariffSnapshot" JSONB,
  "consumptionKwh" DECIMAL(20,8) NOT NULL DEFAULT 0,
  "calculatedAmountRm" DECIMAL(20,8) NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "BillingCycle_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "BillingCycle_non_negative" CHECK ("consumptionKwh" >= 0 AND "calculatedAmountRm" >= 0)
);

CREATE TABLE "MeterReading" (
  "id" UUID NOT NULL,
  "meterId" UUID NOT NULL,
  "billingCycleId" UUID NOT NULL,
  "valueKwh" DECIMAL(20,8) NOT NULL,
  "rawOcrValue" DECIMAL(20,8),
  "manualCorrection" BOOLEAN NOT NULL DEFAULT false,
  "ocrStatus" "OcrStatus" NOT NULL DEFAULT 'NOT_APPLICABLE',
  "photographPath" TEXT,
  "photographMetadata" JSONB,
  "captureTimestamp" TIMESTAMPTZ(6) NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "MeterReading_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MeterReading_non_negative" CHECK ("valueKwh" >= 0 AND ("rawOcrValue" IS NULL OR "rawOcrValue" >= 0))
);

CREATE TABLE "CycleAction" (
  "id" UUID NOT NULL,
  "billingCycleId" UUID NOT NULL,
  "actionType" "CycleActionType" NOT NULL,
  "actionTimestamp" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "previousCycleId" UUID,
  "newCycleId" UUID,
  CONSTRAINT "CycleAction_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Meter_houseId_idx" ON "Meter"("houseId");
CREATE UNIQUE INDEX "Meter_one_active_per_house" ON "Meter"("houseId") WHERE "active" = true;
CREATE INDEX "Tariff_effectiveStartDate_effectiveEndDate_idx" ON "Tariff"("effectiveStartDate", "effectiveEndDate");
CREATE UNIQUE INDEX "Tariff_name_effectiveStartDate_key" ON "Tariff"("name", "effectiveStartDate");
CREATE INDEX "TariffTier_tariffId_idx" ON "TariffTier"("tariffId");
CREATE UNIQUE INDEX "TariffTier_tariffId_order_key" ON "TariffTier"("tariffId", "order");
CREATE UNIQUE INDEX "BillingCycle_startingReadingId_key" ON "BillingCycle"("startingReadingId");
CREATE UNIQUE INDEX "BillingCycle_endingReadingId_key" ON "BillingCycle"("endingReadingId");
CREATE INDEX "BillingCycle_houseId_idx" ON "BillingCycle"("houseId");
CREATE INDEX "BillingCycle_meterId_idx" ON "BillingCycle"("meterId");
CREATE INDEX "BillingCycle_status_idx" ON "BillingCycle"("status");
CREATE UNIQUE INDEX "BillingCycle_one_active_per_house" ON "BillingCycle"("houseId") WHERE "status" = 'ACTIVE';
CREATE UNIQUE INDEX "MeterReading_meter_capture_unique" ON "MeterReading"("meterId", "captureTimestamp");
CREATE INDEX "MeterReading_meterId_captureTimestamp_idx" ON "MeterReading"("meterId", "captureTimestamp" DESC);
CREATE INDEX "MeterReading_billingCycleId_captureTimestamp_idx" ON "MeterReading"("billingCycleId", "captureTimestamp" DESC);
CREATE INDEX "CycleAction_billingCycleId_idx" ON "CycleAction"("billingCycleId");
CREATE INDEX "CycleAction_actionTimestamp_idx" ON "CycleAction"("actionTimestamp");

ALTER TABLE "Meter" ADD CONSTRAINT "Meter_houseId_fkey" FOREIGN KEY ("houseId") REFERENCES "House"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TariffTier" ADD CONSTRAINT "TariffTier_tariffId_fkey" FOREIGN KEY ("tariffId") REFERENCES "Tariff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BillingCycle" ADD CONSTRAINT "BillingCycle_houseId_fkey" FOREIGN KEY ("houseId") REFERENCES "House"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BillingCycle" ADD CONSTRAINT "BillingCycle_meterId_fkey" FOREIGN KEY ("meterId") REFERENCES "Meter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BillingCycle" ADD CONSTRAINT "BillingCycle_startingReadingId_fkey" FOREIGN KEY ("startingReadingId") REFERENCES "MeterReading"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BillingCycle" ADD CONSTRAINT "BillingCycle_endingReadingId_fkey" FOREIGN KEY ("endingReadingId") REFERENCES "MeterReading"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MeterReading" ADD CONSTRAINT "MeterReading_meterId_fkey" FOREIGN KEY ("meterId") REFERENCES "Meter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MeterReading" ADD CONSTRAINT "MeterReading_billingCycleId_fkey" FOREIGN KEY ("billingCycleId") REFERENCES "BillingCycle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CycleAction" ADD CONSTRAINT "CycleAction_billingCycleId_fkey" FOREIGN KEY ("billingCycleId") REFERENCES "BillingCycle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CycleAction" ADD CONSTRAINT "CycleAction_previousCycleId_fkey" FOREIGN KEY ("previousCycleId") REFERENCES "BillingCycle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CycleAction" ADD CONSTRAINT "CycleAction_newCycleId_fkey" FOREIGN KEY ("newCycleId") REFERENCES "BillingCycle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
