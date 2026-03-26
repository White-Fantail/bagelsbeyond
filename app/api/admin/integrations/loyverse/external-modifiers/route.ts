/**
 * GET /api/admin/integrations/loyverse/external-modifiers
 *
 * Returns the most recent successful Loyverse modifier sync result stored in
 * `LoyverseModifierSyncLog`.  Does NOT call the live Loyverse API directly —
 * use POST /api/admin/integrations/loyverse/modifier-sync to refresh.
 *
 * ADMIN only.
 *
 * Response body:
 * {
 *   groups:  { id, name }[]
 *   options: { groupId, groupName, optionId, optionName, price }[]
 *   sync: {
 *     status:        "success" | "empty" | "failed" | "never"
 *     syncedAt:      string | null
 *     groupCount:    number
 *     optionCount:   number
 *     errorMessage?: string
 *     errorCode?:    number
 *   }
 * }
 *
 * The `sync.status` of "never" means no sync has been attempted yet.
 */

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/dal";
import { prisma } from "@/lib/db";
import type { LoyverseRawModifier } from "@/lib/integrations/adapters/pos/types";

export const dynamic = "force-dynamic";

export async function GET() {
  await requireAdmin();

  // Find the most recent sync log entry (any status — we always want metadata)
  const lastLog = await prisma.loyverseModifierSyncLog.findFirst({
    orderBy: { syncedAt: "desc" },
  });

  // No sync has ever been attempted
  if (!lastLog) {
    return NextResponse.json({
      groups: [],
      options: [],
      sync: {
        status: "never",
        syncedAt: null,
        groupCount: 0,
        optionCount: 0,
      },
    });
  }

  // The last attempt failed or returned empty — still expose sync metadata
  // but fall back to the most recent *successful* entry for actual modifier data
  let modifiers: LoyverseRawModifier[] = [];
  let dataLog = lastLog;

  if (lastLog.status !== "success") {
    const lastSuccess = await prisma.loyverseModifierSyncLog.findFirst({
      where: { status: "success" },
      orderBy: { syncedAt: "desc" },
    });
    if (lastSuccess) {
      dataLog = lastSuccess;
    }
  }

  if (dataLog.rawGroups && Array.isArray(dataLog.rawGroups)) {
    modifiers = dataLog.rawGroups as unknown as LoyverseRawModifier[];
  }

  const flat = modifiers.flatMap((m) =>
    m.options.map((o) => ({
      groupId: m.id,
      groupName: m.name,
      optionId: o.id,
      optionName: o.name,
      price: o.price,
    }))
  );

  return NextResponse.json({
    groups: modifiers.map((m) => ({ id: m.id, name: m.name })),
    options: flat,
    sync: {
      status: lastLog.status,
      syncedAt: lastLog.syncedAt.toISOString(),
      groupCount: lastLog.groupCount,
      optionCount: lastLog.optionCount,
      errorMessage: lastLog.errorMessage ?? undefined,
      errorCode: lastLog.errorCode ?? undefined,
    },
  });
}
