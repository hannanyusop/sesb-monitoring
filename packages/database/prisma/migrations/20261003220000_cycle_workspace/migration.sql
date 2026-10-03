CREATE TYPE "BudgetType" AS ENUM ('KWH', 'RM');
CREATE TYPE "ReadingSource" AS ENUM ('MANUAL', 'OCR', 'CYCLE_START_OVERRIDE');

ALTER TABLE "House"
  ADD COLUMN "defaultBudgetType" "BudgetType",
  ADD COLUMN "defaultBudgetValue" DECIMAL(20,8);

ALTER TABLE "BillingCycle"
  ADD COLUMN "budgetType" "BudgetType",
  ADD COLUMN "budgetValue" DECIMAL(20,8);

ALTER TABLE "MeterReading"
  ADD COLUMN "source" "ReadingSource" NOT NULL DEFAULT 'MANUAL',
  ADD COLUMN "overrideReason" VARCHAR(500);

ALTER TABLE "CycleAction" ADD COLUMN "metadata" JSONB;

DROP INDEX "BillingCycle_startingReadingId_key";
CREATE INDEX "BillingCycle_startingReadingId_idx" ON "BillingCycle"("startingReadingId");

ALTER TABLE "House" ADD CONSTRAINT "House_budget_pair" CHECK (
  ("defaultBudgetType" IS NULL AND "defaultBudgetValue" IS NULL)
  OR ("defaultBudgetType" IS NOT NULL AND "defaultBudgetValue" > 0)
);

ALTER TABLE "BillingCycle" ADD CONSTRAINT "BillingCycle_budget_pair" CHECK (
  ("budgetType" IS NULL AND "budgetValue" IS NULL)
  OR ("budgetType" IS NOT NULL AND "budgetValue" > 0)
);
