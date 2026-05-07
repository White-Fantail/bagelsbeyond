"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/dal";
import {
  addFreshnessLog,
  updateFreshnessLog,
  deleteFreshnessLog,
} from "@/lib/services/freshnessService";
import { FreshnessLogType } from "@/app/generated/prisma/enums";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface FreshnessActionResult {
  success?: boolean;
  message?: string;
  errors?: Record<string, string[]>;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseLoggedAt(raw: string): Date | null {
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
}

// ── Actions ───────────────────────────────────────────────────────────────────

export async function createFreshnessLogAction(
  formData: FormData
): Promise<FreshnessActionResult> {
  const session = await requireAdmin();

  const productId = formData.get("productId") as string;
  const logTypeRaw = formData.get("logType") as string;
  const loggedAtRaw = formData.get("loggedAt") as string;
  const notes = (formData.get("notes") as string) || null;
  const rawDictation = (formData.get("rawDictation") as string) || null;

  const errors: Record<string, string[]> = {};
  if (!productId) errors.productId = ["Product is required"];
  if (!logTypeRaw || !(logTypeRaw in FreshnessLogType)) {
    errors.logType = ["Log type is required"];
  }
  const loggedAt = loggedAtRaw ? parseLoggedAt(loggedAtRaw) : null;
  if (!loggedAt) errors.loggedAt = ["Valid date/time is required"];

  if (Object.keys(errors).length > 0) {
    return { errors };
  }

  try {
    await addFreshnessLog({
      productId,
      logType: logTypeRaw as FreshnessLogType,
      loggedAt: loggedAt!,
      notes,
      rawDictation,
      createdByUserId: session.userId,
    });
    revalidatePath("/freshness");
    revalidatePath("/freshness/logs");
    return { success: true };
  } catch {
    return { message: "Failed to create log entry" };
  }
}

export async function updateFreshnessLogAction(
  id: string,
  formData: FormData
): Promise<FreshnessActionResult> {
  await requireAdmin();

  const logTypeRaw = formData.get("logType") as string | null;
  const loggedAtRaw = formData.get("loggedAt") as string | null;
  const notes = (formData.get("notes") as string) || null;
  const rawDictation = (formData.get("rawDictation") as string) || null;

  const errors: Record<string, string[]> = {};
  let loggedAt: Date | undefined;
  if (loggedAtRaw) {
    const d = parseLoggedAt(loggedAtRaw);
    if (!d) errors.loggedAt = ["Valid date/time is required"];
    else loggedAt = d;
  }
  if (logTypeRaw && !(logTypeRaw in FreshnessLogType)) {
    errors.logType = ["Invalid log type"];
  }

  if (Object.keys(errors).length > 0) {
    return { errors };
  }

  try {
    await updateFreshnessLog(id, {
      ...(logTypeRaw ? { logType: logTypeRaw as FreshnessLogType } : {}),
      ...(loggedAt ? { loggedAt } : {}),
      notes,
      rawDictation,
    });
    revalidatePath("/freshness");
    revalidatePath("/freshness/logs");
    return { success: true };
  } catch {
    return { message: "Failed to update log entry" };
  }
}

export async function deleteFreshnessLogAction(id: string): Promise<FreshnessActionResult> {
  await requireAdmin();
  try {
    await deleteFreshnessLog(id);
    revalidatePath("/freshness");
    revalidatePath("/freshness/logs");
    return { success: true };
  } catch {
    return { message: "Failed to delete log entry" };
  }
}
