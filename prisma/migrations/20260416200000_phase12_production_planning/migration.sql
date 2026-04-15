-- Phase 12: Production Planning
-- Adds ForecastOverride model, planning settings to AppSetting,
-- and production planning fields to MenuProduct.

-- CreateEnum: PlanningRoundingMode
CREATE TYPE "PlanningRoundingMode" AS ENUM ('NONE', 'ROUND_UP', 'ROUND_DOWN', 'ROUND_NEAREST');

-- CreateEnum: PlanningBatchHandlingMode
CREATE TYPE "PlanningBatchHandlingMode" AS ENUM ('IGNORE', 'ROUND_UP', 'ROUND_NEAREST');

-- CreateEnum: ForecastOverrideSourceType
CREATE TYPE "ForecastOverrideSourceType" AS ENUM ('MANUAL', 'SYSTEM');

-- AlterTable: add production planning settings to app_settings
ALTER TABLE "app_settings"
  ADD COLUMN "planningBufferPercent"     FLOAT NOT NULL DEFAULT 10.0,
  ADD COLUMN "planningRoundingMode"      "PlanningRoundingMode" NOT NULL DEFAULT 'ROUND_UP',
  ADD COLUMN "planningBatchHandlingMode" "PlanningBatchHandlingMode" NOT NULL DEFAULT 'ROUND_UP';

-- AlterTable: add production planning fields to menu_products
ALTER TABLE "menu_products"
  ADD COLUMN "isProductionPlannable"   BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "productionBatchSize"     FLOAT,
  ADD COLUMN "productionBufferPercent" FLOAT,
  ADD COLUMN "planningRoundingMode"    "PlanningRoundingMode";

-- CreateIndex on menu_products
CREATE INDEX "menu_products_isProductionPlannable_idx" ON "menu_products"("isProductionPlannable");

-- CreateTable: forecast_overrides
CREATE TABLE "forecast_overrides" (
  "id"                TEXT NOT NULL,
  "targetDate"        DATE NOT NULL,
  "productId"         TEXT NOT NULL,
  "predictedSalesQty" FLOAT NOT NULL,
  "sourceType"        "ForecastOverrideSourceType" NOT NULL DEFAULT 'MANUAL',
  "notes"             TEXT,
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "forecast_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "forecast_overrides_targetDate_productId_key" ON "forecast_overrides"("targetDate", "productId");
CREATE INDEX "forecast_overrides_targetDate_idx" ON "forecast_overrides"("targetDate");
CREATE INDEX "forecast_overrides_productId_idx" ON "forecast_overrides"("productId");

-- AddForeignKey
ALTER TABLE "forecast_overrides"
  ADD CONSTRAINT "forecast_overrides_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "menu_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
