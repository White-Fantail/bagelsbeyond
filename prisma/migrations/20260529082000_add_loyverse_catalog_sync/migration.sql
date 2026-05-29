-- CreateEnum
CREATE TYPE "LoyverseSyncStatus" AS ENUM ('RUNNING', 'SUCCESS', 'PARTIAL', 'FAILED');

-- AlterTable
ALTER TABLE "product_categories" ADD COLUMN "loyverseId" TEXT;

-- AlterTable
ALTER TABLE "menu_products" ADD COLUMN "loyverseId" TEXT;

-- AlterTable
ALTER TABLE "menu_modifier_groups" ADD COLUMN "loyverseId" TEXT;

-- AlterTable
ALTER TABLE "menu_modifier_options" ADD COLUMN "loyverseId" TEXT;

-- CreateTable
CREATE TABLE "loyverse_sync_logs" (
    "id" TEXT NOT NULL,
    "status" "LoyverseSyncStatus" NOT NULL DEFAULT 'RUNNING',
    "triggeredByUserId" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "categoriesAdded" INTEGER NOT NULL DEFAULT 0,
    "categoriesUpdated" INTEGER NOT NULL DEFAULT 0,
    "productsAdded" INTEGER NOT NULL DEFAULT 0,
    "productsUpdated" INTEGER NOT NULL DEFAULT 0,
    "modifiersAdded" INTEGER NOT NULL DEFAULT 0,
    "modifiersUpdated" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "summaryJson" JSONB,

    CONSTRAINT "loyverse_sync_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "product_categories_loyverseId_key" ON "product_categories"("loyverseId");

-- CreateIndex
CREATE UNIQUE INDEX "menu_products_loyverseId_key" ON "menu_products"("loyverseId");

-- CreateIndex
CREATE UNIQUE INDEX "menu_modifier_groups_loyverseId_key" ON "menu_modifier_groups"("loyverseId");

-- CreateIndex
CREATE UNIQUE INDEX "menu_modifier_options_loyverseId_key" ON "menu_modifier_options"("loyverseId");

-- CreateIndex
CREATE INDEX "loyverse_sync_logs_status_idx" ON "loyverse_sync_logs"("status");

-- CreateIndex
CREATE INDEX "loyverse_sync_logs_startedAt_idx" ON "loyverse_sync_logs"("startedAt");

-- CreateIndex
CREATE INDEX "loyverse_sync_logs_triggeredByUserId_idx" ON "loyverse_sync_logs"("triggeredByUserId");

-- AddForeignKey
ALTER TABLE "loyverse_sync_logs" ADD CONSTRAINT "loyverse_sync_logs_triggeredByUserId_fkey" FOREIGN KEY ("triggeredByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
