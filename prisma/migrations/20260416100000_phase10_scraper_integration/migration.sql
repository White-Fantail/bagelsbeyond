-- AlterEnum: add SCRAPER_SYNC to PriceHistorySourceType
ALTER TYPE "PriceHistorySourceType" ADD VALUE 'SCRAPER_SYNC';

-- CreateTable: supplier_scraper_credentials
CREATE TABLE "supplier_scraper_credentials" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "adapterKey" TEXT NOT NULL,
    "credentials" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "supplier_scraper_credentials_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "supplier_scraper_credentials_supplierId_key" ON "supplier_scraper_credentials"("supplierId");
CREATE INDEX "supplier_scraper_credentials_supplierId_idx" ON "supplier_scraper_credentials"("supplierId");

ALTER TABLE "supplier_scraper_credentials"
    ADD CONSTRAINT "supplier_scraper_credentials_supplierId_fkey"
    FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable: add scraperCredentialId to supplier_sync_logs
ALTER TABLE "supplier_sync_logs" ADD COLUMN "scraperCredentialId" TEXT;

ALTER TABLE "supplier_sync_logs"
    ADD CONSTRAINT "supplier_sync_logs_scraperCredentialId_fkey"
    FOREIGN KEY ("scraperCredentialId") REFERENCES "supplier_scraper_credentials"("id") ON DELETE SET NULL ON UPDATE CASCADE;
