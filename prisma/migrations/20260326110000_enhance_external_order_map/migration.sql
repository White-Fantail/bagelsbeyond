-- Migration: 20260326110000_enhance_external_order_map
-- Purpose: Enhance ExternalOrderMap for daily auto-push feature
--
-- Changes:
--   1. Make externalOrderId nullable (was NOT NULL with empty string fallback)
--      This prevents unique constraint violations when multiple orders fail
--      to push (all would have had externalOrderId = "").
--   2. Add requestSummary column for diagnostic logging of what was sent.
--   3. Add responseSummary column for diagnostic logging of POS response.
--
-- Note: Existing rows with externalOrderId = '' are converted to NULL.

-- Step 1: Convert existing empty strings to NULL
UPDATE "external_order_maps" SET "externalOrderId" = NULL WHERE "externalOrderId" = '';

-- Step 2: Make externalOrderId nullable
ALTER TABLE "external_order_maps" ALTER COLUMN "externalOrderId" DROP NOT NULL;

-- Step 3: Add requestSummary column
ALTER TABLE "external_order_maps" ADD COLUMN IF NOT EXISTS "requestSummary" TEXT;

-- Step 4: Add responseSummary column
ALTER TABLE "external_order_maps" ADD COLUMN IF NOT EXISTS "responseSummary" TEXT;
