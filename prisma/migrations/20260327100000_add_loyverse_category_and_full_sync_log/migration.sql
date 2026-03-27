-- CreateTable
CREATE TABLE "loyverse_categories" (
    "id" TEXT NOT NULL,
    "loyverseCategoryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "source" TEXT NOT NULL DEFAULT 'LOYVERSE',
    "isSynced" BOOLEAN NOT NULL DEFAULT true,
    "isEditable" BOOLEAN NOT NULL DEFAULT false,
    "rawPayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "loyverse_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loyverse_full_sync_logs" (
    "id" TEXT NOT NULL,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL,
    "categoriesFetched" INTEGER NOT NULL DEFAULT 0,
    "categoriesUpserted" INTEGER NOT NULL DEFAULT 0,
    "productsFetched" INTEGER NOT NULL DEFAULT 0,
    "productsCreated" INTEGER NOT NULL DEFAULT 0,
    "productsUpdated" INTEGER NOT NULL DEFAULT 0,
    "modifierGroupsFetched" INTEGER NOT NULL DEFAULT 0,
    "modifierGroupsUpserted" INTEGER NOT NULL DEFAULT 0,
    "modifierOptionsFetched" INTEGER NOT NULL DEFAULT 0,
    "modifierOptionsUpserted" INTEGER NOT NULL DEFAULT 0,
    "categoryLinksUpdated" INTEGER NOT NULL DEFAULT 0,
    "modifierLinksUpdated" INTEGER NOT NULL DEFAULT 0,
    "staleLinksRemoved" INTEGER NOT NULL DEFAULT 0,
    "skippedCount" INTEGER NOT NULL DEFAULT 0,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "loyverse_full_sync_logs_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "products" ADD COLUMN "loyverseCategoryId" TEXT;

-- CreateUniqueIndex
CREATE UNIQUE INDEX "loyverse_categories_loyverseCategoryId_key" ON "loyverse_categories"("loyverseCategoryId");

-- CreateIndex
CREATE INDEX "loyverse_categories_isActive_idx" ON "loyverse_categories"("isActive");

-- CreateIndex
CREATE INDEX "loyverse_full_sync_logs_syncedAt_idx" ON "loyverse_full_sync_logs"("syncedAt");

-- CreateIndex
CREATE INDEX "products_loyverseCategoryId_idx" ON "products"("loyverseCategoryId");

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_loyverseCategoryId_fkey" FOREIGN KEY ("loyverseCategoryId") REFERENCES "loyverse_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
