-- Phase 4: Add yieldPercent to ingredients for yield/loss adjustment costing
-- Default 100.00 means no loss (100% usable)

ALTER TABLE "ingredients" ADD COLUMN "yieldPercent" DECIMAL(5,2) NOT NULL DEFAULT 100.00;
