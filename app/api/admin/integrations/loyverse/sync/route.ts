/**
 * POST /api/admin/integrations/loyverse/sync
 *
 * Trigger a full Loyverse sync (categories + modifiers + products + links).
 * Delegates to the unified full-sync service.
 * ADMIN only.
 *
 * Response: FullSyncResult
 */

import { NextResponse } from "next/server";
import { apiRequireAdmin, isNextResponse } from "@/lib/auth/dal";
import { createLoyverseAdapter } from "@/lib/integrations/adapters/pos/loyverse";
import { runLoyverseFullSync } from "@/lib/integrations/services/loyverse-full-sync";

export async function POST() {
  const authResult = await apiRequireAdmin();
  if (isNextResponse(authResult)) return authResult;

  try {
    const adapter = createLoyverseAdapter();
    const result = await runLoyverseFullSync(adapter);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[/api/admin/integrations/loyverse/sync] Unexpected error:", err);
    return NextResponse.json(
      { message: err instanceof Error ? err.message : "Error during Sync" },
      { status: 500 }
    );
  }
}
