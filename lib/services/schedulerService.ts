/**
 * Scheduler Service
 *
 * High-level orchestration: creates and immediately runs tasks for common
 * automation scenarios (ensure external factors, ensure predictions, etc.)
 *
 * All functions are safe to call from API routes, cron endpoints, or
 * import-completion hooks. Exceptions are caught and surfaced in TaskLog.
 */

import { prisma } from "@/lib/db";
import {
  scheduleExternalFactorCollection,
  schedulePredictionGeneration,
  runExternalFactorCollectionTask,
  runPredictionGenerationTask,
} from "@/lib/services/taskService";
import { getToday, getTomorrow, getDateRange, toDateKey } from "@/lib/task-utils";

// ─── External Factor Automation ───────────────────────────────────────────────

/**
 * Ensure external factors exist for `date`.
 * If they already exist the task is skipped (not re-collected).
 * Returns the task id.
 */
export async function ensureExternalFactorsForDate(
  date: Date,
  opts: { refresh?: boolean } = {}
): Promise<string> {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);

  if (!opts.refresh) {
    const existing = await prisma.dailyExternalFactor.findUnique({ where: { date: d } });
    if (existing) {
      // Create a record of the skip so the caller still has a task id
      const task = await prisma.scheduledTask.create({
        data: {
          taskType: "collect_external_factors",
          targetDate: d,
          status: "skipped",
          startedAt: new Date(),
          finishedAt: new Date(),
          resultSummary: "외부요인 이미 존재",
        },
      });
      await prisma.taskLog.create({
        data: { scheduledTaskId: task.id, message: `외부요인 이미 존재: ${toDateKey(d)}`, level: "info" },
      });
      return task.id;
    }
  }

  const taskId = await scheduleExternalFactorCollection(d);
  await runExternalFactorCollectionTask(taskId);
  return taskId;
}

/**
 * Ensure external factors exist for today and the next `n` days.
 */
export async function ensureExternalFactorsForNextDays(n: number): Promise<string[]> {
  const today = getToday();
  const ids: string[] = [];
  for (let i = 0; i <= n; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const id = await ensureExternalFactorsForDate(d);
    ids.push(id);
  }
  return ids;
}

/**
 * Schedule (and run) external-factor collection for every date in a range.
 * Dates that already have external factors are skipped unless refresh=true.
 */
export async function scheduleExternalFactorCollectionForDateRange(
  startDate: Date,
  endDate: Date,
  opts: { refresh?: boolean } = {}
): Promise<string[]> {
  const dates = getDateRange(startDate, endDate);
  const ids: string[] = [];
  for (const d of dates) {
    const id = await ensureExternalFactorsForDate(d, opts);
    ids.push(id);
  }
  return ids;
}

// ─── Prediction Automation ─────────────────────────────────────────────────────

/**
 * Ensure a prediction exists for `date`.
 * External factors are collected first if missing.
 * Returns the task id.
 */
export async function ensurePredictionForDate(
  date: Date,
  opts: { refresh?: boolean } = {}
): Promise<string> {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const end = new Date(d);
  end.setHours(23, 59, 59, 999);

  if (!opts.refresh) {
    const existing = await prisma.salesPrediction.findFirst({
      where: { targetDate: { gte: d, lte: end } },
    });
    if (existing) {
      const task = await prisma.scheduledTask.create({
        data: {
          taskType: "generate_prediction",
          targetDate: d,
          status: "skipped",
          startedAt: new Date(),
          finishedAt: new Date(),
          resultSummary: "예측 이미 존재",
        },
      });
      await prisma.taskLog.create({
        data: { scheduledTaskId: task.id, message: `예측 이미 존재: ${toDateKey(d)}`, level: "info" },
      });
      return task.id;
    }
  }

  const taskId = await schedulePredictionGeneration(d);
  await runPredictionGenerationTask(taskId);
  return taskId;
}

/**
 * Schedule a prediction task for `date` WITHOUT immediately running it.
 * Use this when you want to queue tasks and run them later via runPendingTasks().
 */
export async function schedulePredictionForDate(date: Date): Promise<string> {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return schedulePredictionGeneration(d);
}

/**
 * Schedule a prediction task for tomorrow.
 */
export async function schedulePredictionForNextDay(): Promise<string> {
  return schedulePredictionForDate(getTomorrow());
}

/**
 * Generate prediction for `date` only if external factors are ready.
 * If external factors are missing, this function also tries to collect them first.
 */
export async function generatePredictionIfExternalFactorsReady(date: Date): Promise<string> {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return ensurePredictionForDate(d);
}

// ─── Post-Import Pipeline ──────────────────────────────────────────────────────

/**
 * After a CSV import completes, schedule external-factor collection for every
 * imported date (fire-and-forget; does not block the import response).
 */
export async function triggerPostImportTasks(importJobId: string): Promise<void> {
  try {
    const rows = await prisma.importRow.findMany({
      where: { jobId: importJobId, status: "imported", parsedDate: { not: null } },
      select: { parsedDate: true },
    });

    const uniqueDates = [...new Set(
      rows
        .map((r) => r.parsedDate)
        .filter((d): d is Date => d != null)
        .map((d) => toDateKey(new Date(d)))
    )];

    for (const dateStr of uniqueDates) {
      const d = new Date(dateStr + "T00:00:00.000Z");
      // Schedule (don't run inline — keep import route fast)
      await scheduleExternalFactorCollection(d);
    }
  } catch (err) {
    // Log but never block the import response
    console.error("[triggerPostImportTasks] Failed to schedule post-import tasks:", err instanceof Error ? err.message : String(err));
  }
}
