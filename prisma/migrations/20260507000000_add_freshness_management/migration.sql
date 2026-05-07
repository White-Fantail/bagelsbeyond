-- CreateEnum
CREATE TYPE "StorageType" AS ENUM ('FROZEN', 'REFRIGERATED', 'AMBIENT');

-- CreateEnum
CREATE TYPE "FreshnessLogType" AS ENUM ('MADE', 'DISPLAYED');

-- AlterTable
ALTER TABLE "menu_products" ADD COLUMN "shelfLifeDays" INTEGER,
                             ADD COLUMN "storageType" "StorageType";

-- CreateTable
CREATE TABLE "freshness_logs" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "logType" "FreshnessLogType" NOT NULL,
    "loggedAt" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "rawDictation" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "freshness_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "freshness_logs_productId_idx" ON "freshness_logs"("productId");

-- CreateIndex
CREATE INDEX "freshness_logs_logType_idx" ON "freshness_logs"("logType");

-- CreateIndex
CREATE INDEX "freshness_logs_loggedAt_idx" ON "freshness_logs"("loggedAt");

-- CreateIndex
CREATE INDEX "freshness_logs_createdByUserId_idx" ON "freshness_logs"("createdByUserId");

-- AddForeignKey
ALTER TABLE "freshness_logs" ADD CONSTRAINT "freshness_logs_productId_fkey" FOREIGN KEY ("productId") REFERENCES "menu_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "freshness_logs" ADD CONSTRAINT "freshness_logs_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
