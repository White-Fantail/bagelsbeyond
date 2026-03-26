/**
 * GET /api/admin/integrations/loyverse/status
 *
 * Returns the current Loyverse integration configuration status
 * and the last sync summary.
 * ADMIN only.
 *
 * NOTE: Token values are NEVER returned — only presence is indicated.
 */

import { NextResponse } from "next/server";
import { apiRequireAdmin, isNextResponse } from "@/lib/auth/dal";
import {
  isLoyverseEnabled,
  isLoyverseMockMode,
} from "@/lib/integrations/adapters/pos/loyverse";
import { prisma } from "@/lib/db";
import { IntegrationSource } from "@/app/generated/prisma/enums";

export async function GET() {
  const authResult = await apiRequireAdmin();
  if (isNextResponse(authResult)) return authResult;

  const hasToken = Boolean(process.env.LOYVERSE_API_TOKEN);
  const mockMode = isLoyverseMockMode();
  const enabled = isLoyverseEnabled();

  // Retrieve last sync time and product count from ExternalProductMap
  const [lastSyncEntry, mappedProductCount] = await Promise.all([
    prisma.externalProductMap.findFirst({
      where: { source: IntegrationSource.LOYVERSE },
      orderBy: { lastSyncedAt: "desc" },
      select: { lastSyncedAt: true },
    }),
    prisma.externalProductMap.count({
      where: { source: IntegrationSource.LOYVERSE },
    }),
  ]);

  return NextResponse.json({
    provider: "LOYVERSE",
    enabled,
    hasToken,
    mockMode,
    baseUrl: process.env.LOYVERSE_API_BASE_URL ?? "https://api.loyverse.com/v1.0",
    lastSyncedAt: lastSyncEntry?.lastSyncedAt ?? null,
    mappedProductCount,
  });
}
