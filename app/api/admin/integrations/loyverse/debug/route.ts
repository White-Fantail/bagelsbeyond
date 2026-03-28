/**
 * GET /api/admin/integrations/loyverse/debug
 *
 * Returns DB row counts and diagnostics for every Loyverse mirror table,
 * plus the most recent full-sync log entry.
 *
 * ADMIN only.
 */

import { NextResponse } from "next/server";
import { apiRequireAdmin, isNextResponse } from "@/lib/auth/dal";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const authResult = await apiRequireAdmin();
  if (isNextResponse(authResult)) return authResult;

  const [
    categoryCount,
    modifierCount,
    modifierOptionCount,
    itemCount,
    itemModifierCount,
    variantCount,
    inventoryCount,
    lastSync,
  ] = await Promise.all([
    prisma.loyverseCategory.count(),
    prisma.loyverseModifier.count(),
    prisma.loyverseModifierOption.count(),
    prisma.loyverseItem.count(),
    prisma.loyverseItemModifier.count(),
    prisma.loyverseVariant.count(),
    prisma.loyverseInventoryLevel.count(),
    prisma.loyverseFullSyncLog.findFirst({
      orderBy: { syncedAt: "desc" },
      select: {
        syncedAt: true,
        status: true,
        categoriesUpserted: true,
        modifierGroupsUpserted: true,
        modifierOptionsUpserted: true,
        productsCreated: true,
        productsUpdated: true,
        modifierLinksUpdated: true,
        itemModifierLinksAttempted: true,
        itemModifierLinksPersisted: true,
        errorCount: true,
        errorMessage: true,
      },
    }),
  ]);

  return NextResponse.json({
    db: {
      loyverse_categories: categoryCount,
      loyverse_modifiers: modifierCount,
      loyverse_modifier_options: modifierOptionCount,
      loyverse_items: itemCount,
      loyverse_item_modifiers: itemModifierCount,
      loyverse_variants: variantCount,
      loyverse_inventory_levels: inventoryCount,
    },
    lastSync: lastSync
      ? {
          ...lastSync,
          syncedAt: lastSync.syncedAt.toISOString(),
        }
      : null,
    generatedAt: new Date().toISOString(),
  });
}
