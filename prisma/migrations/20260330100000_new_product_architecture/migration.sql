-- ============================================================================
-- Migration: New Product Architecture
-- Adds canonical layer, channel mirror layer, and mapping layer for product data.
-- Also enhances existing canonical models with new fields.
-- Soft-delete friendly: isDeleted used instead of hard deletes in mirror tables.
-- ============================================================================

-- ─── New Enums ────────────────────────────────────────────────────────────────

CREATE TYPE "ChannelType" AS ENUM ('LOYVERSE', 'UBER_EATS', 'DOORDASH');
CREATE TYPE "MappingStatus" AS ENUM ('ACTIVE', 'UNMAPPED', 'ERROR', 'DISABLED');
CREATE TYPE "SyncDirection" AS ENUM ('PULL', 'PUSH', 'BIDIRECTIONAL');
CREATE TYPE "ProductStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ARCHIVED');

-- ─── Canonical Category ───────────────────────────────────────────────────────

CREATE TABLE "categories" (
    "id"           TEXT NOT NULL,
    "name"         TEXT NOT NULL,
    "slug"         TEXT NOT NULL,
    "description"  TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isVisible"    BOOLEAN NOT NULL DEFAULT true,
    "isActive"     BOOLEAN NOT NULL DEFAULT true,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL,
    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "categories_slug_key" ON "categories"("slug");
CREATE INDEX "categories_isActive_idx" ON "categories"("isActive");
CREATE INDEX "categories_isVisible_idx" ON "categories"("isVisible");

-- ─── Enhance Product (add canonical fields) ───────────────────────────────────

ALTER TABLE "products"
    ADD COLUMN "categoryId"      TEXT,
    ADD COLUMN "displayOrder"    INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "isVisible"       BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN "status"          "ProductStatus" NOT NULL DEFAULT 'ACTIVE',
    ADD COLUMN "imageUrl"        TEXT,
    ADD COLUMN "sku"             TEXT,
    ADD COLUMN "trackInventory"  BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN "soldOut"         BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN "voiceAlias"      TEXT,
    ADD COLUMN "notes"           TEXT;

CREATE INDEX "products_categoryId_idx" ON "products"("categoryId");

-- ─── Enhance ProductOptionGroup (canonical ModifierGroup) ─────────────────────

ALTER TABLE "product_option_groups"
    ADD COLUMN "description"  TEXT,
    ADD COLUMN "displayOrder" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "isVisible"    BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN "isActive"     BOOLEAN NOT NULL DEFAULT true;

-- ─── Enhance ProductOption (canonical ModifierOption) ────────────────────────

ALTER TABLE "product_options"
    ADD COLUMN "description"  TEXT,
    ADD COLUMN "displayOrder" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "soldOut"      BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN "voiceAlias"   TEXT;

-- ─── Enhance ProductOptionGroupAssignment (canonical ProductModifierGroup) ────
-- Change from composite PK to surrogate PK + unique constraint.

-- Step 1: Add new columns
ALTER TABLE "product_option_group_assignments"
    ADD COLUMN "id"                TEXT,
    ADD COLUMN "displayOrder"      INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "isRequired"        BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN "minSelectOverride" INTEGER,
    ADD COLUMN "maxSelectOverride" INTEGER,
    ADD COLUMN "updatedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Step 2: Populate the new id column
UPDATE "product_option_group_assignments"
SET "id" = gen_random_uuid()::text
WHERE "id" IS NULL;

-- Step 3: Enforce NOT NULL on id
ALTER TABLE "product_option_group_assignments"
    ALTER COLUMN "id" SET NOT NULL;

-- Step 4: Drop old composite PK and add new surrogate PK
ALTER TABLE "product_option_group_assignments" DROP CONSTRAINT "product_option_group_assignments_pkey";
ALTER TABLE "product_option_group_assignments" ADD CONSTRAINT "product_option_group_assignments_pkey" PRIMARY KEY ("id");

-- Step 5: Add unique constraint on the old composite key
CREATE UNIQUE INDEX "product_option_group_assignments_productId_optionGroupId_key"
    ON "product_option_group_assignments"("productId", "optionGroupId");

-- ─── Channel Mirror Tables ────────────────────────────────────────────────────

CREATE TABLE "channel_categories" (
    "id"                TEXT NOT NULL,
    "channel"           "ChannelType" NOT NULL,
    "externalId"        TEXT NOT NULL,
    "name"              TEXT NOT NULL,
    "description"       TEXT,
    "displayOrder"      INTEGER,
    "isVisible"         BOOLEAN,
    "isActive"          BOOLEAN,
    "rawPayload"        JSONB NOT NULL,
    "externalCreatedAt" TIMESTAMP(3),
    "externalUpdatedAt" TIMESTAMP(3),
    "lastSyncedAt"      TIMESTAMP(3) NOT NULL,
    "isDeleted"         BOOLEAN NOT NULL DEFAULT false,
    "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"         TIMESTAMP(3) NOT NULL,
    CONSTRAINT "channel_categories_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "channel_categories_channel_externalId_key" ON "channel_categories"("channel", "externalId");
CREATE INDEX "channel_categories_channel_idx" ON "channel_categories"("channel");
CREATE INDEX "channel_categories_isDeleted_idx" ON "channel_categories"("isDeleted");

CREATE TABLE "channel_products" (
    "id"                 TEXT NOT NULL,
    "channel"            "ChannelType" NOT NULL,
    "externalId"         TEXT NOT NULL,
    "externalCategoryId" TEXT,
    "name"               TEXT NOT NULL,
    "description"        TEXT,
    "price"              DOUBLE PRECISION,
    "sku"                TEXT,
    "imageUrl"           TEXT,
    "displayOrder"       INTEGER,
    "isVisible"          BOOLEAN,
    "isActive"           BOOLEAN,
    "rawPayload"         JSONB NOT NULL,
    "externalCreatedAt"  TIMESTAMP(3),
    "externalUpdatedAt"  TIMESTAMP(3),
    "lastSyncedAt"       TIMESTAMP(3) NOT NULL,
    "isDeleted"          BOOLEAN NOT NULL DEFAULT false,
    "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"          TIMESTAMP(3) NOT NULL,
    CONSTRAINT "channel_products_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "channel_products_channel_externalId_key" ON "channel_products"("channel", "externalId");
CREATE INDEX "channel_products_channel_idx" ON "channel_products"("channel");
CREATE INDEX "channel_products_isDeleted_idx" ON "channel_products"("isDeleted");

CREATE TABLE "channel_modifier_groups" (
    "id"                TEXT NOT NULL,
    "channel"           "ChannelType" NOT NULL,
    "externalId"        TEXT NOT NULL,
    "name"              TEXT NOT NULL,
    "description"       TEXT,
    "minSelect"         INTEGER,
    "maxSelect"         INTEGER,
    "rawPayload"        JSONB NOT NULL,
    "externalCreatedAt" TIMESTAMP(3),
    "externalUpdatedAt" TIMESTAMP(3),
    "lastSyncedAt"      TIMESTAMP(3) NOT NULL,
    "isDeleted"         BOOLEAN NOT NULL DEFAULT false,
    "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"         TIMESTAMP(3) NOT NULL,
    CONSTRAINT "channel_modifier_groups_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "channel_modifier_groups_channel_externalId_key" ON "channel_modifier_groups"("channel", "externalId");
CREATE INDEX "channel_modifier_groups_channel_idx" ON "channel_modifier_groups"("channel");
CREATE INDEX "channel_modifier_groups_isDeleted_idx" ON "channel_modifier_groups"("isDeleted");

CREATE TABLE "channel_modifier_options" (
    "id"                     TEXT NOT NULL,
    "channel"                "ChannelType" NOT NULL,
    "externalId"             TEXT NOT NULL,
    "channelModifierGroupId" TEXT NOT NULL,
    "name"                   TEXT NOT NULL,
    "priceDelta"             DOUBLE PRECISION NOT NULL DEFAULT 0,
    "rawPayload"             JSONB NOT NULL,
    "externalCreatedAt"      TIMESTAMP(3),
    "externalUpdatedAt"      TIMESTAMP(3),
    "lastSyncedAt"           TIMESTAMP(3) NOT NULL,
    "isDeleted"              BOOLEAN NOT NULL DEFAULT false,
    "createdAt"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"              TIMESTAMP(3) NOT NULL,
    CONSTRAINT "channel_modifier_options_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "channel_modifier_options_channel_externalId_key" ON "channel_modifier_options"("channel", "externalId");
CREATE INDEX "channel_modifier_options_channelModifierGroupId_idx" ON "channel_modifier_options"("channelModifierGroupId");
CREATE INDEX "channel_modifier_options_isDeleted_idx" ON "channel_modifier_options"("isDeleted");

CREATE TABLE "channel_product_modifier_group_links" (
    "id"                     TEXT NOT NULL,
    "channel"                "ChannelType" NOT NULL,
    "channelProductId"       TEXT NOT NULL,
    "channelModifierGroupId" TEXT NOT NULL,
    "displayOrder"           INTEGER,
    "isRequired"             BOOLEAN,
    "rawPayload"             JSONB NOT NULL DEFAULT '{}',
    "lastSyncedAt"           TIMESTAMP(3) NOT NULL,
    "isDeleted"              BOOLEAN NOT NULL DEFAULT false,
    "createdAt"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"              TIMESTAMP(3) NOT NULL,
    CONSTRAINT "channel_product_modifier_group_links_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "channel_product_modifier_group_links_channel_channelProductId_channelModifierGroupId_key"
    ON "channel_product_modifier_group_links"("channel", "channelProductId", "channelModifierGroupId");
CREATE INDEX "channel_product_modifier_group_links_channelProductId_idx" ON "channel_product_modifier_group_links"("channelProductId");
CREATE INDEX "channel_product_modifier_group_links_channelModifierGroupId_idx" ON "channel_product_modifier_group_links"("channelModifierGroupId");

-- ─── Mapping Tables ───────────────────────────────────────────────────────────

CREATE TABLE "category_channel_mappings" (
    "id"                TEXT NOT NULL,
    "categoryId"        TEXT NOT NULL,
    "channel"           "ChannelType" NOT NULL,
    "channelCategoryId" TEXT NOT NULL,
    "status"            "MappingStatus" NOT NULL DEFAULT 'ACTIVE',
    "syncDirection"     "SyncDirection" NOT NULL DEFAULT 'PULL',
    "lastMappedAt"      TIMESTAMP(3) NOT NULL,
    "lastSyncAt"        TIMESTAMP(3),
    "lastPushAt"        TIMESTAMP(3),
    "lastError"         TEXT,
    "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"         TIMESTAMP(3) NOT NULL,
    CONSTRAINT "category_channel_mappings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "category_channel_mappings_categoryId_channel_key" ON "category_channel_mappings"("categoryId", "channel");
CREATE UNIQUE INDEX "category_channel_mappings_channelCategoryId_key" ON "category_channel_mappings"("channelCategoryId");
CREATE INDEX "category_channel_mappings_channel_idx" ON "category_channel_mappings"("channel");

CREATE TABLE "product_channel_mappings" (
    "id"               TEXT NOT NULL,
    "productId"        TEXT NOT NULL,
    "channel"          "ChannelType" NOT NULL,
    "channelProductId" TEXT NOT NULL,
    "status"           "MappingStatus" NOT NULL DEFAULT 'ACTIVE',
    "syncDirection"    "SyncDirection" NOT NULL DEFAULT 'PULL',
    "lastMappedAt"     TIMESTAMP(3) NOT NULL,
    "lastSyncAt"       TIMESTAMP(3),
    "lastPushAt"       TIMESTAMP(3),
    "lastError"        TEXT,
    "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"        TIMESTAMP(3) NOT NULL,
    CONSTRAINT "product_channel_mappings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "product_channel_mappings_productId_channel_key" ON "product_channel_mappings"("productId", "channel");
CREATE UNIQUE INDEX "product_channel_mappings_channelProductId_key" ON "product_channel_mappings"("channelProductId");
CREATE INDEX "product_channel_mappings_channel_idx" ON "product_channel_mappings"("channel");

CREATE TABLE "modifier_group_channel_mappings" (
    "id"                     TEXT NOT NULL,
    "modifierGroupId"        TEXT NOT NULL,
    "channel"                "ChannelType" NOT NULL,
    "channelModifierGroupId" TEXT NOT NULL,
    "status"                 "MappingStatus" NOT NULL DEFAULT 'ACTIVE',
    "syncDirection"          "SyncDirection" NOT NULL DEFAULT 'PULL',
    "lastMappedAt"           TIMESTAMP(3) NOT NULL,
    "lastSyncAt"             TIMESTAMP(3),
    "lastPushAt"             TIMESTAMP(3),
    "lastError"              TEXT,
    "createdAt"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"              TIMESTAMP(3) NOT NULL,
    CONSTRAINT "modifier_group_channel_mappings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "modifier_group_channel_mappings_modifierGroupId_channel_key" ON "modifier_group_channel_mappings"("modifierGroupId", "channel");
CREATE UNIQUE INDEX "modifier_group_channel_mappings_channelModifierGroupId_key" ON "modifier_group_channel_mappings"("channelModifierGroupId");
CREATE INDEX "modifier_group_channel_mappings_channel_idx" ON "modifier_group_channel_mappings"("channel");

CREATE TABLE "modifier_option_channel_mappings" (
    "id"                      TEXT NOT NULL,
    "modifierOptionId"        TEXT NOT NULL,
    "channel"                 "ChannelType" NOT NULL,
    "channelModifierOptionId" TEXT NOT NULL,
    "status"                  "MappingStatus" NOT NULL DEFAULT 'ACTIVE',
    "syncDirection"           "SyncDirection" NOT NULL DEFAULT 'PULL',
    "lastMappedAt"            TIMESTAMP(3) NOT NULL,
    "lastSyncAt"              TIMESTAMP(3),
    "lastPushAt"              TIMESTAMP(3),
    "lastError"               TEXT,
    "createdAt"               TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"               TIMESTAMP(3) NOT NULL,
    CONSTRAINT "modifier_option_channel_mappings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "modifier_option_channel_mappings_modifierOptionId_channel_key" ON "modifier_option_channel_mappings"("modifierOptionId", "channel");
CREATE UNIQUE INDEX "modifier_option_channel_mappings_channelModifierOptionId_key" ON "modifier_option_channel_mappings"("channelModifierOptionId");
CREATE INDEX "modifier_option_channel_mappings_channel_idx" ON "modifier_option_channel_mappings"("channel");

-- ─── Foreign Keys for Mapping Tables ─────────────────────────────────────────

ALTER TABLE "products"
    ADD CONSTRAINT "products_categoryId_fkey"
    FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "channel_modifier_options"
    ADD CONSTRAINT "channel_modifier_options_channelModifierGroupId_fkey"
    FOREIGN KEY ("channelModifierGroupId") REFERENCES "channel_modifier_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "channel_product_modifier_group_links"
    ADD CONSTRAINT "channel_product_modifier_group_links_channelProductId_fkey"
    FOREIGN KEY ("channelProductId") REFERENCES "channel_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "channel_product_modifier_group_links"
    ADD CONSTRAINT "channel_product_modifier_group_links_channelModifierGroupId_fkey"
    FOREIGN KEY ("channelModifierGroupId") REFERENCES "channel_modifier_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "category_channel_mappings"
    ADD CONSTRAINT "category_channel_mappings_categoryId_fkey"
    FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "category_channel_mappings"
    ADD CONSTRAINT "category_channel_mappings_channelCategoryId_fkey"
    FOREIGN KEY ("channelCategoryId") REFERENCES "channel_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "product_channel_mappings"
    ADD CONSTRAINT "product_channel_mappings_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "product_channel_mappings"
    ADD CONSTRAINT "product_channel_mappings_channelProductId_fkey"
    FOREIGN KEY ("channelProductId") REFERENCES "channel_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "modifier_group_channel_mappings"
    ADD CONSTRAINT "modifier_group_channel_mappings_modifierGroupId_fkey"
    FOREIGN KEY ("modifierGroupId") REFERENCES "product_option_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "modifier_group_channel_mappings"
    ADD CONSTRAINT "modifier_group_channel_mappings_channelModifierGroupId_fkey"
    FOREIGN KEY ("channelModifierGroupId") REFERENCES "channel_modifier_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "modifier_option_channel_mappings"
    ADD CONSTRAINT "modifier_option_channel_mappings_modifierOptionId_fkey"
    FOREIGN KEY ("modifierOptionId") REFERENCES "product_options"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "modifier_option_channel_mappings"
    ADD CONSTRAINT "modifier_option_channel_mappings_channelModifierOptionId_fkey"
    FOREIGN KEY ("channelModifierOptionId") REFERENCES "channel_modifier_options"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── Sync Job Tables ──────────────────────────────────────────────────────────

CREATE TABLE "sync_jobs" (
    "id"           TEXT NOT NULL,
    "channel"      "ChannelType" NOT NULL,
    "syncType"     TEXT NOT NULL,
    "status"       TEXT NOT NULL DEFAULT 'PENDING',
    "startedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt"   TIMESTAMP(3),
    "summary"      JSONB,
    "errorMessage" TEXT,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL,
    CONSTRAINT "sync_jobs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "sync_jobs_channel_status_idx" ON "sync_jobs"("channel", "status");
CREATE INDEX "sync_jobs_startedAt_idx" ON "sync_jobs"("startedAt" DESC);

CREATE TABLE "sync_job_logs" (
    "id"               TEXT NOT NULL,
    "syncJobId"        TEXT NOT NULL,
    "entityType"       TEXT NOT NULL,
    "entityExternalId" TEXT,
    "action"           TEXT NOT NULL,
    "status"           TEXT NOT NULL,
    "message"          TEXT NOT NULL,
    "payload"          JSONB,
    "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sync_job_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "sync_job_logs_syncJobId_idx" ON "sync_job_logs"("syncJobId");
CREATE INDEX "sync_job_logs_status_idx" ON "sync_job_logs"("status");

ALTER TABLE "sync_job_logs"
    ADD CONSTRAINT "sync_job_logs_syncJobId_fkey"
    FOREIGN KEY ("syncJobId") REFERENCES "sync_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
