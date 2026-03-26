/**
 * POST /api/admin/integrations/loyverse/category-sync
 *
 * Fetches the current category list from Loyverse and returns category stats.
 * Categories are synced as part of the full catalog sync; this endpoint
 * provides a lightweight way to check what categories Loyverse currently has
 * and how they map to internal ProductCategory values.
 *
 * ADMIN only.
 *
 * Response body:
 * {
 *   status:         "success" | "empty" | "failed"
 *   categoryCount:  number
 *   categories:     { id: string; name: string; color: string | null }[]
 *   syncedAt:       string (ISO)
 *   errorMessage?:  string
 * }
 */

import { NextResponse } from "next/server";
import { apiRequireAdmin, isNextResponse } from "@/lib/auth/dal";
import { createLoyverseAdapter } from "@/lib/integrations/adapters/pos/loyverse";

export const dynamic = "force-dynamic";

export async function POST() {
  const authResult = await apiRequireAdmin();
  if (isNextResponse(authResult)) return authResult;

  const adapter = createLoyverseAdapter();

  try {
    const rawCategories = await adapter.fetchCategories();
    const activeCategories = rawCategories.filter((c) => c.deleted_at === null);

    const categories = activeCategories.map((c) => ({
      id: c.id,
      name: c.name,
      color: c.color,
    }));

    const status = categories.length === 0 ? "empty" : "success";

    console.info(`[category-sync] status=${status} categories=${categories.length}`);

    return NextResponse.json({
      status,
      categoryCount: categories.length,
      categories,
      syncedAt: new Date().toISOString(),
    });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error(`[category-sync] FAILED: ${errorMessage}`);

    return NextResponse.json(
      {
        status: "failed",
        categoryCount: 0,
        categories: [],
        syncedAt: new Date().toISOString(),
        errorMessage,
      },
      { status: 502 }
    );
  }
}
