import { NextResponse } from "next/server";
import { apiRequireAdmin, isNextResponse } from "@/lib/auth/dal";
import { autoMapLoyverseCatalogToCanonical } from "@/lib/catalog/auto-map-loyverse";

/**
 * POST /api/admin/integrations/loyverse/catalog-sync/auto-map-only
 *
 * Runs Phase B only: auto-map mirrored Loyverse rows into canonical
 * internal entities and create/update mapping rows.
 * Requires mirror sync (Phase A) to have been run first.
 * Safe to run repeatedly — all creates/updates are idempotent.
 */
export async function POST() {
  const auth = await apiRequireAdmin();
  if (isNextResponse(auth)) return auth;

  try {
    const result = await autoMapLoyverseCatalogToCanonical();
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
