-- AddColumn ingredientSupplierLinkId to ingredient_price_history
ALTER TABLE "ingredient_price_history" ADD COLUMN "ingredientSupplierLinkId" TEXT;
ALTER TABLE "ingredient_price_history" ADD CONSTRAINT "ingredient_price_history_ingredientSupplierLinkId_fkey" FOREIGN KEY ("ingredientSupplierLinkId") REFERENCES "ingredient_supplier_links"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "ingredient_price_history_ingredientSupplierLinkId_idx" ON "ingredient_price_history"("ingredientSupplierLinkId");

-- CreateEnum PriceImportMode
CREATE TYPE "PriceImportMode" AS ENUM ('INGREDIENT', 'SUPPLIER_LINK');

-- CreateEnum PriceImportRowStatus
CREATE TYPE "PriceImportRowStatus" AS ENUM ('READY', 'WARNING', 'ERROR', 'SKIPPED');

-- CreateTable PriceImportBatch
CREATE TABLE "price_import_batches" (
    "id" TEXT NOT NULL,
    "mode" "PriceImportMode" NOT NULL,
    "sourceType" "PriceHistorySourceType" NOT NULL,
    "fileName" TEXT,
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "successRows" INTEGER NOT NULL DEFAULT 0,
    "errorRows" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdByUserId" TEXT,
    CONSTRAINT "price_import_batches_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "price_import_batches_createdAt_idx" ON "price_import_batches"("createdAt");
CREATE INDEX "price_import_batches_mode_idx" ON "price_import_batches"("mode");
ALTER TABLE "price_import_batches" ADD CONSTRAINT "price_import_batches_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable PriceImportRow
CREATE TABLE "price_import_rows" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "rowNumber" INTEGER NOT NULL,
    "rawPayload" JSONB NOT NULL,
    "status" "PriceImportRowStatus" NOT NULL,
    "ingredientId" TEXT,
    "ingredientSupplierLinkId" TEXT,
    "message" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "price_import_rows_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "price_import_rows_batchId_idx" ON "price_import_rows"("batchId");
CREATE INDEX "price_import_rows_status_idx" ON "price_import_rows"("status");
ALTER TABLE "price_import_rows" ADD CONSTRAINT "price_import_rows_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "price_import_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
