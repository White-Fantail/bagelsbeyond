-- Phase 4: Add external factor fields and region settings

-- Step 1: Add new columns to daily_external_factors as nullable
ALTER TABLE "daily_external_factors"
  ADD COLUMN IF NOT EXISTS "date" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "sourceWeather" TEXT,
  ADD COLUMN IF NOT EXISTS "sourceHoliday" TEXT,
  ADD COLUMN IF NOT EXISTS "sourceEvents" TEXT,
  ADD COLUMN IF NOT EXISTS "sourceNews" TEXT,
  ADD COLUMN IF NOT EXISTS "collectedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "lastRefreshedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Step 2: Backfill date from linked daily_record
UPDATE "daily_external_factors" ef
SET "date" = dr."date"
FROM "daily_records" dr
WHERE ef."dailyRecordId" = dr."id"
  AND ef."date" IS NULL;

-- Step 3: Set date to createdAt for any remaining rows without a linked record
UPDATE "daily_external_factors"
SET "date" = "createdAt"
WHERE "date" IS NULL;

-- Step 4: Add unique constraint and index on date
ALTER TABLE "daily_external_factors"
  ALTER COLUMN "date" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "daily_external_factors_date_key" ON "daily_external_factors"("date");

CREATE INDEX IF NOT EXISTS "daily_external_factors_date_idx" ON "daily_external_factors"("date");

-- Step 5: Drop old FK and make dailyRecordId nullable
ALTER TABLE "daily_external_factors"
  DROP CONSTRAINT IF EXISTS "daily_external_factors_dailyRecordId_fkey";

ALTER TABLE "daily_external_factors"
  ALTER COLUMN "dailyRecordId" DROP NOT NULL;

-- Step 6: Re-add FK with SET NULL on delete
ALTER TABLE "daily_external_factors"
  ADD CONSTRAINT "daily_external_factors_dailyRecordId_fkey"
  FOREIGN KEY ("dailyRecordId") REFERENCES "daily_records"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Step 7: Add region/location fields to app_settings
ALTER TABLE "app_settings"
  ADD COLUMN IF NOT EXISTS "defaultRegion" TEXT NOT NULL DEFAULT 'Canterbury',
  ADD COLUMN IF NOT EXISTS "defaultCity" TEXT NOT NULL DEFAULT 'Christchurch',
  ADD COLUMN IF NOT EXISTS "defaultCountry" TEXT NOT NULL DEFAULT 'NZ',
  ADD COLUMN IF NOT EXISTS "defaultEventRegion" TEXT NOT NULL DEFAULT 'Christchurch',
  ADD COLUMN IF NOT EXISTS "autoCollectExternalData" BOOLEAN NOT NULL DEFAULT true;
