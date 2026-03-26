/**
 * POST /api/admin/integrations/loyverse/sync
 *
 * Trigger a Loyverse catalogue sync.
 * ADMIN only.
 *
 * Response: CatalogSyncResult
 */

import { NextResponse } from "next/server";
import { apiRequireAdmin, isNextResponse } from "@/lib/auth/dal";
import { createLoyverseAdapter } from "@/lib/integrations/adapters/pos/loyverse";
import { syncExternalCatalog } from "@/lib/integrations/services/catalog-sync";
import { IntegrationSource } from "@/app/generated/prisma/enums";

export async function POST() {
  const authResult = await apiRequireAdmin();
  if (isNextResponse(authResult)) return authResult;

  try {
    const adapter = createLoyverseAdapter();
    const result = await syncExternalCatalog(adapter, IntegrationSource.LOYVERSE);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[/api/admin/integrations/loyverse/sync] Unexpected error:", err);
    return NextResponse.json(
      { message: err instanceof Error ? err.message : "동기화 중 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}
