-- Phase 5: Pricing targets and recommended selling price

-- Create PricingTargetType enum
CREATE TYPE "PricingTargetType" AS ENUM ('COST_PERCENT', 'MARGIN_PERCENT');

-- Create RecommendedPriceRounding enum
CREATE TYPE "RecommendedPriceRounding" AS ENUM ('NONE', 'NEAREST_0_10', 'NEAREST_0_50', 'NEAREST_1_00');

-- Add pricing fields to menu_products
ALTER TABLE "menu_products"
  ADD COLUMN "sellingPrice" DECIMAL(10,2),
  ADD COLUMN "pricingTargetType" "PricingTargetType",
  ADD COLUMN "pricingTargetPercent" DECIMAL(5,2);

-- Add pricing fields to app_settings
ALTER TABLE "app_settings"
  ADD COLUMN "defaultPricingTargetType" "PricingTargetType" NOT NULL DEFAULT 'COST_PERCENT',
  ADD COLUMN "defaultPricingTargetPercent" DECIMAL(5,2) NOT NULL DEFAULT 30.00,
  ADD COLUMN "defaultPriceRounding" "RecommendedPriceRounding" NOT NULL DEFAULT 'NONE';
