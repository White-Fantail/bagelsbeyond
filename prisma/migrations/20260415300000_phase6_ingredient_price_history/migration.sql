-- Phase 6: Ingredient Price History

-- Enum for history source type
CREATE TYPE "PriceHistorySourceType" AS ENUM ('MANUAL', 'CSV_IMPORT', 'SYSTEM');

-- IngredientPriceHistory table
CREATE TABLE "ingredient_price_history" (
    "id"               TEXT NOT NULL,
    "ingredientId"     TEXT NOT NULL,
    "purchasePrice"    DECIMAL(10,2) NOT NULL,
    "purchaseQuantity" DECIMAL(10,3) NOT NULL,
    "purchaseUnit"     "UnitType" NOT NULL,
    "baseUnit"         "UnitType" NOT NULL,
    "taxIncluded"      BOOLEAN NOT NULL,
    "yieldPercent"     DECIMAL(5,2) NOT NULL,
    "sourceType"       "PriceHistorySourceType" NOT NULL DEFAULT 'MANUAL',
    "notes"            TEXT,
    "effectiveFrom"    TIMESTAMP(3) NOT NULL,
    "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdByUserId"  TEXT,

    CONSTRAINT "ingredient_price_history_pkey" PRIMARY KEY ("id")
);

-- Foreign keys
ALTER TABLE "ingredient_price_history"
    ADD CONSTRAINT "ingredient_price_history_ingredientId_fkey"
    FOREIGN KEY ("ingredientId") REFERENCES "ingredients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ingredient_price_history"
    ADD CONSTRAINT "ingredient_price_history_createdByUserId_fkey"
    FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Indexes
CREATE INDEX "ingredient_price_history_ingredientId_idx" ON "ingredient_price_history"("ingredientId");
CREATE INDEX "ingredient_price_history_effectiveFrom_idx" ON "ingredient_price_history"("effectiveFrom");
CREATE INDEX "ingredient_price_history_createdAt_idx" ON "ingredient_price_history"("createdAt");
CREATE INDEX "ingredient_price_history_sourceType_idx" ON "ingredient_price_history"("sourceType");
