/**
 * Task Utilities
 *
 * Shared helper functions for scheduling, date handling, and task status formatting.
 */

import type { TaskStatus, TaskType } from "@/types";

// ─── Date Helpers ──────────────────────────────────────────────────────────────

/** Returns today at midnight UTC-normalised to NZ midnight. */
export function getToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Returns tomorrow at midnight. */
export function getTomorrow(): Date {
  const d = getToday();
  d.setDate(d.getDate() + 1);
  return d;
}

/**
 * Returns an inclusive array of dates between start and end.
 * Both ends are normalised to midnight.
 */
export function getDateRange(start: Date, end: Date): Date[] {
  const dates: Date[] = [];
  const cur = new Date(start);
  cur.setHours(0, 0, 0, 0);
  const fin = new Date(end);
  fin.setHours(0, 0, 0, 0);
  while (cur <= fin) {
    dates.push(new Date(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

/** Returns "YYYY-MM-DD" string for a Date. */
export function toDateKey(date: Date): string {
  return date.toISOString().split("T")[0];
}

// ─── Status Label Helpers ──────────────────────────────────────────────────────

const STATUS_LABELS: Record<TaskStatus, string> = {
  pending:  "Pending",
  running:  "Running",
  success:  "Success",
  partial:  "Partial Success",
  failed:   "Failed",
  skipped:  "Skipped",
};

const STATUS_COLORS: Record<TaskStatus, string> = {
  pending:  "bg-gray-100 text-gray-700",
  running:  "bg-blue-100 text-blue-700",
  success:  "bg-green-100 text-green-700",
  partial:  "bg-yellow-100 text-yellow-700",
  failed:   "bg-red-100 text-red-700",
  skipped:  "bg-slate-100 text-slate-600",
};

export function formatTaskStatus(status: string): string {
  return STATUS_LABELS[status as TaskStatus] ?? status;
}

export function getTaskStatusColor(status: string): string {
  return STATUS_COLORS[status as TaskStatus] ?? "bg-gray-100 text-gray-600";
}

const TASK_TYPE_LABELS: Record<TaskType, string> = {
  collect_external_factors: "ExternalFactor Collect",
  generate_prediction:      "Predictions Create",
};

export function formatTaskType(taskType: string): string {
  return TASK_TYPE_LABELS[taskType as TaskType] ?? taskType;
}

// ─── Result Summary Builder ────────────────────────────────────────────────────

export type TaskResultSummaryInput = {
  totalDates?: number;
  processedDates?: number;
  failedDates?: number;
  skippedDates?: number;
  failedProviders?: string[];
  extraInfo?: string;
};

export function summarizeTaskResult(input: TaskResultSummaryInput): string {
  const parts: string[] = [];
  if (input.totalDates != null) parts.push(`Target dates: ${input.totalDates}`);
  if (input.processedDates != null) parts.push(`Processing: ${input.processedDates} days`);
  if (input.failedDates != null && input.failedDates > 0) parts.push(`Failed: ${input.failedDates} days`);
  if (input.skippedDates != null && input.skippedDates > 0) parts.push(`Skipped: ${input.skippedDates} days`);
  if (input.failedProviders && input.failedProviders.length > 0)
    parts.push(`Failed provider: ${input.failedProviders.join(", ")}`);
  if (input.extraInfo) parts.push(input.extraInfo);
  return parts.join(" | ");
}
