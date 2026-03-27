/**
 * Task Service
 *
 * Manages ScheduledTask lifecycle:
 *   create → pending → running → success | partial | failed | skipped
 *
 * All task runners catch exceptions internally so the app never dies.
 */

import { prisma } from "@/lib/db";
import { upsertExternalFactorsByDate } from "@/lib/services/externalFactorService";
import {
  buildPredictionInput,
  calculateRuleBasedPrediction,
  savePredictionResult,
} from "@/lib/services/predictionService";
import { toDateKey, summarizeTaskResult } from "@/lib/task-utils";
import type { TaskStatus, TaskType } from "@/types";

// ─── Internal helpers ──────────────────────────────────────────────────────────

async function createTask(taskType: TaskType, targetDate?: Date): Promise<string> {
  const task = await prisma.scheduledTask.create({
    data: {
      taskType,
      targetDate: targetDate ?? null,
      status: "pending",
    },
  });
  return task.id;
}

async function markRunning(taskId: string): Promise<void> {
  await prisma.scheduledTask.update({
    where: { id: taskId },
    data: { status: "running", startedAt: new Date() },
  });
}

async function markDone(
  taskId: string,
  status: TaskStatus,
  opts: { resultSummary?: string; errorMessage?: string } = {}
): Promise<void> {
  await prisma.scheduledTask.update({
    where: { id: taskId },
    data: {
      status,
      finishedAt: new Date(),
      resultSummary: opts.resultSummary ?? null,
      errorMessage: opts.errorMessage ?? null,
    },
  });
}

async function addLog(
  taskId: string,
  message: string,
  level: "info" | "warning" | "error" = "info"
): Promise<void> {
  await prisma.taskLog.create({ data: { scheduledTaskId: taskId, message, level } });
}

// ─── Schedule helpers (create task only) ──────────────────────────────────────

export async function scheduleExternalFactorCollection(date: Date): Promise<string> {
  return createTask("collect_external_factors", date);
}

export async function schedulePredictionGeneration(date: Date): Promise<string> {
  return createTask("generate_prediction", date);
}

// ─── Task Runners ─────────────────────────────────────────────────────────────

/**
 * Run the external-factor-collection task for the given taskId.
 * The task's targetDate is used as the date to collect.
 */
export async function runExternalFactorCollectionTask(taskId: string): Promise<void> {
  const task = await prisma.scheduledTask.findUnique({ where: { id: taskId } });
  if (!task) throw new Error(`Task not found: ${taskId}`);
  if (!task.targetDate) {
    await markDone(taskId, "failed", { errorMessage: "targetDate is missing." });
    return;
  }

  await markRunning(taskId);
  await addLog(taskId, `ExternalFactor Collect Started: ${toDateKey(task.targetDate)}`);

  try {
    const result = await upsertExternalFactorsByDate(new Date(task.targetDate));

    for (const w of result.warnings) {
      await addLog(taskId, w, "warning");
    }

    const summary = summarizeTaskResult({
      totalDates: 1,
      processedDates: result.success ? 1 : 0,
      failedDates: result.success ? 0 : 1,
      failedProviders: result.failedProviders,
    });

    if (!result.success) {
      await addLog(taskId, `Collect Failed: ${result.warnings.join("; ")}`, "error");
      await markDone(taskId, "failed", { resultSummary: summary, errorMessage: result.warnings.join("; ") });
    } else if (result.failedProviders.length > 0) {
      await addLog(taskId, `Partial Success: ${result.failedProviders.length} provider Failed`, "warning");
      await markDone(taskId, "partial", { resultSummary: summary });
    } else {
      await addLog(taskId, `Collection complete: ${result.collectedFields.join(", ")}`);
      await markDone(taskId, "success", { resultSummary: summary });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await addLog(taskId, `Exception: ${msg}`, "error");
    await markDone(taskId, "failed", { errorMessage: msg });
  }
}

/**
 * Run the prediction generation task for the given taskId.
 * Will attempt to collect external factors first if they are missing.
 */
export async function runPredictionGenerationTask(taskId: string): Promise<void> {
  const task = await prisma.scheduledTask.findUnique({ where: { id: taskId } });
  if (!task) throw new Error(`Task not found: ${taskId}`);
  if (!task.targetDate) {
    await markDone(taskId, "failed", { errorMessage: "targetDate is missing." });
    return;
  }

  await markRunning(taskId);
  const targetDate = new Date(task.targetDate);
  targetDate.setHours(0, 0, 0, 0);
  const dateStr = toDateKey(targetDate);
  await addLog(taskId, `Predictions Create Started: ${dateStr}`);

  try {
    // Check for existing prediction
    const end = new Date(targetDate);
    end.setHours(23, 59, 59, 999);
    const existingPrediction = await prisma.salesPrediction.findFirst({
      where: { targetDate: { gte: targetDate, lte: end } },
    });
    if (existingPrediction) {
      await addLog(taskId, `Prediction already exists (id: ${existingPrediction.id}). Skipped.`);
      await markDone(taskId, "skipped", { resultSummary: "Prediction already exists" });
      return;
    }

    // Ensure external factors exist; collect if missing
    const existingFactor = await prisma.dailyExternalFactor.findUnique({ where: { date: targetDate } });
    if (!existingFactor) {
      await addLog(taskId, `No ExternalFactor found — attempting to collect: ${dateStr}`);
      try {
        const r = await upsertExternalFactorsByDate(targetDate);
        if (!r.success) {
          await addLog(taskId, `ExternalFactor Collect Failed: ${r.warnings.join("; ")}`, "warning");
        } else {
          await addLog(taskId, `ExternalFactor Collection complete: ${r.collectedFields.join(", ")}`);
        }
      } catch (fe) {
        await addLog(taskId, `ExternalFactor collection exception: ${fe instanceof Error ? fe.message : String(fe)}`, "warning");
      }
    } else {
      await addLog(taskId, `Using existing ExternalFactor: ${dateStr}`);
    }

    // Build and save prediction
    const input = await buildPredictionInput(targetDate);
    const result = calculateRuleBasedPrediction(input);
    const savedPrediction = await savePredictionResult(result);

    await addLog(taskId, `Predictions Create Completed: id=${savedPrediction.id}, PredictedSales=${result.predictedSales}`);
    await markDone(taskId, "success", {
      resultSummary: `Predictions id: ${savedPrediction.id} | PredictedSales: ${Math.round(result.predictedSales)}`,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await addLog(taskId, `Exception: ${msg}`, "error");
    await markDone(taskId, "failed", { errorMessage: msg });
  }
}

// ─── Run all pending tasks ─────────────────────────────────────────────────────

export async function runPendingTasks(): Promise<{ ran: number; errors: string[] }> {
  const pending = await prisma.scheduledTask.findMany({
    where: { status: "pending" },
    orderBy: { createdAt: "asc" },
  });

  let ran = 0;
  const errors: string[] = [];

  for (const task of pending) {
    try {
      if (task.taskType === "collect_external_factors") {
        await runExternalFactorCollectionTask(task.id);
      } else if (task.taskType === "generate_prediction") {
        await runPredictionGenerationTask(task.id);
      }
      ran++;
    } catch (err) {
      const msg = `Task ${task.id} (${task.taskType}): ${err instanceof Error ? err.message : String(err)}`;
      errors.push(msg);
    }
  }

  return { ran, errors };
}

// ─── Retry a failed task ──────────────────────────────────────────────────────

export async function retryFailedTask(taskId: string): Promise<void> {
  const task = await prisma.scheduledTask.findUnique({ where: { id: taskId } });
  if (!task) throw new Error(`Task not found: ${taskId}`);
  if (!["failed", "partial"].includes(task.status)) {
    throw new Error(`Task ${taskId} is not in a retryable state (status: ${task.status})`);
  }

  await prisma.scheduledTask.update({
    where: { id: taskId },
    data: { status: "pending", retryCount: task.retryCount + 1, errorMessage: null },
  });

  if (task.taskType === "collect_external_factors") {
    await runExternalFactorCollectionTask(taskId);
  } else if (task.taskType === "generate_prediction") {
    await runPredictionGenerationTask(taskId);
  }
}

