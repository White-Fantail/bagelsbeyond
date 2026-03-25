-- Add ScheduledTask and TaskLog tables, update sales_predictions method default

-- CreateTable: scheduled_tasks
CREATE TABLE IF NOT EXISTS "scheduled_tasks" (
    "id" TEXT NOT NULL,
    "taskType" TEXT NOT NULL,
    "targetDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'pending',
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "resultSummary" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scheduled_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable: task_logs
CREATE TABLE IF NOT EXISTS "task_logs" (
    "id" TEXT NOT NULL,
    "scheduledTaskId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "level" TEXT NOT NULL DEFAULT 'info',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "scheduled_tasks_status_idx" ON "scheduled_tasks"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "scheduled_tasks_taskType_targetDate_idx" ON "scheduled_tasks"("taskType", "targetDate");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "scheduled_tasks_targetDate_idx" ON "scheduled_tasks"("targetDate");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "task_logs_scheduledTaskId_idx" ON "task_logs"("scheduledTaskId");

-- AddForeignKey
ALTER TABLE "task_logs" ADD CONSTRAINT "task_logs_scheduledTaskId_fkey"
    FOREIGN KEY ("scheduledTaskId") REFERENCES "scheduled_tasks"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable: update default value for sales_predictions.method
ALTER TABLE "sales_predictions" ALTER COLUMN "method" SET DEFAULT 'rule_based_v2';
