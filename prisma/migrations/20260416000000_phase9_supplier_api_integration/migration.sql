-- AlterEnum: add API_SYNC to PriceHistorySourceType
ALTER TYPE "PriceHistorySourceType" ADD VALUE 'API_SYNC';

-- CreateEnum: SupplierSyncStatus
CREATE TYPE "SupplierSyncStatus" AS ENUM ('RUNNING', 'SUCCESS', 'PARTIAL', 'FAILED');

-- CreateTable: supplier_api_credentials
CREATE TABLE "supplier_api_credentials" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "adapterKey" TEXT NOT NULL,
    "credentials" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "supplier_api_credentials_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "supplier_api_credentials_supplierId_key" ON "supplier_api_credentials"("supplierId");
CREATE INDEX "supplier_api_credentials_supplierId_idx" ON "supplier_api_credentials"("supplierId");

ALTER TABLE "supplier_api_credentials"
    ADD CONSTRAINT "supplier_api_credentials_supplierId_fkey"
    FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: supplier_sync_logs
CREATE TABLE "supplier_sync_logs" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "credentialId" TEXT,
    "status" "SupplierSyncStatus" NOT NULL,
    "triggeredByUserId" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "totalLinks" INTEGER NOT NULL DEFAULT 0,
    "successLinks" INTEGER NOT NULL DEFAULT 0,
    "errorLinks" INTEGER NOT NULL DEFAULT 0,
    "skippedLinks" INTEGER NOT NULL DEFAULT 0,
    "errorSummary" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplier_sync_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "supplier_sync_logs_supplierId_idx" ON "supplier_sync_logs"("supplierId");
CREATE INDEX "supplier_sync_logs_status_idx" ON "supplier_sync_logs"("status");
CREATE INDEX "supplier_sync_logs_startedAt_idx" ON "supplier_sync_logs"("startedAt");

ALTER TABLE "supplier_sync_logs"
    ADD CONSTRAINT "supplier_sync_logs_supplierId_fkey"
    FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "supplier_sync_logs"
    ADD CONSTRAINT "supplier_sync_logs_credentialId_fkey"
    FOREIGN KEY ("credentialId") REFERENCES "supplier_api_credentials"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "supplier_sync_logs"
    ADD CONSTRAINT "supplier_sync_logs_triggeredByUserId_fkey"
    FOREIGN KEY ("triggeredByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable: supplier_sync_log_entries
CREATE TABLE "supplier_sync_log_entries" (
    "id" TEXT NOT NULL,
    "syncLogId" TEXT NOT NULL,
    "ingredientSupplierLinkId" TEXT,
    "ingredientId" TEXT,
    "message" TEXT NOT NULL,
    "level" TEXT NOT NULL DEFAULT 'info',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplier_sync_log_entries_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "supplier_sync_log_entries_syncLogId_idx" ON "supplier_sync_log_entries"("syncLogId");

ALTER TABLE "supplier_sync_log_entries"
    ADD CONSTRAINT "supplier_sync_log_entries_syncLogId_fkey"
    FOREIGN KEY ("syncLogId") REFERENCES "supplier_sync_logs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
