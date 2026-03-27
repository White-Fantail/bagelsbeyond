/**
 * POST /api/admin/integrations/loyverse/full-sync
 *
 * Runs a full Loyverse mirror sync in sequence:
 *   1. Categories  → loyverse_categories
 *   2. Modifiers + options → loyverse_modifiers / loyverse_modifier_options
 *   3. Items → loyverse_items
 *   4. Item-Modifier links → loyverse_item_modifiers
 *   5. Variants → loyverse_variants
 *   6. Inventory → loyverse_inventory_levels
 *
 * ADMIN only.
 *
 * Response: MirrorSyncResult
 */

import { NextResponse } from "next/server";
import { apiRequireAdmin, isNextResponse } from "@/lib/auth/dal";
import { createLoyverseAdapter } from "@/lib/integrations/adapters/pos/loyverse";
import { syncAllLoyverse } from "@/lib/integrations/services/loyverse-mirror-sync";

export const dynamic = "force-dynamic";

export async function POST() {
  const authResult = await apiRequireAdmin();
  if (isNextResponse(authResult)) return authResult;

  try {
    const adapter = createLoyverseAdapter();
    const result = await syncAllLoyverse(adapter);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[/api/admin/integrations/loyverse/full-sync] Unexpected error:", err);
    return NextResponse.json(
      { message: err instanceof Error ? err.message : "동기화 중 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}
