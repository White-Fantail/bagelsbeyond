"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/dal";
import {
  addFreshnessLog,
  updateFreshnessLog,
  deleteFreshnessLog,
} from "@/lib/services/freshnessService";
import {
  listProductCategories,
  reorderFreshnessCategories,
  updateProductCategory,
} from "@/lib/services/menuProductService";
import { FreshnessLogType } from "@/app/generated/prisma/enums";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface FreshnessActionResult {
  success?: boolean;
  message?: string;
  errors?: Record<string, string[]>;
}

function moveItemByDirection<T>(
  items: T[],
  currentIndex: number,
  direction: "up" | "down"
): T[] {
  const next = [...items];
  const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
  if (targetIndex < 0 || targetIndex >= next.length) return next;
  const [moved] = next.splice(currentIndex, 1);
  next.splice(targetIndex, 0, moved);
  return next;
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
  } catch (err) {
    console.error("[createFreshnessLogAction]", err);
    return { message: "Failed to create log entry. Please try again." };
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
  } catch (err) {
    console.error("[updateFreshnessLogAction]", err);
    return { message: "Failed to update log entry. Please try again." };
  }
}

export async function deleteFreshnessLogAction(id: string): Promise<FreshnessActionResult> {
  await requireAdmin();
  try {
    await deleteFreshnessLog(id);
    revalidatePath("/freshness");
    revalidatePath("/freshness/logs");
    return { success: true };
  } catch (err) {
    console.error("[deleteFreshnessLogAction]", err);
    return { message: "Failed to delete log entry. Please try again." };
  }
}

export async function toggleFreshnessManagedCategoryAction(
  formData: FormData
): Promise<FreshnessActionResult> {
  await requireAdmin();
  const categoryId = formData.get("categoryId");
  const nextManaged = formData.get("isFreshnessManaged");

  if (typeof categoryId !== "string" || !categoryId) {
    return { message: "Category is required" };
  }
  if (typeof nextManaged !== "string") {
    return { message: "Invalid managed value" };
  }

  try {
    await updateProductCategory(categoryId, {
      isFreshnessManaged: nextManaged === "true",
    });
    revalidatePath("/freshness");
    revalidatePath("/product-categories");
    return { success: true };
  } catch (err) {
    console.error("[toggleFreshnessManagedCategoryAction]", err);
    return { message: "Failed to update category freshness setting." };
  }
}

export async function moveFreshnessCategoryAction(
  formData: FormData
): Promise<FreshnessActionResult> {
  await requireAdmin();
  const categoryId = formData.get("categoryId");
  const direction = formData.get("direction");

  if (typeof categoryId !== "string" || !categoryId) {
    return { message: "Category is required" };
  }
  if (direction !== "up" && direction !== "down") {
    return { message: "Invalid direction" };
  }

  try {
    const categories = await listProductCategories();
    const ordered = [...categories].sort(
      (a, b) => a.freshnessSortOrder - b.freshnessSortOrder || a.name.localeCompare(b.name)
    );
    const currentIndex = ordered.findIndex((c) => c.id === categoryId);
    if (currentIndex === -1) {
      return { message: "Category not found" };
    }

    if (
      (direction === "up" && currentIndex === 0) ||
      (direction === "down" && currentIndex === ordered.length - 1)
    ) {
      return { success: true };
    }
    const reordered = moveItemByDirection(ordered, currentIndex, direction);
    await reorderFreshnessCategories(reordered.map((c) => c.id));
    revalidatePath("/freshness");
    revalidatePath("/product-categories");
    return { success: true };
  } catch (err) {
    console.error("[moveFreshnessCategoryAction]", err);
    return { message: "Failed to update category order." };
  }
}
