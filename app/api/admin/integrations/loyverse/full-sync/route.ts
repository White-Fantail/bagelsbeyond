/**
 * POST /api/admin/integrations/loyverse/full-sync
 *
 * Runs a full, unified Loyverse sync in a single pass:
 *   1. Categories → LoyverseCategory upsert
 *   2. Modifier groups + options → ProductOptionGroup / ProductOption upsert
 *   3. Products → Product upsert + category link + modifier group assignments
 *   4. Stale modifier link cleanup
 *
 * ADMIN only.
 *
 * Response: FullSyncResult
 */

import { NextResponse } from "next/server";
import { apiRequireAdmin, isNextResponse } from "@/lib/auth/dal";
import { createLoyverseAdapter } from "@/lib/integrations/adapters/pos/loyverse";
import { runLoyverseFullSync } from "@/lib/integrations/services/loyverse-full-sync";

export const dynamic = "force-dynamic";

export async function POST() {
  const authResult = await apiRequireAdmin();
  if (isNextResponse(authResult)) return authResult;

  try {
    const adapter = createLoyverseAdapter();
    const result = await runLoyverseFullSync(adapter);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[/api/admin/integrations/loyverse/full-sync] Unexpected error:", err);
    return NextResponse.json(
      { message: err instanceof Error ? err.message : "동기화 중 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}
