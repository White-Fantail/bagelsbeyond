/**
 * POST /api/admin/integrations/loyverse/new-sync
 *
 * Runs the new 3-layer architecture Loyverse full sync:
 *   1. Mirror layer  (channel_categories, channel_products, channel_modifier_groups, etc.)
 *   2. Canonical layer (categories, products, product_option_groups, product_options)
 *   3. Mapping layer  (category_channel_mappings, product_channel_mappings, etc.)
 *   4. Product-modifier links rebuilt from modifier_ids
 *   5. Stale mirror records soft-deleted
 *
 * ADMIN only.
 *
 * Response: LoyverseNewSyncResult
 */

import { NextResponse } from "next/server";
import { apiRequireAdmin, isNextResponse } from "@/lib/auth/dal";
import { createLoyverseAdapter } from "@/lib/integrations/adapters/pos/loyverse";
import { runLoyverseNewFullSync } from "@/lib/integrations/services/loyverse-new-sync";

export const dynamic = "force-dynamic";

export async function POST() {
  const authResult = await apiRequireAdmin();
  if (isNextResponse(authResult)) return authResult;

  try {
    const adapter = createLoyverseAdapter();
    const result = await runLoyverseNewFullSync(adapter);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[/api/admin/integrations/loyverse/new-sync] Unexpected error:", err);
    return NextResponse.json(
      { message: err instanceof Error ? err.message : "Error during sync" },
      { status: 500 }
    );
  }
}
