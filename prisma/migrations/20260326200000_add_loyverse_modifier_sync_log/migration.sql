-- CreateTable
CREATE TABLE "loyverse_modifier_sync_logs" (
    "id" TEXT NOT NULL,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL,
    "groupCount" INTEGER NOT NULL DEFAULT 0,
    "optionCount" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "errorCode" INTEGER,
    "rawGroups" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "loyverse_modifier_sync_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "loyverse_modifier_sync_logs_syncedAt_idx" ON "loyverse_modifier_sync_logs"("syncedAt");
