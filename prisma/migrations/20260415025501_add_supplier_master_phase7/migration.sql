/*
  Warnings:

  - You are about to drop the column `validationErrors` on the `import_rows` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "SupplierIntegrationType" AS ENUM ('MANUAL', 'API', 'SCRAPER', 'CSV');

-- CreateEnum
CREATE TYPE "SupplierSyncMode" AS ENUM ('MANUAL_ONLY', 'API_READY', 'SCRAPER_READY', 'CSV_ONLY');

-- AlterTable
ALTER TABLE "import_rows" DROP COLUMN "validationErrors";

-- CreateTable
CREATE TABLE "suppliers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "integrationType" "SupplierIntegrationType" NOT NULL DEFAULT 'MANUAL',
    "websiteUrl" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ingredient_supplier_links" (
    "id" TEXT NOT NULL,
    "ingredientId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "supplierProductName" TEXT NOT NULL,
    "supplierProductCode" TEXT,
    "supplierProductUrl" TEXT,
    "supplierPackageQuantity" DECIMAL(10,3),
    "supplierPackageUnit" "UnitType",
    "supplierBaseUnit" "UnitType",
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "syncMode" "SupplierSyncMode" NOT NULL DEFAULT 'MANUAL_ONLY',
    "lastCheckedAt" TIMESTAMP(3),
    "lastSyncStatus" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ingredient_supplier_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "suppliers_name_key" ON "suppliers"("name");

-- CreateIndex
CREATE UNIQUE INDEX "suppliers_slug_key" ON "suppliers"("slug");

-- CreateIndex
CREATE INDEX "suppliers_name_idx" ON "suppliers"("name");

-- CreateIndex
CREATE INDEX "suppliers_slug_idx" ON "suppliers"("slug");

-- CreateIndex
CREATE INDEX "suppliers_isActive_idx" ON "suppliers"("isActive");

-- CreateIndex
CREATE INDEX "ingredient_supplier_links_ingredientId_idx" ON "ingredient_supplier_links"("ingredientId");

-- CreateIndex
CREATE INDEX "ingredient_supplier_links_supplierId_idx" ON "ingredient_supplier_links"("supplierId");

-- CreateIndex
CREATE INDEX "ingredient_supplier_links_isPrimary_idx" ON "ingredient_supplier_links"("isPrimary");

-- CreateIndex
CREATE INDEX "ingredient_supplier_links_isActive_idx" ON "ingredient_supplier_links"("isActive");

-- AddForeignKey
ALTER TABLE "ingredient_supplier_links" ADD CONSTRAINT "ingredient_supplier_links_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "ingredients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingredient_supplier_links" ADD CONSTRAINT "ingredient_supplier_links_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
