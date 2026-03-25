-- AlterTable: Add extended prediction fields to sales_predictions
ALTER TABLE "sales_predictions"
  ADD COLUMN IF NOT EXISTS "projectedWasteRate" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "projectedSellThroughRate" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "baselineSales" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "baselineBagelsSold" INTEGER,
  ADD COLUMN IF NOT EXISTS "adjustmentSummary" TEXT,
  ADD COLUMN IF NOT EXISTS "explanationJson" TEXT;
