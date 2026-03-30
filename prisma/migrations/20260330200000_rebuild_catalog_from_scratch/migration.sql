-- ═══════════════════════════════════════════════════════════════════════════════
-- Migration: rebuild_catalog_from_scratch
-- Drops all old product/channel/sync tables and rebuilds with new architecture.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─── Step 1: Drop old mapping / channel / sync / product tables (CASCADE) ─────

DROP TABLE IF EXISTS "modifier_option_channel_mappings" CASCADE;
DROP TABLE IF EXISTS "modifier_group_channel_mappings" CASCADE;
DROP TABLE IF EXISTS "product_channel_mappings" CASCADE;
DROP TABLE IF EXISTS "category_channel_mappings" CASCADE;
DROP TABLE IF EXISTS "channel_product_modifier_group_links" CASCADE;
DROP TABLE IF EXISTS "channel_modifier_options" CASCADE;
DROP TABLE IF EXISTS "channel_modifier_groups" CASCADE;
DROP TABLE IF EXISTS "channel_products" CASCADE;
DROP TABLE IF EXISTS "channel_categories" CASCADE;
DROP TABLE IF EXISTS "sync_job_logs" CASCADE;
DROP TABLE IF EXISTS "sync_jobs" CASCADE;
DROP TABLE IF EXISTS "subscription_item_options" CASCADE;
DROP TABLE IF EXISTS "external_option_maps" CASCADE;
DROP TABLE IF EXISTS "external_option_group_maps" CASCADE;
DROP TABLE IF EXISTS "external_product_maps" CASCADE;
DROP TABLE IF EXISTS "product_option_group_assignments" CASCADE;
DROP TABLE IF EXISTS "daily_option_inventory" CASCADE;
DROP TABLE IF EXISTS "daily_inventory" CASCADE;
DROP TABLE IF EXISTS "product_options" CASCADE;
DROP TABLE IF EXISTS "product_option_groups" CASCADE;
DROP TABLE IF EXISTS "product_variants" CASCADE;
DROP TABLE IF EXISTS "products" CASCADE;
DROP TABLE IF EXISTS "loyverse_full_sync_logs" CASCADE;
DROP TABLE IF EXISTS "loyverse_modifier_sync_logs" CASCADE;
DROP TABLE IF EXISTS "loyverse_inventory_levels" CASCADE;
DROP TABLE IF EXISTS "loyverse_variants" CASCADE;
DROP TABLE IF EXISTS "loyverse_item_modifiers" CASCADE;
DROP TABLE IF EXISTS "loyverse_items" CASCADE;
DROP TABLE IF EXISTS "loyverse_modifier_options" CASCADE;
DROP TABLE IF EXISTS "loyverse_modifiers" CASCADE;
DROP TABLE IF EXISTS "loyverse_categories" CASCADE;
DROP TABLE IF EXISTS "categories" CASCADE;

-- ─── Step 2: Drop old enum types ──────────────────────────────────────────────

DROP TYPE IF EXISTS "ChannelType";
DROP TYPE IF EXISTS "MappingStatus";
DROP TYPE IF EXISTS "SyncDirection";
DROP TYPE IF EXISTS "ProductStatus";
DROP TYPE IF EXISTS "IntegrationSource" CASCADE;

-- ─── Step 3: Alter modified existing tables ───────────────────────────────────

ALTER TABLE "subscription_items" DROP COLUMN IF EXISTS "productId";
ALTER TABLE "order_items" DROP COLUMN IF EXISTS "productId";
ALTER TABLE "order_item_options" DROP COLUMN IF EXISTS "productOptionId";

-- ─── Step 4: Create new enum types ────────────────────────────────────────────

CREATE TYPE "Channel" AS ENUM ('LOYVERSE', 'UBER', 'DOORDASH');

CREATE TYPE "MappingStatus" AS ENUM ('ACTIVE', 'UNMAPPED', 'ERROR', 'DISABLED');

CREATE TYPE "IntegrationSource" AS ENUM ('LOYVERSE', 'SQUARE', 'OTHER');

-- ─── Step 5: Create new internal canonical tables ─────────────────────────────

-- CreateTable
CREATE TABLE "categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "items" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sku" TEXT,
    "basePrice" DECIMAL(10,2),
    "trackStock" BOOLEAN NOT NULL DEFAULT false,
    "soldByWeight" BOOLEAN NOT NULL DEFAULT false,
    "isComposite" BOOLEAN NOT NULL DEFAULT false,
    "useProduction" BOOLEAN NOT NULL DEFAULT false,
    "form" TEXT,
    "color" TEXT,
    "imageUrl" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "item_variants" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sku" TEXT,
    "barcode" TEXT,
    "price" DECIMAL(10,2),
    "cost" DECIMAL(10,2),
    "purchaseCost" DECIMAL(10,2),
    "option1Value" TEXT,
    "option2Value" TEXT,
    "option3Value" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "item_variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "modifier_groups" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "minSelect" INTEGER,
    "maxSelect" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "modifier_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "modifier_options" (
    "id" TEXT NOT NULL,
    "modifierGroupId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "priceDelta" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "modifier_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "item_modifier_groups" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "modifierGroupId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "item_modifier_groups_pkey" PRIMARY KEY ("id")
);

-- ─── Step 6: Create channel mirror tables ─────────────────────────────────────

-- CreateTable
CREATE TABLE "channel_categories" (
    "id" TEXT NOT NULL,
    "channel" "Channel" NOT NULL,
    "externalId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "externalCreatedAt" TIMESTAMP(3),
    "externalUpdatedAt" TIMESTAMP(3),
    "externalDeletedAt" TIMESTAMP(3),
    "rawPayload" JSONB NOT NULL,
    "syncedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "channel_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "channel_items" (
    "id" TEXT NOT NULL,
    "channel" "Channel" NOT NULL,
    "externalId" TEXT NOT NULL,
    "channelCategoryId" TEXT,
    "handle" TEXT,
    "itemName" TEXT NOT NULL,
    "description" TEXT,
    "referenceId" TEXT,
    "trackStock" BOOLEAN NOT NULL DEFAULT false,
    "soldByWeight" BOOLEAN NOT NULL DEFAULT false,
    "isComposite" BOOLEAN NOT NULL DEFAULT false,
    "useProduction" BOOLEAN NOT NULL DEFAULT false,
    "primarySupplierId" TEXT,
    "form" TEXT,
    "color" TEXT,
    "imageUrl" TEXT,
    "option1Name" TEXT,
    "option2Name" TEXT,
    "option3Name" TEXT,
    "externalCreatedAt" TIMESTAMP(3),
    "externalUpdatedAt" TIMESTAMP(3),
    "externalDeletedAt" TIMESTAMP(3),
    "rawPayload" JSONB NOT NULL,
    "syncedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "channel_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "channel_item_components" (
    "id" TEXT NOT NULL,
    "channel" "Channel" NOT NULL,
    "channelItemId" TEXT NOT NULL,
    "channelVariantExternalId" TEXT NOT NULL,
    "quantity" DECIMAL(10,4) NOT NULL,
    "rawPayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "channel_item_components_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "channel_item_tax_links" (
    "id" TEXT NOT NULL,
    "channel" "Channel" NOT NULL,
    "channelItemId" TEXT NOT NULL,
    "taxExternalId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "channel_item_tax_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "channel_item_modifier_group_links" (
    "id" TEXT NOT NULL,
    "channel" "Channel" NOT NULL,
    "channelItemId" TEXT NOT NULL,
    "channelModifierGroupExternalId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "channel_item_modifier_group_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "channel_variants" (
    "id" TEXT NOT NULL,
    "channel" "Channel" NOT NULL,
    "externalId" TEXT NOT NULL,
    "channelItemId" TEXT NOT NULL,
    "sku" TEXT,
    "referenceVariantId" TEXT,
    "option1Value" TEXT,
    "option2Value" TEXT,
    "option3Value" TEXT,
    "barcode" TEXT,
    "cost" DECIMAL(10,2),
    "purchaseCost" DECIMAL(10,2),
    "defaultPricingType" TEXT,
    "defaultPrice" DECIMAL(10,2),
    "externalCreatedAt" TIMESTAMP(3),
    "externalUpdatedAt" TIMESTAMP(3),
    "externalDeletedAt" TIMESTAMP(3),
    "rawPayload" JSONB NOT NULL,
    "syncedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "channel_variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "channel_variant_store_data" (
    "id" TEXT NOT NULL,
    "channel" "Channel" NOT NULL,
    "channelVariantId" TEXT NOT NULL,
    "storeExternalId" TEXT NOT NULL,
    "pricingType" TEXT,
    "price" DECIMAL(10,2),
    "availableForSale" BOOLEAN,
    "optimalStock" DECIMAL(10,4),
    "lowStock" DECIMAL(10,4),
    "rawPayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "channel_variant_store_data_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "channel_modifier_groups" (
    "id" TEXT NOT NULL,
    "channel" "Channel" NOT NULL,
    "externalId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "position" INTEGER,
    "externalCreatedAt" TIMESTAMP(3),
    "externalUpdatedAt" TIMESTAMP(3),
    "externalDeletedAt" TIMESTAMP(3),
    "rawPayload" JSONB NOT NULL,
    "syncedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "channel_modifier_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "channel_modifier_group_store_links" (
    "id" TEXT NOT NULL,
    "channel" "Channel" NOT NULL,
    "channelModifierGroupId" TEXT NOT NULL,
    "storeExternalId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "channel_modifier_group_store_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "channel_modifier_options" (
    "id" TEXT NOT NULL,
    "channel" "Channel" NOT NULL,
    "externalId" TEXT NOT NULL,
    "channelModifierGroupId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" DECIMAL(10,2),
    "position" INTEGER,
    "externalCreatedAt" TIMESTAMP(3),
    "externalUpdatedAt" TIMESTAMP(3),
    "externalDeletedAt" TIMESTAMP(3),
    "rawPayload" JSONB NOT NULL,
    "syncedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "channel_modifier_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "channel_payment_types" (
    "id" TEXT NOT NULL,
    "channel" "Channel" NOT NULL,
    "externalId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "paymentTypeCode" TEXT,
    "externalCreatedAt" TIMESTAMP(3),
    "externalUpdatedAt" TIMESTAMP(3),
    "externalDeletedAt" TIMESTAMP(3),
    "rawPayload" JSONB NOT NULL,
    "syncedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "channel_payment_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "channel_payment_type_store_links" (
    "id" TEXT NOT NULL,
    "channel" "Channel" NOT NULL,
    "channelPaymentTypeId" TEXT NOT NULL,
    "storeExternalId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "channel_payment_type_store_links_pkey" PRIMARY KEY ("id")
);

-- ─── Step 7: Create mapping tables ────────────────────────────────────────────

-- CreateTable
CREATE TABLE "category_channel_mappings" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "channel" "Channel" NOT NULL,
    "channelCategoryId" TEXT NOT NULL,
    "mappingStatus" "MappingStatus" NOT NULL DEFAULT 'ACTIVE',
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "category_channel_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "item_channel_mappings" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "channel" "Channel" NOT NULL,
    "channelItemId" TEXT NOT NULL,
    "mappingStatus" "MappingStatus" NOT NULL DEFAULT 'ACTIVE',
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "item_channel_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "item_variant_channel_mappings" (
    "id" TEXT NOT NULL,
    "itemVariantId" TEXT NOT NULL,
    "channel" "Channel" NOT NULL,
    "channelVariantId" TEXT NOT NULL,
    "mappingStatus" "MappingStatus" NOT NULL DEFAULT 'ACTIVE',
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "item_variant_channel_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "modifier_group_channel_mappings" (
    "id" TEXT NOT NULL,
    "modifierGroupId" TEXT NOT NULL,
    "channel" "Channel" NOT NULL,
    "channelModifierGroupId" TEXT NOT NULL,
    "mappingStatus" "MappingStatus" NOT NULL DEFAULT 'ACTIVE',
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "modifier_group_channel_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "modifier_option_channel_mappings" (
    "id" TEXT NOT NULL,
    "modifierOptionId" TEXT NOT NULL,
    "channel" "Channel" NOT NULL,
    "channelModifierOptionId" TEXT NOT NULL,
    "mappingStatus" "MappingStatus" NOT NULL DEFAULT 'ACTIVE',
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "modifier_option_channel_mappings_pkey" PRIMARY KEY ("id")
);

-- ─── Step 8: Create channel sales mirror tables ───────────────────────────────

-- CreateTable
CREATE TABLE "channel_receipts" (
    "id" TEXT NOT NULL,
    "channel" "Channel" NOT NULL,
    "externalId" TEXT,
    "storeExternalId" TEXT,
    "orderCode" TEXT,
    "customerExternalId" TEXT,
    "source" TEXT,
    "receiptDate" TIMESTAMP(3),
    "note" TEXT,
    "rawPayload" JSONB NOT NULL,
    "syncedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "channel_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "channel_receipt_discounts" (
    "id" TEXT NOT NULL,
    "channel" "Channel" NOT NULL,
    "channelReceiptId" TEXT NOT NULL,
    "externalDiscountId" TEXT,
    "percentage" DECIMAL(5,2),
    "moneyAmount" DECIMAL(10,2),
    "scope" TEXT,
    "rawPayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "channel_receipt_discounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "channel_receipt_line_items" (
    "id" TEXT NOT NULL,
    "channel" "Channel" NOT NULL,
    "channelReceiptId" TEXT NOT NULL,
    "channelVariantExternalId" TEXT,
    "channelVariantId" TEXT,
    "quantity" DECIMAL(10,4) NOT NULL,
    "price" DECIMAL(10,2),
    "cost" DECIMAL(10,2),
    "lineNote" TEXT,
    "rawPayload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "channel_receipt_line_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "channel_receipt_line_item_discounts" (
    "id" TEXT NOT NULL,
    "channel" "Channel" NOT NULL,
    "channelReceiptLineItemId" TEXT NOT NULL,
    "externalDiscountId" TEXT,
    "rawPayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "channel_receipt_line_item_discounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "channel_receipt_line_item_taxes" (
    "id" TEXT NOT NULL,
    "channel" "Channel" NOT NULL,
    "channelReceiptLineItemId" TEXT NOT NULL,
    "externalTaxId" TEXT,
    "rawPayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "channel_receipt_line_item_taxes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "channel_receipt_line_item_modifiers" (
    "id" TEXT NOT NULL,
    "channel" "Channel" NOT NULL,
    "channelReceiptLineItemId" TEXT NOT NULL,
    "channelModifierOptionExternalId" TEXT,
    "channelModifierOptionId" TEXT,
    "price" DECIMAL(10,2),
    "rawPayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "channel_receipt_line_item_modifiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "channel_receipt_payments" (
    "id" TEXT NOT NULL,
    "channel" "Channel" NOT NULL,
    "channelReceiptId" TEXT NOT NULL,
    "channelPaymentTypeExternalId" TEXT,
    "channelPaymentTypeId" TEXT,
    "paidAt" TIMESTAMP(3),
    "amount" DECIMAL(10,2),
    "rawPayload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "channel_receipt_payments_pkey" PRIMARY KEY ("id")
);

-- ─── Step 9: Create sync job tables ───────────────────────────────────────────

-- CreateTable
CREATE TABLE "sync_jobs" (
    "id" TEXT NOT NULL,
    "channel" "Channel" NOT NULL,
    "syncType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "summary" JSONB,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sync_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_job_logs" (
    "id" TEXT NOT NULL,
    "syncJobId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityExternalId" TEXT,
    "action" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sync_job_logs_pkey" PRIMARY KEY ("id")
);

-- ─── Step 10: Recreate subscription_item_options (schema changed) ─────────────

-- CreateTable
CREATE TABLE "subscription_item_options" (
    "id" TEXT NOT NULL,
    "subscriptionItemId" TEXT NOT NULL,
    "optionGroupNameSnapshot" TEXT NOT NULL,
    "optionNameSnapshot" TEXT NOT NULL,
    "priceDeltaSnapshot" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscription_item_options_pkey" PRIMARY KEY ("id")
);

-- ─── Step 11: Add itemId column to subscription_items ─────────────────────────

ALTER TABLE "subscription_items" ADD COLUMN IF NOT EXISTS "itemId" TEXT;

-- ─── Step 12: Add foreign key constraints ─────────────────────────────────────

-- items -> categories
ALTER TABLE "items" ADD CONSTRAINT "items_categoryId_fkey"
    FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- item_variants -> items
ALTER TABLE "item_variants" ADD CONSTRAINT "item_variants_itemId_fkey"
    FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- modifier_options -> modifier_groups
ALTER TABLE "modifier_options" ADD CONSTRAINT "modifier_options_modifierGroupId_fkey"
    FOREIGN KEY ("modifierGroupId") REFERENCES "modifier_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- item_modifier_groups -> items + modifier_groups
ALTER TABLE "item_modifier_groups" ADD CONSTRAINT "item_modifier_groups_itemId_fkey"
    FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "item_modifier_groups" ADD CONSTRAINT "item_modifier_groups_modifierGroupId_fkey"
    FOREIGN KEY ("modifierGroupId") REFERENCES "modifier_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- channel_items -> channel_categories
ALTER TABLE "channel_items" ADD CONSTRAINT "channel_items_channelCategoryId_fkey"
    FOREIGN KEY ("channelCategoryId") REFERENCES "channel_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- channel_item_components -> channel_items
ALTER TABLE "channel_item_components" ADD CONSTRAINT "channel_item_components_channelItemId_fkey"
    FOREIGN KEY ("channelItemId") REFERENCES "channel_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- channel_item_tax_links -> channel_items
ALTER TABLE "channel_item_tax_links" ADD CONSTRAINT "channel_item_tax_links_channelItemId_fkey"
    FOREIGN KEY ("channelItemId") REFERENCES "channel_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- channel_item_modifier_group_links -> channel_items
ALTER TABLE "channel_item_modifier_group_links" ADD CONSTRAINT "channel_item_modifier_group_links_channelItemId_fkey"
    FOREIGN KEY ("channelItemId") REFERENCES "channel_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- channel_variants -> channel_items
ALTER TABLE "channel_variants" ADD CONSTRAINT "channel_variants_channelItemId_fkey"
    FOREIGN KEY ("channelItemId") REFERENCES "channel_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- channel_variant_store_data -> channel_variants
ALTER TABLE "channel_variant_store_data" ADD CONSTRAINT "channel_variant_store_data_channelVariantId_fkey"
    FOREIGN KEY ("channelVariantId") REFERENCES "channel_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- channel_modifier_group_store_links -> channel_modifier_groups
ALTER TABLE "channel_modifier_group_store_links" ADD CONSTRAINT "channel_modifier_group_store_links_channelModifierGroupId_fkey"
    FOREIGN KEY ("channelModifierGroupId") REFERENCES "channel_modifier_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- channel_modifier_options -> channel_modifier_groups
ALTER TABLE "channel_modifier_options" ADD CONSTRAINT "channel_modifier_options_channelModifierGroupId_fkey"
    FOREIGN KEY ("channelModifierGroupId") REFERENCES "channel_modifier_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- channel_payment_type_store_links -> channel_payment_types
ALTER TABLE "channel_payment_type_store_links" ADD CONSTRAINT "channel_payment_type_store_links_channelPaymentTypeId_fkey"
    FOREIGN KEY ("channelPaymentTypeId") REFERENCES "channel_payment_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- category_channel_mappings -> categories + channel_categories
ALTER TABLE "category_channel_mappings" ADD CONSTRAINT "category_channel_mappings_categoryId_fkey"
    FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "category_channel_mappings" ADD CONSTRAINT "category_channel_mappings_channelCategoryId_fkey"
    FOREIGN KEY ("channelCategoryId") REFERENCES "channel_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- item_channel_mappings -> items + channel_items
ALTER TABLE "item_channel_mappings" ADD CONSTRAINT "item_channel_mappings_itemId_fkey"
    FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "item_channel_mappings" ADD CONSTRAINT "item_channel_mappings_channelItemId_fkey"
    FOREIGN KEY ("channelItemId") REFERENCES "channel_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- item_variant_channel_mappings -> item_variants + channel_variants
ALTER TABLE "item_variant_channel_mappings" ADD CONSTRAINT "item_variant_channel_mappings_itemVariantId_fkey"
    FOREIGN KEY ("itemVariantId") REFERENCES "item_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "item_variant_channel_mappings" ADD CONSTRAINT "item_variant_channel_mappings_channelVariantId_fkey"
    FOREIGN KEY ("channelVariantId") REFERENCES "channel_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- modifier_group_channel_mappings -> modifier_groups + channel_modifier_groups
ALTER TABLE "modifier_group_channel_mappings" ADD CONSTRAINT "modifier_group_channel_mappings_modifierGroupId_fkey"
    FOREIGN KEY ("modifierGroupId") REFERENCES "modifier_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "modifier_group_channel_mappings" ADD CONSTRAINT "modifier_group_channel_mappings_channelModifierGroupId_fkey"
    FOREIGN KEY ("channelModifierGroupId") REFERENCES "channel_modifier_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- modifier_option_channel_mappings -> modifier_options + channel_modifier_options
ALTER TABLE "modifier_option_channel_mappings" ADD CONSTRAINT "modifier_option_channel_mappings_modifierOptionId_fkey"
    FOREIGN KEY ("modifierOptionId") REFERENCES "modifier_options"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "modifier_option_channel_mappings" ADD CONSTRAINT "modifier_option_channel_mappings_channelModifierOptionId_fkey"
    FOREIGN KEY ("channelModifierOptionId") REFERENCES "channel_modifier_options"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- channel_receipt_discounts -> channel_receipts
ALTER TABLE "channel_receipt_discounts" ADD CONSTRAINT "channel_receipt_discounts_channelReceiptId_fkey"
    FOREIGN KEY ("channelReceiptId") REFERENCES "channel_receipts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- channel_receipt_line_items -> channel_receipts + channel_variants (nullable)
ALTER TABLE "channel_receipt_line_items" ADD CONSTRAINT "channel_receipt_line_items_channelReceiptId_fkey"
    FOREIGN KEY ("channelReceiptId") REFERENCES "channel_receipts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "channel_receipt_line_items" ADD CONSTRAINT "channel_receipt_line_items_channelVariantId_fkey"
    FOREIGN KEY ("channelVariantId") REFERENCES "channel_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- channel_receipt_line_item_discounts -> channel_receipt_line_items
ALTER TABLE "channel_receipt_line_item_discounts" ADD CONSTRAINT "channel_receipt_line_item_discounts_channelReceiptLineItemId_fkey"
    FOREIGN KEY ("channelReceiptLineItemId") REFERENCES "channel_receipt_line_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- channel_receipt_line_item_taxes -> channel_receipt_line_items
ALTER TABLE "channel_receipt_line_item_taxes" ADD CONSTRAINT "channel_receipt_line_item_taxes_channelReceiptLineItemId_fkey"
    FOREIGN KEY ("channelReceiptLineItemId") REFERENCES "channel_receipt_line_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- channel_receipt_line_item_modifiers -> channel_receipt_line_items + channel_modifier_options
ALTER TABLE "channel_receipt_line_item_modifiers" ADD CONSTRAINT "channel_receipt_line_item_modifiers_channelReceiptLineItemId_fkey"
    FOREIGN KEY ("channelReceiptLineItemId") REFERENCES "channel_receipt_line_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "channel_receipt_line_item_modifiers" ADD CONSTRAINT "channel_receipt_line_item_modifiers_channelModifierOptionId_fkey"
    FOREIGN KEY ("channelModifierOptionId") REFERENCES "channel_modifier_options"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- channel_receipt_payments -> channel_receipts + channel_payment_types
ALTER TABLE "channel_receipt_payments" ADD CONSTRAINT "channel_receipt_payments_channelReceiptId_fkey"
    FOREIGN KEY ("channelReceiptId") REFERENCES "channel_receipts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "channel_receipt_payments" ADD CONSTRAINT "channel_receipt_payments_channelPaymentTypeId_fkey"
    FOREIGN KEY ("channelPaymentTypeId") REFERENCES "channel_payment_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- sync_job_logs -> sync_jobs
ALTER TABLE "sync_job_logs" ADD CONSTRAINT "sync_job_logs_syncJobId_fkey"
    FOREIGN KEY ("syncJobId") REFERENCES "sync_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- subscription_item_options -> subscription_items
ALTER TABLE "subscription_item_options" ADD CONSTRAINT "subscription_item_options_subscriptionItemId_fkey"
    FOREIGN KEY ("subscriptionItemId") REFERENCES "subscription_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- subscription_items -> items (new nullable FK)
ALTER TABLE "subscription_items" ADD CONSTRAINT "subscription_items_itemId_fkey"
    FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ─── Step 13: Create unique constraints ───────────────────────────────────────

ALTER TABLE "item_modifier_groups" ADD CONSTRAINT "item_modifier_groups_itemId_modifierGroupId_key"
    UNIQUE ("itemId", "modifierGroupId");

ALTER TABLE "channel_categories" ADD CONSTRAINT "channel_categories_channel_externalId_key"
    UNIQUE ("channel", "externalId");

ALTER TABLE "channel_items" ADD CONSTRAINT "channel_items_channel_externalId_key"
    UNIQUE ("channel", "externalId");

ALTER TABLE "channel_item_tax_links" ADD CONSTRAINT "channel_item_tax_links_channel_channelItemId_taxExternalId_key"
    UNIQUE ("channel", "channelItemId", "taxExternalId");

ALTER TABLE "channel_item_modifier_group_links" ADD CONSTRAINT "channel_item_modifier_group_links_channel_channelItemId_key"
    UNIQUE ("channel", "channelItemId", "channelModifierGroupExternalId");

ALTER TABLE "channel_variants" ADD CONSTRAINT "channel_variants_channel_externalId_key"
    UNIQUE ("channel", "externalId");

ALTER TABLE "channel_variant_store_data" ADD CONSTRAINT "channel_variant_store_data_channel_channelVariantId_storeExternalId_key"
    UNIQUE ("channel", "channelVariantId", "storeExternalId");

ALTER TABLE "channel_modifier_groups" ADD CONSTRAINT "channel_modifier_groups_channel_externalId_key"
    UNIQUE ("channel", "externalId");

ALTER TABLE "channel_modifier_group_store_links" ADD CONSTRAINT "channel_modifier_group_store_links_channel_channelModifierGroupId_storeExternalId_key"
    UNIQUE ("channel", "channelModifierGroupId", "storeExternalId");

ALTER TABLE "channel_modifier_options" ADD CONSTRAINT "channel_modifier_options_channel_externalId_key"
    UNIQUE ("channel", "externalId");

ALTER TABLE "channel_payment_types" ADD CONSTRAINT "channel_payment_types_channel_externalId_key"
    UNIQUE ("channel", "externalId");

ALTER TABLE "channel_payment_type_store_links" ADD CONSTRAINT "channel_payment_type_store_links_channel_channelPaymentTypeId_storeExternalId_key"
    UNIQUE ("channel", "channelPaymentTypeId", "storeExternalId");

ALTER TABLE "category_channel_mappings" ADD CONSTRAINT "category_channel_mappings_categoryId_channel_channelCategoryId_key"
    UNIQUE ("categoryId", "channel", "channelCategoryId");

ALTER TABLE "item_channel_mappings" ADD CONSTRAINT "item_channel_mappings_itemId_channel_channelItemId_key"
    UNIQUE ("itemId", "channel", "channelItemId");

ALTER TABLE "item_variant_channel_mappings" ADD CONSTRAINT "item_variant_channel_mappings_itemVariantId_channel_channelVariantId_key"
    UNIQUE ("itemVariantId", "channel", "channelVariantId");

ALTER TABLE "modifier_group_channel_mappings" ADD CONSTRAINT "modifier_group_channel_mappings_modifierGroupId_channel_channelModifierGroupId_key"
    UNIQUE ("modifierGroupId", "channel", "channelModifierGroupId");

ALTER TABLE "modifier_option_channel_mappings" ADD CONSTRAINT "modifier_option_channel_mappings_modifierOptionId_channel_channelModifierOptionId_key"
    UNIQUE ("modifierOptionId", "channel", "channelModifierOptionId");

ALTER TABLE "channel_receipts" ADD CONSTRAINT "channel_receipts_channel_externalId_key"
    UNIQUE ("channel", "externalId");

-- ─── Step 14: Create indexes ───────────────────────────────────────────────────

-- categories
CREATE INDEX "categories_isActive_idx" ON "categories"("isActive");

-- items
CREATE INDEX "items_categoryId_idx" ON "items"("categoryId");
CREATE INDEX "items_isActive_idx" ON "items"("isActive");

-- item_variants
CREATE INDEX "item_variants_itemId_idx" ON "item_variants"("itemId");

-- modifier_groups
CREATE INDEX "modifier_groups_isActive_idx" ON "modifier_groups"("isActive");

-- modifier_options
CREATE INDEX "modifier_options_modifierGroupId_idx" ON "modifier_options"("modifierGroupId");

-- item_modifier_groups
CREATE INDEX "item_modifier_groups_itemId_idx" ON "item_modifier_groups"("itemId");
CREATE INDEX "item_modifier_groups_modifierGroupId_idx" ON "item_modifier_groups"("modifierGroupId");

-- channel_categories
CREATE INDEX "channel_categories_channel_externalId_idx" ON "channel_categories"("channel", "externalId");
CREATE INDEX "channel_categories_syncedAt_idx" ON "channel_categories"("syncedAt");

-- channel_items
CREATE INDEX "channel_items_channel_externalId_idx" ON "channel_items"("channel", "externalId");
CREATE INDEX "channel_items_syncedAt_idx" ON "channel_items"("syncedAt");

-- channel_item_components
CREATE INDEX "channel_item_components_channelItemId_idx" ON "channel_item_components"("channelItemId");

-- channel_item_tax_links
CREATE INDEX "channel_item_tax_links_channelItemId_idx" ON "channel_item_tax_links"("channelItemId");

-- channel_item_modifier_group_links
CREATE INDEX "channel_item_modifier_group_links_channelItemId_idx" ON "channel_item_modifier_group_links"("channelItemId");

-- channel_variants
CREATE INDEX "channel_variants_channel_externalId_idx" ON "channel_variants"("channel", "externalId");
CREATE INDEX "channel_variants_syncedAt_idx" ON "channel_variants"("syncedAt");

-- channel_variant_store_data
CREATE INDEX "channel_variant_store_data_channelVariantId_idx" ON "channel_variant_store_data"("channelVariantId");

-- channel_modifier_groups
CREATE INDEX "channel_modifier_groups_channel_externalId_idx" ON "channel_modifier_groups"("channel", "externalId");
CREATE INDEX "channel_modifier_groups_syncedAt_idx" ON "channel_modifier_groups"("syncedAt");

-- channel_modifier_group_store_links
CREATE INDEX "channel_modifier_group_store_links_channelModifierGroupId_idx" ON "channel_modifier_group_store_links"("channelModifierGroupId");

-- channel_modifier_options
CREATE INDEX "channel_modifier_options_channel_externalId_idx" ON "channel_modifier_options"("channel", "externalId");
CREATE INDEX "channel_modifier_options_channelModifierGroupId_idx" ON "channel_modifier_options"("channelModifierGroupId");
CREATE INDEX "channel_modifier_options_syncedAt_idx" ON "channel_modifier_options"("syncedAt");

-- channel_payment_types
CREATE INDEX "channel_payment_types_channel_externalId_idx" ON "channel_payment_types"("channel", "externalId");
CREATE INDEX "channel_payment_types_syncedAt_idx" ON "channel_payment_types"("syncedAt");

-- channel_payment_type_store_links
CREATE INDEX "channel_payment_type_store_links_channelPaymentTypeId_idx" ON "channel_payment_type_store_links"("channelPaymentTypeId");

-- category_channel_mappings
CREATE INDEX "category_channel_mappings_categoryId_idx" ON "category_channel_mappings"("categoryId");
CREATE INDEX "category_channel_mappings_channel_idx" ON "category_channel_mappings"("channel");
CREATE INDEX "category_channel_mappings_mappingStatus_idx" ON "category_channel_mappings"("mappingStatus");

-- item_channel_mappings
CREATE INDEX "item_channel_mappings_itemId_idx" ON "item_channel_mappings"("itemId");
CREATE INDEX "item_channel_mappings_channel_idx" ON "item_channel_mappings"("channel");
CREATE INDEX "item_channel_mappings_mappingStatus_idx" ON "item_channel_mappings"("mappingStatus");

-- item_variant_channel_mappings
CREATE INDEX "item_variant_channel_mappings_itemVariantId_idx" ON "item_variant_channel_mappings"("itemVariantId");
CREATE INDEX "item_variant_channel_mappings_channel_idx" ON "item_variant_channel_mappings"("channel");
CREATE INDEX "item_variant_channel_mappings_mappingStatus_idx" ON "item_variant_channel_mappings"("mappingStatus");

-- modifier_group_channel_mappings
CREATE INDEX "modifier_group_channel_mappings_modifierGroupId_idx" ON "modifier_group_channel_mappings"("modifierGroupId");
CREATE INDEX "modifier_group_channel_mappings_channel_idx" ON "modifier_group_channel_mappings"("channel");
CREATE INDEX "modifier_group_channel_mappings_mappingStatus_idx" ON "modifier_group_channel_mappings"("mappingStatus");

-- modifier_option_channel_mappings
CREATE INDEX "modifier_option_channel_mappings_modifierOptionId_idx" ON "modifier_option_channel_mappings"("modifierOptionId");
CREATE INDEX "modifier_option_channel_mappings_channel_idx" ON "modifier_option_channel_mappings"("channel");
CREATE INDEX "modifier_option_channel_mappings_mappingStatus_idx" ON "modifier_option_channel_mappings"("mappingStatus");

-- channel_receipts
CREATE INDEX "channel_receipts_channel_externalId_idx" ON "channel_receipts"("channel", "externalId");
CREATE INDEX "channel_receipts_receiptDate_idx" ON "channel_receipts"("receiptDate");
CREATE INDEX "channel_receipts_syncedAt_idx" ON "channel_receipts"("syncedAt");

-- channel_receipt_discounts
CREATE INDEX "channel_receipt_discounts_channelReceiptId_idx" ON "channel_receipt_discounts"("channelReceiptId");

-- channel_receipt_line_items
CREATE INDEX "channel_receipt_line_items_channelReceiptId_idx" ON "channel_receipt_line_items"("channelReceiptId");
CREATE INDEX "channel_receipt_line_items_channelVariantId_idx" ON "channel_receipt_line_items"("channelVariantId");

-- channel_receipt_line_item_discounts
CREATE INDEX "channel_receipt_line_item_discounts_channelReceiptLineItemId_idx" ON "channel_receipt_line_item_discounts"("channelReceiptLineItemId");

-- channel_receipt_line_item_taxes
CREATE INDEX "channel_receipt_line_item_taxes_channelReceiptLineItemId_idx" ON "channel_receipt_line_item_taxes"("channelReceiptLineItemId");

-- channel_receipt_line_item_modifiers
CREATE INDEX "channel_receipt_line_item_modifiers_channelReceiptLineItemId_idx" ON "channel_receipt_line_item_modifiers"("channelReceiptLineItemId");
CREATE INDEX "channel_receipt_line_item_modifiers_channelModifierOptionId_idx" ON "channel_receipt_line_item_modifiers"("channelModifierOptionId");

-- channel_receipt_payments
CREATE INDEX "channel_receipt_payments_channelReceiptId_idx" ON "channel_receipt_payments"("channelReceiptId");
CREATE INDEX "channel_receipt_payments_channelPaymentTypeId_idx" ON "channel_receipt_payments"("channelPaymentTypeId");

-- sync_jobs
CREATE INDEX "sync_jobs_channel_status_idx" ON "sync_jobs"("channel", "status");
CREATE INDEX "sync_jobs_startedAt_idx" ON "sync_jobs"("startedAt" DESC);

-- sync_job_logs
CREATE INDEX "sync_job_logs_syncJobId_idx" ON "sync_job_logs"("syncJobId");
CREATE INDEX "sync_job_logs_status_idx" ON "sync_job_logs"("status");

-- subscription_item_options
CREATE INDEX "subscription_item_options_subscriptionItemId_idx" ON "subscription_item_options"("subscriptionItemId");

-- ─── Drop Order / Subscription tables and enums ───────────────────────────────
-- These models have been removed from the schema in favour of the channel_ mirror layer.

DROP TABLE IF EXISTS "subscription_item_options" CASCADE;
DROP TABLE IF EXISTS "subscription_items" CASCADE;
DROP TABLE IF EXISTS "subscription_occurrences" CASCADE;
DROP TABLE IF EXISTS "subscriptions" CASCADE;
DROP TABLE IF EXISTS "order_item_options" CASCADE;
DROP TABLE IF EXISTS "order_items" CASCADE;
DROP TABLE IF EXISTS "external_order_maps" CASCADE;
DROP TABLE IF EXISTS "orders" CASCADE;

DROP TYPE IF EXISTS "OrderStatus";
DROP TYPE IF EXISTS "PaymentStatus";
DROP TYPE IF EXISTS "FulfillmentType";
DROP TYPE IF EXISTS "OrderSource";
DROP TYPE IF EXISTS "IntegrationSource";
DROP TYPE IF EXISTS "SubscriptionStatus";
DROP TYPE IF EXISTS "OccurrenceStatus";
