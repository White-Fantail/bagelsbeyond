-- AlterTable
UPDATE "freshness_logs"
SET "quantity" = 1
WHERE "quantity" IS NULL;

ALTER TABLE "freshness_logs" ALTER COLUMN "quantity" SET NOT NULL;
