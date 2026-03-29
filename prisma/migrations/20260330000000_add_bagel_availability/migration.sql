-- CreateEnum
CREATE TYPE "bagel_change_source" AS ENUM ('manual', 'voice', 'sync', 'system', 'api');

-- CreateEnum
CREATE TYPE "availability_channel" AS ENUM ('loyverse', 'uber_eats', 'doordash');

-- CreateEnum
CREATE TYPE "channel_sync_result" AS ENUM ('success', 'failed', 'pending', 'skipped');

-- CreateEnum
CREATE TYPE "availability_audit_action" AS ENUM ('turned_on', 'turned_off', 'retried', 'restored');

-- CreateEnum
CREATE TYPE "remote_entity_type" AS ENUM ('item', 'option', 'modifier_option', 'category_item', 'unknown');

-- CreateEnum
CREATE TYPE "sync_job_status" AS ENUM ('pending', 'processing', 'success', 'failed');

-- CreateTable
CREATE TABLE "bagel_types" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bagel_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bagel_availability_states" (
    "id" TEXT NOT NULL,
    "bagelTypeId" TEXT NOT NULL,
    "isAvailable" BOOLEAN NOT NULL,
    "changedByUserId" TEXT,
    "changeSource" "bagel_change_source" NOT NULL DEFAULT 'manual',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bagel_availability_states_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "channel_sync_statuses" (
    "id" TEXT NOT NULL,
    "bagelTypeId" TEXT NOT NULL,
    "channel" "availability_channel" NOT NULL,
    "lastAttemptAt" TIMESTAMP(3),
    "lastSuccessAt" TIMESTAMP(3),
    "lastResult" "channel_sync_result" NOT NULL DEFAULT 'pending',
    "lastError" TEXT,
    "lastKnownRemoteState" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "channel_sync_statuses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "channel_bagel_mappings" (
    "id" TEXT NOT NULL,
    "bagelTypeId" TEXT NOT NULL,
    "channel" "availability_channel" NOT NULL,
    "remoteEntityType" "remote_entity_type" NOT NULL DEFAULT 'unknown',
    "remoteEntityId" TEXT NOT NULL,
    "remoteMenuId" TEXT,
    "remoteStoreId" TEXT,
    "metadata" JSONB,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "channel_bagel_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "availability_audit_logs" (
    "id" TEXT NOT NULL,
    "bagelTypeId" TEXT NOT NULL,
    "action" "availability_audit_action" NOT NULL,
    "source" "bagel_change_source" NOT NULL,
    "actorUserId" TEXT,
    "actorLabel" TEXT,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "availability_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "availability_sync_jobs" (
    "id" TEXT NOT NULL,
    "bagelTypeId" TEXT NOT NULL,
    "channel" "availability_channel" NOT NULL,
    "targetState" BOOLEAN NOT NULL,
    "status" "sync_job_status" NOT NULL DEFAULT 'pending',
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "maxRetries" INTEGER NOT NULL DEFAULT 3,
    "nextRetryAt" TIMESTAMP(3),
    "lastError" TEXT,
    "requestPayload" JSONB,
    "responsePayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "availability_sync_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "bagel_types_code_key" ON "bagel_types"("code");

-- CreateIndex
CREATE INDEX "bagel_types_code_idx" ON "bagel_types"("code");

-- CreateIndex
CREATE INDEX "bagel_types_sortOrder_idx" ON "bagel_types"("sortOrder");

-- CreateIndex
CREATE INDEX "bagel_availability_states_bagelTypeId_createdAt_idx" ON "bagel_availability_states"("bagelTypeId", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "channel_sync_statuses_bagelTypeId_channel_key" ON "channel_sync_statuses"("bagelTypeId", "channel");

-- CreateIndex
CREATE INDEX "channel_sync_statuses_bagelTypeId_idx" ON "channel_sync_statuses"("bagelTypeId");

-- CreateIndex
CREATE UNIQUE INDEX "channel_bagel_mappings_bagelTypeId_channel_remoteEntityId_key" ON "channel_bagel_mappings"("bagelTypeId", "channel", "remoteEntityId");

-- CreateIndex
CREATE INDEX "channel_bagel_mappings_bagelTypeId_channel_idx" ON "channel_bagel_mappings"("bagelTypeId", "channel");

-- CreateIndex
CREATE INDEX "availability_audit_logs_bagelTypeId_createdAt_idx" ON "availability_audit_logs"("bagelTypeId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "availability_audit_logs_createdAt_idx" ON "availability_audit_logs"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "availability_sync_jobs_status_nextRetryAt_idx" ON "availability_sync_jobs"("status", "nextRetryAt");

-- CreateIndex
CREATE INDEX "availability_sync_jobs_bagelTypeId_idx" ON "availability_sync_jobs"("bagelTypeId");

-- AddForeignKey
ALTER TABLE "bagel_availability_states" ADD CONSTRAINT "bagel_availability_states_bagelTypeId_fkey" FOREIGN KEY ("bagelTypeId") REFERENCES "bagel_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bagel_availability_states" ADD CONSTRAINT "bagel_availability_states_changedByUserId_fkey" FOREIGN KEY ("changedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel_sync_statuses" ADD CONSTRAINT "channel_sync_statuses_bagelTypeId_fkey" FOREIGN KEY ("bagelTypeId") REFERENCES "bagel_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel_bagel_mappings" ADD CONSTRAINT "channel_bagel_mappings_bagelTypeId_fkey" FOREIGN KEY ("bagelTypeId") REFERENCES "bagel_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "availability_audit_logs" ADD CONSTRAINT "availability_audit_logs_bagelTypeId_fkey" FOREIGN KEY ("bagelTypeId") REFERENCES "bagel_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "availability_sync_jobs" ADD CONSTRAINT "availability_sync_jobs_bagelTypeId_fkey" FOREIGN KEY ("bagelTypeId") REFERENCES "bagel_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;
